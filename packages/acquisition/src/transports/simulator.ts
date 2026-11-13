/* The simulator: a pretend acquisition device that lives in memory and speaks the same protocol, as bytes, as a real
   one. Because it sits below the adapter, everything above it (checks, recorder, graph) is exercised exactly as with
   hardware. It never touches a port. Data from it is always labeled "Simulated data, not measured".

   The numbers below (volts per newton, volts per millimetre, the divider) are made up for the simulator.
   They say nothing about the real tester, whose outputs and scaling are not verified. */
import { LineFramer, PROTOCOL_VERSION } from '@tensile/protocol';
import type { Transport } from '../types';

export interface SimulatedSignal {
  /** Pretend machine output, volts per newton and volts per millimetre. */
  volts_per_N: number;
  volts_per_mm: number;
  /** Pretend conditioning circuit: volts at the ADC divided by volts at the machine output. */
  conditioningGain: number;
}
export const SIMULATED_SIGNAL: SimulatedSignal = { volts_per_N: 5 / 500, volts_per_mm: 5 / 100, conditioningGain: 0.6 };

export type Motion = (t_s: number) => { force_N: number; displacement_mm: number };

/** A soft-tissue-like pull to failure: toe-shaped rise, then the force drops. Made-up shape, not data. */
export function simulatedUniaxial(o: { speed_mm_min?: number; gauge_mm?: number; area_mm2?: number; failStrain?: number } = {}): Motion {
  const v = (o.speed_mm_min ?? 30) / 60, L0 = o.gauge_mm ?? 25, A = o.area_mm2 ?? 6, ef = o.failStrain ?? 0.33;
  return (t) => {
    const d = v * t, e = d / L0;
    const s = e <= ef ? 0.4 * (Math.exp(9 * e) - 1) : 0.4 * (Math.exp(9 * ef) - 1) * 0.03;
    return { force_N: s * A, displacement_mm: d };
  };
}
/** A ramp to a hold displacement, then a decaying hold. Made-up shape, not data. */
export function simulatedRelaxation(o: { speed_mm_min?: number; hold_mm?: number; area_mm2?: number; peak_MPa?: number } = {}): Motion {
  const v = (o.speed_mm_min ?? 30) / 60, hold = o.hold_mm ?? 2.5, A = o.area_mm2 ?? 9, s0 = o.peak_MPa ?? 1.8, tr = hold / v;
  return (t) => {
    if (t < tr) { const u = t / tr; return { force_N: s0 * u * u * A, displacement_mm: hold * u }; }
    const th = t - tr;
    return { force_N: s0 * (0.6 + 0.25 * Math.exp(-th / 8) + 0.15 * Math.exp(-th / 90)) * A, displacement_mm: hold };
  };
}

export interface SimulatorOptions {
  /** What the pretend device says it is. The app does not branch on it. */
  deviceType?: string;
  deviceId?: string;
  timeUnit?: 'us' | 'ms';
  motion?: Motion;
  signal?: SimulatedSignal;
  dataRate_sps?: number;
  fullScale_mV?: number;
  /** Deliver the bytes in pieces of this size, to imitate serial reads that split messages. */
  chunkSize?: number;
  seed?: number;
  /** Noise at the ADC input, volts (standard deviation, roughly). */
  noise_V?: number;
  /** Run by itself on a timer. When false, call step() to produce conversions. */
  auto?: boolean;
  /* The rest are for tests of how the app handles trouble. */
  protocolVersion?: number;
  adcMissing?: boolean;
  omitDisplacement?: boolean;
  silent?: boolean;
}

const RATES = [8, 16, 32, 64, 128, 250, 475, 860];
const RANGES = [6144, 4096, 2048, 1024, 512, 256];

export class SimulatedDevice implements Transport {
  readonly label = 'Simulator';
  private o: Required<Omit<SimulatorOptions, 'motion' | 'signal'>> & { motion: Motion; signal: SimulatedSignal };
  private dataListener: (chunk: Uint8Array) => void = () => undefined;
  private closeListener: (info: { unexpected: boolean; reason: string }) => void = () => undefined;
  private isOpen = false;
  private framer = new LineFramer();
  private enc = new TextEncoder();
  private dec = new TextDecoder();
  private boot = 0;
  private settingsNo = 1;
  private rate: number;
  private range: number;
  private order: string[];
  private streaming = false;
  private seq = 0;
  private conv = 0;
  private uptime_s = 5.25;
  private streamStart_s = 0;
  private drop = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private rnd: () => number;
  /** Every byte the app wrote to this device, for tests. */
  readonly written: Uint8Array[] = [];

