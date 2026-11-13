/* The acceptance checks for acquisition and recording. Each "describe" is one of the promises in docs/app/ARCHITECTURE.md. */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeviceSource, NdjsonAdapter, ReplayTransport, SimulatedDevice, TransportError } from '@tensile/acquisition';
import type { AcquisitionRequest, AdapterEvent, DeviceAdapter, StandardSample, Transport } from '@tensile/acquisition';
import { createMachineControl, MOTION_OPERATIONS } from '@tensile/machine-control';
import { achievedRate, Recorder, sessionToTestRecord, simulatedCalibrations, simulatedProfile } from '../src/index';
import { clock, runUniaxial, simulated, SPECIMEN } from './helpers';

const EXPECTED_UTS = 0.4 * (Math.exp(9 * 0.33) - 1);   /* MPa, from the simulator's made-up curve */
afterEach(() => { vi.useRealTimers(); });

describe('the same interface processes simulated records from different device types', () => {
  it.each([
    ['esp32', 'us'], ['pico', 'us'], ['raspberry-pi-service', 'ms'],
  ] as const)('%s', async (deviceType, timeUnit) => {
    const { device, source } = simulated({ deviceType, timeUnit, deviceId: deviceType + '-01' });
    const r = await runUniaxial(source, () => device.step(2600));
    expect(source.identity?.deviceType).toBe(deviceType);
    expect(r.record.source).toBe('simulated');
    expect(r.analysis.uts.y).toBeGreaterThan(EXPECTED_UTS * 0.98);
    expect(r.analysis.uts.y).toBeLessThan(EXPECTED_UTS * 1.02);
    expect(r.analysis.uts.x).toBeCloseTo(0.33, 1);
    expect(r.analysis.detected).toBe(true);
    expect(r.session.identity.deviceType).toBe(deviceType);
    expect(r.session.missingSamples).toBe(0);
  });
});

describe('fragmented serial messages are reconstructed correctly', () => {
  it('gives exactly the same samples whether the bytes arrive whole or in pieces of 1, 7, or 64', async () => {
    const run = async (chunkSize: number) => {
      const { device, source } = simulated({ chunkSize, seed: 5 });
      const got: StandardSample[] = [];
      source.on('sample', (s) => got.push({ ...s, receivedAt_ms: 0 }));
      await source.connect();
      await source.startStream();
      device.step(400);
      expect(source.rejectedLines).toBe(0);
      return got;
    };
    const whole = await run(0);
    expect(whole.length).toBe(400);
    for (const size of [1, 7, 64]) expect(await run(size)).toEqual(whole);
  });
});

