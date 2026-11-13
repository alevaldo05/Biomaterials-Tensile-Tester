/* A transport plus a device adapter, behind the common AcquisitionSource interface. It runs the identification
   exchange, keeps the connection state, and watches for lost samples, device restarts, stale data, and disconnects.
   It never reconnects by itself and never resends an old request after a reconnect. */
import { TransportError } from './types';
import type {
  AcquisitionRequest, AcquisitionSettings, AcquisitionSource, AdapterEvent, Channel, ConnectionState, DeviceAdapter, DeviceIdentity,
  Diagnostic, DiagnosticCode, SettingsChange, SourceEvents, SourceKind, Transport,
} from './types';

export interface DeviceSourceOptions {
  transport: Transport;
  adapter: DeviceAdapter;
  kind: SourceKind;
  /** Channels the experiment needs; connecting reports a problem when one is missing. */
  requiredQuantities?: ('force' | 'displacement')[];
  /** How long to wait for each answer while identifying. */
  answerTimeout_ms?: number;
  /** While streaming, no sample for this long means the data is stale. */
  stale_ms?: number;
  now?: () => number;
}

type Waiter = { want: AdapterEvent['kind']; resolve: (e: AdapterEvent) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

export const DIAGNOSTIC_TEXT: Record<DiagnosticCode, string> = {
  'unsupported-browser': 'This browser cannot open a USB serial connection. Use Chrome on a computer.',
  'no-port-selected': 'No port was selected.',
  'permission-denied': 'The browser was not allowed to use the port. Choose the port again and allow access.',
  'port-in-use': 'The port is already in use. Close other programs or browser tabs that use it (for example a serial monitor), then connect again.',
  'port-unavailable': 'The port could not be opened. Check the USB cable and that the device is powered. On Windows, a missing USB driver for the board can cause this.',
  'no-identification': 'The device did not identify itself. It may be the wrong port, a board without the acquisition firmware, or a missing USB driver.',
  'incompatible-protocol': 'The device speaks a protocol version this app does not support. Update the app or the device firmware so the versions match.',
  'no-adc-response': 'The device answered, but its ADC is not responding. Check the ADC wiring, power, and I²C address.',
  'missing-channels': 'The device does not offer every channel this test needs.',
  'device-reset': 'The device restarted. The recording was interrupted; data before the restart is kept.',
  disconnected: 'The connection was lost.',
  'invalid-data': 'Some received data could not be read and was skipped.',
  'samples-lost': 'Some samples were lost between the device and the app.',
  'request-refused': 'The device refused a request.',
  'device-fault': 'The device reported a fault.',
};

export class DeviceSource implements AcquisitionSource {
  readonly kind: SourceKind;
  private _state: ConnectionState = 'disconnected';
  private _identity: DeviceIdentity | null = null;
  private _channels: Channel[] = [];
  private _settings: AcquisitionSettings | null = null;
  private allSettings = new Map<string, AcquisitionSettings>();
  private _diagnostics: Diagnostic[] = [];
  private listeners: { [E in keyof SourceEvents]: Set<SourceEvents[E]> } = { state: new Set(), sample: new Set(), gap: new Set(), diagnostic: new Set(), settings: new Set(), line: new Set() };
  private waiters: Waiter[] = [];
  private lastSeq: number | null = null;
  private staleTimer: ReturnType<typeof setTimeout> | null = null;
  private wantStream = false;
  private rejectedCount = 0;
  private readonly transport: Transport;
  private readonly adapter: DeviceAdapter;
  private readonly opts: Required<Pick<DeviceSourceOptions, 'answerTimeout_ms' | 'stale_ms' | 'now'>> & Pick<DeviceSourceOptions, 'requiredQuantities'>;

  constructor(o: DeviceSourceOptions) {
    this.transport = o.transport; this.adapter = o.adapter; this.kind = o.kind;
    this.opts = { answerTimeout_ms: o.answerTimeout_ms ?? 3000, stale_ms: o.stale_ms ?? 2000, now: o.now ?? (() => Date.now()), requiredQuantities: o.requiredQuantities };
    this.transport.onData((chunk) => this.receive(chunk));
    this.transport.onClose((info) => this.closed(info));
  }

  get state(): ConnectionState { return this._state; }
  get identity(): DeviceIdentity | null { return this._identity; }
  get channels(): readonly Channel[] { return this._channels; }
  get settings(): AcquisitionSettings | null { return this._settings; }
  get diagnostics(): readonly Diagnostic[] { return this._diagnostics; }
  /** Lines that could not be read since connecting. */
  get rejectedLines(): number { return this.rejectedCount; }
  settingsFor(ref: string): AcquisitionSettings | undefined { return this.allSettings.get(ref); }

  on<E extends keyof SourceEvents>(event: E, listener: SourceEvents[E]): () => void {
    this.listeners[event].add(listener);
    return () => { this.listeners[event].delete(listener); };
  }
  private emit<E extends keyof SourceEvents>(event: E, ...args: Parameters<SourceEvents[E]>): void {
    for (const l of this.listeners[event]) (l as (...a: Parameters<SourceEvents[E]>) => void)(...args);
  }
  private setState(s: ConnectionState): void {
    if (s === this._state) return;
    const prev = this._state;
    this._state = s;
    this.emit('state', s, prev);
  }
  private diagnose(code: DiagnosticCode, extra = ''): Diagnostic {
    const d = { code, message: DIAGNOSTIC_TEXT[code] + (extra ? ' ' + extra : ''), at_ms: this.opts.now() };
    this._diagnostics.push(d);
    if (this._diagnostics.length > 200) this._diagnostics.shift();
    this.emit('diagnostic', d);
    return d;
  }

  async connect(): Promise<void> {
    if (this._state !== 'disconnected' && this._state !== 'fault') return;
    this._identity = null; this._channels = []; this._settings = null; this.allSettings.clear();
    this.lastSeq = null; this.rejectedCount = 0; this.wantStream = false;
    this.adapter.reset();
    this.setState('connecting');
    try {
      await this.transport.open();
    } catch (e) {
      const code = e instanceof TransportError ? e.code : 'port-unavailable';
      this.setState('disconnected');
      throw new TransportError(code, this.diagnose(code).message);
    }
    this.setState('identifying');
    try {
      const id = await this.ask({ type: 'identify' }, 'identity', 'no-identification');
      if (id.kind === 'identity') this._identity = id.identity;
      const ch = await this.ask({ type: 'get_channels' }, 'channels', 'no-identification');
      if (ch.kind === 'channels') this._channels = ch.channels;
      const missing = (this.opts.requiredQuantities ?? []).filter((q) => !this._channels.some((c) => c.quantity === q));
      if (missing.length) throw new TransportError('missing-channels', this.diagnose('missing-channels', 'Missing: ' + missing.join(', ') + '.').message);
      await this.ask({ type: 'get_settings' }, 'settings', 'no-adc-response');
    } catch (e) {
      await this.transport.close().catch(() => undefined);
      this.setState('fault');
      throw e;
    }
    this.setState('connected');
  }

  async disconnect(): Promise<void> {
    this.stopWatch();
    this.wantStream = false;
    this.failWaiters(new Error('Disconnected.'));
    await this.transport.close().catch(() => undefined);
    this.adapter.reset();
    this.setState('disconnected');
  }

  async startStream(): Promise<void> {
    if (this._state !== 'connected') throw new Error('Connect and identify the device before starting the stream.');
    this.lastSeq = null;
    await this.send({ type: 'start_stream' });
    this.wantStream = true;
    this.setState('streaming');
    this.watch();
  }
  async stopStream(): Promise<void> {
    if (this._state !== 'streaming' && this._state !== 'stale') return;
    this.wantStream = false;
    this.stopWatch();
    await this.send({ type: 'stop_stream' });
    this.setState('connected');
  }
  async changeSettings(change: SettingsChange): Promise<AcquisitionSettings> {
    if (this._state !== 'connected') throw new Error('Settings can be changed only while connected and not streaming.');
    const e = await this.ask({ type: 'set_settings', settings: change }, 'settings', 'request-refused');
    return (e as Extract<AdapterEvent, { kind: 'settings' }>).settings;
  }

  /** The only way anything is written to the device: an acquisition request, encoded by the adapter. */
  private async send(request: AcquisitionRequest): Promise<void> {
    const bytes = this.adapter.encode(request);
    if (bytes) await this.transport.write(bytes);
  }
  private ask(request: AcquisitionRequest, want: AdapterEvent['kind'], onTimeout: DiagnosticCode): Promise<AdapterEvent> {
    return new Promise<AdapterEvent>((resolve, reject) => {
      const w: Waiter = { want, resolve, reject, timer: setTimeout(() => {
        this.waiters = this.waiters.filter((x) => x !== w);
        reject(new TransportError(onTimeout, this.diagnose(onTimeout).message));
      }, this.opts.answerTimeout_ms) };
      this.waiters.push(w);
      this.send(request).catch((e: unknown) => { clearTimeout(w.timer); this.waiters = this.waiters.filter((x) => x !== w); reject(e instanceof Error ? e : new Error(String(e))); });
    });
  }
  private failWaiters(err: Error): void {
    for (const w of this.waiters) { clearTimeout(w.timer); w.reject(err); }
    this.waiters = [];
  }
  private settle(e: AdapterEvent): void {
    const i = this.waiters.findIndex((w) => w.want === e.kind);
    if (i < 0) return;
    const w = this.waiters[i] as Waiter;
    this.waiters.splice(i, 1);
    clearTimeout(w.timer);
    w.resolve(e);
  }

  private watch(): void {
    this.stopWatch();
    this.staleTimer = setTimeout(() => { if (this._state === 'streaming') this.setState('stale'); }, this.opts.stale_ms);
  }
  private stopWatch(): void { if (this.staleTimer) { clearTimeout(this.staleTimer); this.staleTimer = null; } }

  private receive(chunk: Uint8Array): void {
    const at = this.opts.now();
    for (const e of this.adapter.receive(chunk)) {
      if ('raw' in e && e.raw !== undefined) this.emit('line', e.raw, at);
      switch (e.kind) {
        case 'rejected':
          this.rejectedCount++;
          if (e.problem === 'unsupported-version' && this._state === 'identifying') {
            const err = new TransportError('incompatible-protocol', this.diagnose('incompatible-protocol', e.detail).message);
            this.failWaiters(err);
          } else if (this.rejectedCount === 1 || this.rejectedCount % 100 === 0) this.diagnose('invalid-data', e.detail + ' (' + this.rejectedCount + ' so far)');
          break;
        case 'identity':
          if (this._identity && e.identity.bootId !== this._identity.bootId) this.deviceRestarted();
          else this.settle(e);
          break;
        case 'channels': this.settle(e); break;
        case 'settings':
          this.allSettings.set(e.settings.ref, e.settings);
          this._settings = e.settings;
          this.emit('settings', e.settings);
          this.settle(e);
          break;
        case 'sample': this.sample(e.sample, at); break;
        case 'status': break;
        case 'ack': break;
        case 'fault':
          this.diagnose(e.code === 'adc_not_responding' ? 'no-adc-response' : 'device-fault', e.message);
          if (e.code === 'adc_not_responding' && this._state === 'identifying') this.failWaiters(new TransportError('no-adc-response', DIAGNOSTIC_TEXT['no-adc-response']));
          else if (this._state === 'streaming' || this._state === 'stale') { this.stopWatch(); this.wantStream = false; this.setState('fault'); }
          break;
        case 'refused':
          this.diagnose(e.code === 'unsupported_version' ? 'incompatible-protocol' : 'request-refused', e.message);
          if (this.waiters.length) this.failWaiters(new TransportError(e.code === 'unsupported_version' ? 'incompatible-protocol' : 'request-refused', e.message));
          break;
      }
    }
  }

  private sample(s: Extract<AdapterEvent, { kind: 'sample' }>['sample'], at: number): void {
    if (!this._identity || !this.wantStream) return;   /* samples are only accepted from an identified device that was asked to stream */
    if (s.bootId !== this._identity.bootId) { this.deviceRestarted(); return; }
    if (!this._channels.some((c) => c.id === s.channelId)) {
      this.rejectedCount++;
      if (this.rejectedCount === 1 || this.rejectedCount % 100 === 0) this.diagnose('invalid-data', 'A sample named the unknown channel "' + s.channelId + '".');
      return;
    }
    if (this.lastSeq !== null) {
      if (s.seq > this.lastSeq + 1) {
        const gap = { channelIndependent: true as const, afterSeq: this.lastSeq, beforeSeq: s.seq, missing: s.seq - this.lastSeq - 1, at_ms: at };
        this.emit('gap', gap);
        this.diagnose('samples-lost', gap.missing + ' missing after sample ' + gap.afterSeq + '.');
      } else if (s.seq <= this.lastSeq) {
        this.rejectedCount++;
        this.diagnose('invalid-data', 'Sample ' + s.seq + ' arrived after sample ' + this.lastSeq + ' and was skipped.');
        return;
      }
    }
    this.lastSeq = s.seq;
    if (this._state === 'stale') this.setState('streaming');
    if (this._state === 'streaming') this.watch();
    this.emit('sample', { ...s, sourceKind: this.kind, deviceId: this._identity.deviceId, receivedAt_ms: at });
  }

  private deviceRestarted(): void {
    this.stopWatch();
    this.wantStream = false;
    this.diagnose('device-reset');
    this.setState('fault');
  }

  private closed(info: { unexpected: boolean; reason: string }): void {
    this.stopWatch();
    this.wantStream = false;
    this.adapter.reset();
    this.failWaiters(new TransportError('disconnected', DIAGNOSTIC_TEXT.disconnected));
    if (info.unexpected) { this.diagnose('disconnected', info.reason); this.setState('disconnected'); }
  }
}