  constructor(options: SimulatorOptions = {}) {
    this.o = {
      deviceType: options.deviceType ?? 'simulator', deviceId: options.deviceId ?? 'sim-0001', timeUnit: options.timeUnit ?? 'us',
      motion: options.motion ?? simulatedUniaxial(), signal: options.signal ?? SIMULATED_SIGNAL,
      dataRate_sps: options.dataRate_sps ?? 128, fullScale_mV: options.fullScale_mV ?? 4096, chunkSize: options.chunkSize ?? 0,
      seed: options.seed ?? 1, noise_V: options.noise_V ?? 0.0004, auto: options.auto ?? true,
      protocolVersion: options.protocolVersion ?? PROTOCOL_VERSION, adcMissing: options.adcMissing ?? false,
      omitDisplacement: options.omitDisplacement ?? false, silent: options.silent ?? false,
    };
    this.rate = this.o.dataRate_sps; this.range = this.o.fullScale_mV;
    this.order = this.o.omitDisplacement ? ['force'] : ['force', 'displacement'];
    let a = this.o.seed >>> 0;
    this.rnd = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  onData(l: (chunk: Uint8Array) => void): void { this.dataListener = l; }
  onClose(l: (info: { unexpected: boolean; reason: string }) => void): void { this.closeListener = l; }
  async open(): Promise<void> { this.isOpen = true; this.boot++; this.streaming = false; this.framer.reset(); }
  async close(): Promise<void> {
    if (!this.isOpen) return;
    this.isOpen = false; this.stopTimer(); this.streaming = false;
    this.closeListener({ unexpected: false, reason: 'closed' });
  }
  async write(bytes: Uint8Array): Promise<void> {
    if (!this.isOpen) throw new Error('The simulator is not connected.');
    this.written.push(bytes);
    for (const f of this.framer.push(this.dec.decode(bytes, { stream: true }))) if ('line' in f) this.request(f.line);
  }

  private get bootId(): string { return 'simboot-' + this.boot; }
  private get ref(): string { return 'sim-s' + this.settingsNo; }
  private say(...messages: object[]): void {
    this.emitText(messages.map((m) => JSON.stringify({ v: this.o.protocolVersion, ...m }) + '\n').join(''));
  }
  private emitText(text: string): void {
    if (!this.isOpen) return;
    const bytes = this.enc.encode(text), size = this.o.chunkSize;
    if (!size) { this.dataListener(bytes); return; }
    for (let i = 0; i < bytes.length; i += size) this.dataListener(bytes.slice(i, i + size));
  }
  private hello(): object {
    return { type: 'hello', device_id: this.o.deviceId, device_type: this.o.deviceType, sw_version: 'sim-1.0.0', boot_id: this.bootId, time_unit: this.o.timeUnit };
  }
  private settingsMessage(): object {
    return { type: 'settings', confirmed: { settings_ref: this.ref, adc: 'ads1115', bits: 16, i2c_address: 72, full_scale_mv: this.range, data_rate_sps: this.rate, channel_order: this.order } };
  }

  private request(line: string): void {
    if (this.o.silent) return;
    let m: { v?: unknown; type?: unknown; id?: unknown; settings?: { full_scale_mv?: number; data_rate_sps?: number; channel_order?: string[] } };
    try { m = JSON.parse(line); } catch { this.say({ type: 'error', code: 'bad_request', message: 'not JSON' }); return; }
    const id = typeof m.id === 'string' ? m.id : undefined;
    if (m.v !== PROTOCOL_VERSION) { this.say({ type: 'error', ...(id ? { id } : {}), code: 'unsupported_version', message: 'this device speaks version ' + PROTOCOL_VERSION }); return; }
    switch (m.type) {
      case 'identify': this.say(this.hello()); break;
      case 'get_channels': {
        const ch: object[] = [{ id: 'force', quantity: 'force', mode: 'single-ended', input: 'AIN0', encoding: 'int16', label: 'Force signal (simulated)' }];
        if (!this.o.omitDisplacement) ch.push({ id: 'displacement', quantity: 'displacement', mode: 'single-ended', input: 'AIN1', encoding: 'int16', label: 'Displacement signal (simulated)' });
        this.say({ type: 'channels', channels: ch });
        break;
      }
      case 'get_settings':
        if (this.o.adcMissing) this.say({ type: 'fault', code: 'adc_not_responding', message: 'no answer from the ADC at address 0x48' });
        else this.say(this.settingsMessage());
        break;
      case 'set_settings': {
        const s = m.settings ?? {};
        const okRate = s.data_rate_sps === undefined || RATES.includes(s.data_rate_sps), okRange = s.full_scale_mv === undefined || RANGES.includes(s.full_scale_mv);
        const okOrder = s.channel_order === undefined || (s.channel_order.length > 0 && s.channel_order.every((c) => c === 'force' || (c === 'displacement' && !this.o.omitDisplacement)));
        if (this.streaming) { this.say({ type: 'error', ...(id ? { id } : {}), code: 'busy', message: 'stop the stream before changing settings' }); break; }
        if (!okRate || !okRange || !okOrder) { this.say({ type: 'error', ...(id ? { id } : {}), code: 'bad_request', message: 'a setting is outside what this ADC supports' }); break; }
        if (s.data_rate_sps !== undefined) this.rate = s.data_rate_sps;
        if (s.full_scale_mv !== undefined) this.range = s.full_scale_mv;
        if (s.channel_order !== undefined) this.order = s.channel_order;
        this.settingsNo++;
        this.say(this.settingsMessage());
        break;
      }
      case 'start_stream':
        this.streaming = true; this.seq = 0; this.conv = 0; this.streamStart_s = this.uptime_s;
        this.say({ type: 'ack', id: id ?? 'r' }, { type: 'status', state: 'streaming' });
        if (this.o.auto) this.startTimer();
        break;
      case 'stop_stream':
        this.streaming = false; this.stopTimer();
        this.say({ type: 'ack', id: id ?? 'r' }, { type: 'status', state: 'idle' });
        break;
      default:
        this.say({ type: 'error', ...(id ? { id } : {}), code: 'unknown_request', message: 'unknown request' });
    }
  }

  private startTimer(): void {
    this.stopTimer();
    const period = 50;
    this.timer = setInterval(() => this.step(Math.max(1, Math.round(this.rate * period / 1000))), period);
  }
  private stopTimer(): void { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  /** Produces n conversions (one channel each, in the configured order) and sends them. */
  step(n: number): void {
    if (!this.streaming || !this.isOpen) return;
    const sig = this.o.signal, scale = this.o.timeUnit === 'us' ? 1e6 : 1e3;
    let text = '';
    for (let i = 0; i < n; i++) {
      const ch = this.order[this.conv % this.order.length] as string;
      this.conv++;
      this.uptime_s += 1 / this.rate;
      const m = this.o.motion(Math.max(0, this.uptime_s - this.streamStart_s - 1));   /* the pretend crosshead starts 1 s after the stream */
      const vMachine = ch === 'force' ? m.force_N * sig.volts_per_N : m.displacement_mm * sig.volts_per_mm;
      const vAdc = vMachine * sig.conditioningGain + (this.rnd() + this.rnd() + this.rnd() - 1.5) * this.o.noise_V * 2;
      let raw = Math.round(vAdc / (this.range / 1000) * 32768);
      const q: string[] = [];
      if (raw > 32767) { raw = 32767; q.push('overrange'); } else if (raw < -32768) { raw = -32768; q.push('overrange'); }
      const seq = this.seq++;
      if (this.drop > 0) { this.drop--; continue; }
      text += JSON.stringify({ v: this.o.protocolVersion, type: 'sample', boot_id: this.bootId, seq, t: Math.round(this.uptime_s * scale), ch, raw, ref: this.ref, ...(q.length ? { q } : {}) }) + '\n';
    }
    if (text) this.emitText(text);
  }

  /* ---------- trouble on demand, for tests and for trying the app's messages ---------- */
  /** The next n samples are lost on the way (their sequence numbers are skipped). */
  dropNext(n: number): void { this.drop += n; }
  /** The device restarts: new boot id, stream stopped, and it announces itself again. */
  restart(): void { this.boot++; this.streaming = false; this.stopTimer(); this.uptime_s = 0.4; this.say(this.hello()); }
  /** Sends arbitrary text, as a faulty device or a noisy line would. */
  injectText(text: string): void { this.emitText(text); }
  /** The cable is pulled. */
  unplug(): void {
    if (!this.isOpen) return;
    this.isOpen = false; this.stopTimer(); this.streaming = false;
    this.closeListener({ unexpected: true, reason: 'The simulated device was unplugged.' });
  }
}