describe('invalid data, incompatible versions, resets, and disconnects are handled', () => {
  it('skips unreadable, oversized, wrong-version, and wrong-shape lines and keeps recording', async () => {
    const { device, source } = simulated();
    await source.connect();
    const recorder = new Recorder({ source, profile: simulatedProfile(), calibrations: simulatedCalibrations(source), appVersion: 'test' });
    await source.startStream();
    const session = recorder.start();
    device.step(100);
    device.injectText('1250,12.84,0.625\n');
    device.injectText('x'.repeat(5000) + '\n');
    device.injectText('{"v":2,"type":"sample","boot_id":"simboot-1","seq":100,"t":1,"ch":"force","raw":1,"ref":"sim-s1"}\n');
    device.injectText('{"v":1,"type":"sample","boot_id":"simboot-1","seq":100,"t":1,"ch":"force","raw":1.5,"ref":"sim-s1"}\n');
    device.injectText('{"v":1,"type":"sample","boot_id":"simboot-1","seq":100,"t":1,"ch":"torque","raw":1,"ref":"sim-s1"}\n');
    device.injectText('{"v":1,"type":"sample","boot_id":"simboot-1","seq":100,"t":1,"ch":"force","raw":null,"ref":"sim-s1"}\n{"half":');
    device.step(100);
    expect(source.rejectedLines).toBe(7);   /* the six lines above, and the half line joined to the next sample */
    expect(source.state).toBe('streaming');
    const n = Object.values(session.columns).reduce((a, c) => a + c.raw.length, 0);
    expect(n).toBe(199);
    expect(session.missingSamples).toBe(1);
    expect(source.diagnostics.some((d) => d.code === 'invalid-data')).toBe(true);
  });
  it('refuses a device that speaks another protocol version', async () => {
    const { source } = simulated({ protocolVersion: 2 });
    await expect(source.connect()).rejects.toMatchObject({ code: 'incompatible-protocol' });
    expect(source.state).toBe('fault');
    expect(source.identity).toBeNull();
  });
  it('says so when nothing identifies itself, when the ADC is silent, and when a channel is missing', async () => {
    vi.useFakeTimers();
    const quiet = simulated({ silent: true });
    const p = quiet.source.connect();
    const failed = expect(p).rejects.toMatchObject({ code: 'no-identification' });
    await vi.advanceTimersByTimeAsync(3100);
    await failed;
    vi.useRealTimers();
    await expect(simulated({ adcMissing: true }).source.connect()).rejects.toMatchObject({ code: 'no-adc-response' });
    await expect(simulated({ omitDisplacement: true }).source.connect()).rejects.toMatchObject({ code: 'missing-channels' });
  });
  it('notices lost samples and records where they were', async () => {
    const { device, source } = simulated();
    const r = await runUniaxial(source, () => { device.step(1000); device.dropNext(6); device.step(1600); });
    expect(r.session.missingSamples).toBe(6);
    expect(r.session.gaps).toHaveLength(1);
    expect(r.session.gaps[0]).toMatchObject({ afterSeq: 999, beforeSeq: 1006, missing: 6 });
    expect(r.session.events.some((e) => e.kind === 'gap')).toBe(true);
  });
  it('ends the recording when the device restarts, keeps the data, and does not resume by itself', async () => {
    const { device, source } = simulated();
    await source.connect();
    const recorder = new Recorder({ source, profile: simulatedProfile(), calibrations: simulatedCalibrations(source), appVersion: 'test' });
    await source.startStream();
    const session = recorder.start();
    device.step(300);
    const written = device.written.length;
    device.restart();
    expect(source.state).toBe('fault');
    expect(recorder.recording).toBe(false);
    expect(session.interrupted).toBe(true);
    expect(session.events.some((e) => e.kind === 'device-reset')).toBe(true);
    expect(Object.values(session.columns).reduce((a, c) => a + c.raw.length, 0)).toBe(300);
    expect(device.written.length).toBe(written);   /* nothing was resent to the restarted device */
  });
  it('ends the recording when the cable is pulled, and keeps the data', async () => {
    const { device, source } = simulated();
    await source.connect();
    const recorder = new Recorder({ source, profile: simulatedProfile(), calibrations: simulatedCalibrations(source), appVersion: 'test' });
    await source.startStream();
    const session = recorder.start();
    device.step(200);
    device.injectText('{"v":1,"type":"sample","boot_id":"simboot-1","seq":200,"t":9');   /* cut off mid-message */
    device.unplug();
    expect(source.state).toBe('disconnected');
    expect(recorder.state()).toBe('disconnected');
    expect(session.interrupted).toBe(true);
    expect(session.endReason).toContain('kept');
    expect(Object.values(session.columns).reduce((a, c) => a + c.raw.length, 0)).toBe(200);
    await source.connect();   /* a new connection starts clean: the half message is not glued to new data */
    await source.startStream();
    device.step(10);
    expect(source.rejectedLines).toBe(0);
  });
  it('marks the data stale when samples stop, and recovers when they return', async () => {
    vi.useFakeTimers();
    const { device, source } = simulated();
    await source.connect();
    const recorder = new Recorder({ source, profile: simulatedProfile(), calibrations: simulatedCalibrations(source), appVersion: 'test' });
    await source.startStream();
    recorder.start();
    device.step(10);
    await vi.advanceTimersByTimeAsync(2100);
    expect(recorder.state()).toBe('stale');
    device.step(10);
    expect(recorder.state()).toBe('recording');
    expect(recorder.session?.events.map((e) => e.kind)).toEqual(['stale', 'resumed']);
  });
});

describe('missing calibration prevents falsely labeled engineering measurements', () => {
  it('shows volts only, refuses to record as ready, and never builds stress or strain', async () => {
    const { device, source } = simulated();
    await source.connect();
    const recorder = new Recorder({ source, profile: simulatedProfile(), calibrations: [], appVersion: 'test' });
    expect(recorder.state()).toBe('connected-uncalibrated');
    await source.startStream();
    expect(() => recorder.start()).toThrow('no force calibration');
    const session = recorder.start({ allowUncalibrated: true });
    device.step(400);
    recorder.stop();
    expect(recorder.latest.force).toMatchObject({ value: null, unit: null });
    expect(recorder.latest.force?.volts_adc).toBeTypeOf('number');
    expect(session.calibrated).toBe(false);
    expect(session.columns.force?.unit).toBeNull();
    expect(session.columns.force?.value.every((v) => Number.isNaN(v))).toBe(true);
    expect(session.columns.force?.raw.length).toBe(200);
    expect(sessionToTestRecord(session, { test: 'uniaxial', specimen: SPECIMEN })).toMatchObject({ ok: false });
  });
  it('does not reuse a calibration after the signal path changes, even though the channel names are the same', async () => {
    const { source } = simulated();
    await source.connect();
    const calibrations = simulatedCalibrations(source);
    const recorder = new Recorder({ source, profile: simulatedProfile(), calibrations, appVersion: 'test' });
    expect(recorder.state()).toBe('ready');
    await source.changeSettings({ fullScale_mV: 2048 });
    const r = recorder.readiness();
    expect(r.ready).toBe(false);
    expect(r.channels.force.reasons.join(' ')).toContain('ADC input range changed');
    expect(recorder.state()).toBe('connected-uncalibrated');
    /* a different board with the same channel names */
    const other = simulated({ deviceType: 'pico' });
    await other.source.connect();
    const r2 = new Recorder({ source: other.source, profile: simulatedProfile(), calibrations, appVersion: 'test' }).readiness();
    expect(r2.ready).toBe(false);
    expect(r2.channels.force.reasons.join(' ')).toContain('device type changed');
  });
  it('refuses the simulator calibration for a real device', async () => {
    const sim = simulated();
    await sim.source.connect();
    const calibrations = simulatedCalibrations(sim.source);
    const real = new DeviceSource({ transport: new SimulatedDevice({ auto: false }), adapter: new NdjsonAdapter(), kind: 'real', now: clock() });
    await real.connect();
    expect(simulatedCalibrations(real)).toEqual([]);
    const r = new Recorder({ source: real, profile: simulatedProfile(), calibrations, appVersion: 'test' }).readiness();
    expect(r.ready).toBe(false);
    expect(r.channels.force.reasons.join(' ')).toContain('made up for the simulator');
  });
  it('needs dimensions before stress and strain', async () => {
    const { device, source } = simulated();
    const r = await runUniaxial(source, () => device.step(600));
    expect(sessionToTestRecord(r.session, { test: 'uniaxial', specimen: { L0_mm: 0, width_mm: 5, thickness_mm: 1 } })).toMatchObject({ ok: false });
  });
});

describe('unsupported motion requests transmit no bytes', () => {
  it('writes nothing to the device for any motion request, connected or streaming', async () => {
    const { device, source } = simulated();
    const mc = createMachineControl({ motion: true });
    await source.connect();
    await source.startStream();
    const before = device.written.length, bytes = device.written.reduce((a, b) => a + b.length, 0);
    for (const op of MOTION_OPERATIONS) expect((await mc.request(op, { speed_mm_min: 5, position_mm: 1 })).ok).toBe(false);
    expect(device.written.length).toBe(before);
    expect(device.written.reduce((a, b) => a + b.length, 0)).toBe(bytes);
  });
  it('everything ever written to a device is one of the six acquisition requests', async () => {
    const { device, source } = simulated();
    await runUniaxial(source, () => device.step(300));
    await source.changeSettings({ dataRate_sps: 250 });
    await source.disconnect();
    const types = device.written.map((b) => (JSON.parse(new TextDecoder().decode(b)) as { type: string }).type);
    expect(new Set(types)).toEqual(new Set(['identify', 'get_channels', 'get_settings', 'start_stream', 'stop_stream', 'set_settings']));
    expect(new TextDecoder().decode(device.written.reduce((a, b) => new Uint8Array([...a, ...b]), new Uint8Array()))).not.toMatch(/START|STOP|TARE|PING/);
  });
});

/* A device with a completely different wire format: comma-separated text, times in tenths of a millisecond,
   no JSON. Supporting it takes this adapter and nothing else. */
class CsvCountsAdapter implements DeviceAdapter {
  readonly protocol = 'other-vendor-csv/3';
  private buffer = '';
  private dec = new TextDecoder();
  receive(chunk: Uint8Array): AdapterEvent[] {
    this.buffer += this.dec.decode(chunk, { stream: true });
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    return lines.filter((l) => l).map((l): AdapterEvent => {
      const p = l.split(',');
      if (p[0] === 'ID') return { kind: 'identity', identity: { deviceId: p[1]!, deviceType: p[2]!, softwareVersion: p[3]!, protocol: this.protocol, bootId: p[4]! } };
      if (p[0] === 'CH') return { kind: 'channels', channels: [
        { id: 'A', quantity: 'force', mode: 'single-ended', input: 'AIN0', encoding: 'int16' }, { id: 'B', quantity: 'displacement', mode: 'single-ended', input: 'AIN1', encoding: 'int16' }] };
      if (p[0] === 'CFG') return { kind: 'settings', settings: { ref: p[1]!, adc: 'ads1115', bits: 16, fullScale_mV: Number(p[2]), dataRate_sps: Number(p[3]), channelOrder: ['A', 'B'] } };
      if (p[0] === 'D') return { kind: 'sample', sample: { bootId: p[1]!, seq: Number(p[2]), channelId: p[4]!, deviceTime_s: Number(p[3]) / 10000, raw: Number(p[5]), settingsRef: p[6]!, quality: [] } };
      return { kind: 'rejected', problem: 'invalid', detail: 'unknown line' };
    });
  }
  reset(): void { this.buffer = ''; }
  encode(r: AcquisitionRequest): Uint8Array | null {
    const word = r.type === 'identify' ? '?I' : r.type === 'get_channels' ? '?C' : r.type === 'get_settings' ? '?S' : r.type === 'start_stream' ? 'GO' : r.type === 'stop_stream' ? 'HALT' : null;
    return word ? new TextEncoder().encode(word + '\n') : null;
  }
}
/* The pretend other-vendor device: it wraps the simulator's physics but speaks the CSV format above. */
class CsvDevice implements Transport {
  readonly label = 'other vendor';
  private inner = new SimulatedDevice({ auto: false, deviceType: 'other-board' });
  private listener: (c: Uint8Array) => void = () => undefined;
  constructor() {
    this.inner.onData((chunk) => {
      const out = new TextDecoder().decode(chunk).split('\n').filter((l) => l).map((l) => {
        const m = JSON.parse(l) as Record<string, unknown> & { confirmed?: Record<string, unknown> };
        if (m.type === 'hello') return `ID,${m.device_id},${m.device_type},${m.sw_version},${m.boot_id}`;
        if (m.type === 'channels') return 'CH';
        if (m.type === 'settings') return `CFG,${m.confirmed!.settings_ref},${m.confirmed!.full_scale_mv},${m.confirmed!.data_rate_sps}`;
        if (m.type === 'sample') return `D,${m.boot_id},${m.seq},${Number(m.t) / 100},${m.ch === 'force' ? 'A' : 'B'},${m.raw},${m.ref}`;
        return '';
      }).filter((l) => l);
      if (out.length) this.listener(new TextEncoder().encode(out.join('\n') + '\n'));
    });
  }
  step(n: number) { this.inner.step(n); }
  onData(l: (c: Uint8Array) => void) { this.listener = l; }
  onClose() { /* never closes by itself */ }
  open() { return this.inner.open(); }
  close() { return this.inner.close(); }
  async write(b: Uint8Array) {
    const w = new TextDecoder().decode(b).trim();
    const type = { '?I': 'identify', '?C': 'get_channels', '?S': 'get_settings', GO: 'start_stream', HALT: 'stop_stream' }[w];
    await this.inner.write(new TextEncoder().encode(JSON.stringify({ v: 1, type, id: 'x' }) + '\n'));
  }
}

describe('replacing a device adapter does not require changing graph or experiment code', () => {
  it('runs the same experiment code through a different adapter and gets the same result', async () => {
    const a = simulated({ deviceType: 'other-board' });
    const viaNdjson = await runUniaxial(a.source, () => a.device.step(2600));
    const device = new CsvDevice();
    const source = new DeviceSource({ transport: device, adapter: new CsvCountsAdapter(), kind: 'simulated', now: clock(), requiredQuantities: ['force', 'displacement'] });
    const profile = { id: 'other', name: 'other', channels: { A: simulatedProfile().channels.force!, B: simulatedProfile().channels.displacement! } };
    await source.connect();
    /* the calibration records are the simulator's; only the channel ids in the profile differ (A and B) */
    const recorder = new Recorder({ source, profile, calibrations: simulatedCalibrations(a.source), appVersion: 'test' });
    await source.startStream();
    const session = recorder.start();
    device.step(2600);
    recorder.stop();
    const built = sessionToTestRecord(session, { test: 'uniaxial', specimen: SPECIMEN });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(source.identity?.protocol).toBe('other-vendor-csv/3');
    expect(built.record.raw!.F.length).toBe(viaNdjson.record.raw!.F.length);
    expect(built.record.raw!.F).toEqual(viaNdjson.record.raw!.F);
    for (let i = 0; i < built.record.x.length; i += 97) expect(built.record.x[i]).toBeCloseTo(viaNdjson.record.x[i]!, 9);
  });

  it('calculation, recording, and screen code never import a device adapter, a transport, or the wire protocol', () => {
    const root = path.resolve(import.meta.dirname, '../..');
    const files = (dir: string): string[] => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (e.name === 'node_modules' || e.name === 'test' ? [] : files(path.join(dir, e.name))) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []) : []);
    const importsOf = (f: string) => [...fs.readFileSync(f, 'utf8').matchAll(/^\s*(import|export)\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => ({ typeOnly: !!m[2], from: m[3]! }));
    const problems: string[] = [];
    for (const f of [...files(path.join(root, 'core/src')), ...files(path.join(root, 'recording/src')), ...files(path.join(root, 'ui/src'))]) {
      const rel = path.relative(root, f);
      for (const imp of importsOf(f)) {
        if (/@tensile\/protocol|\/adapters\/|\/transports\//.test(imp.from)) problems.push(rel + ' imports ' + imp.from);
        if (rel.startsWith('core') && /@tensile\/(acquisition|recording|machine-control)/.test(imp.from)) problems.push(rel + ' imports ' + imp.from);
        if (/recording\/src\/(recorder|conversion|test-record)\.ts$/.test(rel) && imp.from === '@tensile/acquisition' && !imp.typeOnly) problems.push(rel + ' uses more than the types of ' + imp.from);
      }
    }
    expect(problems).toEqual([]);
    expect(files(path.join(root, 'core/src')).length).toBeGreaterThan(5);
  });
});

describe('recorded-data replay', () => {
  it('replays a recorded session through the same interface and gives the same record, labeled as replayed', async () => {
    const { device, source } = simulated();
    const log: string[] = [];
    source.on('line', (l) => log.push(l));
    const first = await runUniaxial(source, () => device.step(2600));
    const replay = new ReplayTransport({ lines: log, auto: false });
    const again = new DeviceSource({ transport: replay, adapter: new NdjsonAdapter(), kind: 'replayed', now: clock() });
    const second = await runUniaxial(again, () => replay.play(1e9), true);
    expect(again.kind).toBe('replayed');
    expect(second.record.source).toBe('loaded');
    expect(second.record.simulated).toBe(true);
    expect(second.record.raw).toEqual(first.record.raw);
    expect(second.analysis.uts).toEqual(first.analysis.uts);
  });
  it('refuses a file that is not a recorded session', async () => {
    const src = new DeviceSource({ transport: new ReplayTransport({ lines: ['time_s,force_N', '0,1'] }), adapter: new NdjsonAdapter(), kind: 'replayed' });
    await expect(src.connect()).rejects.toBeInstanceOf(TransportError);
  });
});

describe('timing is kept as it happened', () => {
  it('keeps device time and computer time apart, and reports the rate actually achieved per channel', async () => {
    const { device, source } = simulated({ dataRate_sps: 128 });
    const r = await runUniaxial(source, () => device.step(1280));
    const f = r.session.columns.force!, d = r.session.columns.displacement!;
    expect(achievedRate(f)).toBeCloseTo(64, 3);   /* two channels share the ADC, so each gets half its conversion rate */
    expect(achievedRate(d)).toBeCloseTo(64, 3);
    expect(f.deviceTime_s[0]).not.toBe(d.deviceTime_s[0]);   /* the two channels are not sampled at the same instant */
    expect(f.deviceTime_s[0]).toBeGreaterThan(5);
    expect(f.receivedAt_ms[0]).toBeGreaterThan(1_000_000);
    expect(r.record.raw!.t![0]).toBe(0);
  });
});
