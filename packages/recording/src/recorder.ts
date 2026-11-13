/* The recorder. It listens to an acquisition source and keeps every sample of a session: the raw count, the
   converted values, both timestamps, the settings in force, and what went wrong (lost samples, faults, a device
   restart, a disconnect). It does not know which device or transport is behind the source, and it does not depend
   on the graph: the screen may draw fewer points, but nothing recorded is thrown away.
   "Start recording" and "Stop recording" here only start and stop saving samples. They move nothing. */
import type { AcquisitionSettings, AcquisitionSource, Channel, ConnectionState, DeviceIdentity, Gap, Quantity, SourceKind, StandardSample } from '@tensile/acquisition';
import { calibrationCompatibility, convert, signalPathOf } from './conversion';
import type { CalibrationRecord, DeviceProfile, SignalPath } from './conversion';

export type Measured = Exclude<Quantity, 'voltage'>;

export interface ChannelReadiness {
  quantity: Measured;
  channelId: string | null;
  calibrated: boolean;
  calibrationId: string | null;
  /** Why the channel cannot give a physical value, in plain words. Empty when calibrated. */
  reasons: string[];
}
export interface Readiness {
  /** True when both force and displacement give calibrated physical values. */
  ready: boolean;
  channels: Record<Measured, ChannelReadiness>;
}

/** The states the screens show. */
export type SessionState = 'disconnected' | 'connecting' | 'identifying' | 'connected-uncalibrated' | 'ready' | 'recording' | 'stale' | 'fault';

export interface ChannelColumns {
  channelId: string;
  quantity: Quantity;
  seq: number[];
  /** Device time of each conversion, s. */
  deviceTime_s: number[];
  /** Computer time each sample arrived, ms. */
  receivedAt_ms: number[];
  raw: number[];
  settingsRef: string[];
  volts_adc: number[];
  /** NaN where unavailable (written as an empty cell, never as zero). */
  volts_signal: number[];
  value: number[];
  unit: 'N' | 'mm' | null;
  quality: (string[] | null)[];
}

export interface SessionEvent { at_ms: number; kind: 'gap' | 'fault' | 'stale' | 'resumed' | 'device-reset' | 'disconnected' | 'zero-force'; detail: string }

export interface Session {
  sourceKind: SourceKind;
  startedAt_ms: number;
  endedAt_ms: number | null;
  endReason: string;
  /** True when the recording ended because of a fault, a device restart, or a disconnect. */
  interrupted: boolean;
  identity: DeviceIdentity;
  appVersion: string;
  profileId: string | null;
  channels: Channel[];
  /** Every settings record in force during the session, by ref. */
  settings: Record<string, AcquisitionSettings>;
  calibrations: Partial<Record<Measured, { id: string; origin: CalibrationRecord['origin']; slope: number; offset: number; unit: 'N' | 'mm'; signalPath: SignalPath }>>;
  calibrated: boolean;
  /** Software zero taken from the force reading (not a calibration), N; subtracted when the test record is built. */
  forceZero_N: number;
  columns: Record<string, ChannelColumns>;
  gaps: Gap[];
  missingSamples: number;
  events: SessionEvent[];
}

export interface LiveValue {
  channelId: string;
  /** Null when there is no compatible calibration. */
  value: number | null;
  unit: 'N' | 'mm' | null;
  volts_adc: number;
  volts_signal: number | null;
  deviceTime_s: number;
  receivedAt_ms: number;
}

export interface RecorderOptions {
  source: AcquisitionSource;
  profile: DeviceProfile | null;
  calibrations: CalibrationRecord[];
  appVersion: string;
  now?: () => number;
}

interface Route { channel: Channel; settings: AcquisitionSettings; cal: CalibrationRecord | undefined; conditioning: DeviceProfile['channels'][string]['conditioning'] | undefined }

export class Recorder {
  private readonly source: AcquisitionSource;
  private profile: DeviceProfile | null;
  private calibrations: CalibrationRecord[];
  private readonly now: () => number;
  private readonly appVersion: string;
  private routes = new Map<string, Route | null>();
  private _session: Session | null = null;
  private _recording = false;
  private unsubscribe: (() => void)[] = [];
  /** The newest value of each quantity, for the measurement strip. Missing means no sample yet. */
  readonly latest: Partial<Record<Quantity, LiveValue>> = {};

  constructor(o: RecorderOptions) {
    this.source = o.source; this.profile = o.profile; this.calibrations = o.calibrations; this.appVersion = o.appVersion;
    this.now = o.now ?? (() => Date.now());
    this.unsubscribe.push(
      o.source.on('sample', (s) => this.onSample(s)),
      o.source.on('gap', (g) => this.onGap(g)),
      o.source.on('settings', () => this.routes.clear()),
      o.source.on('state', (s, prev) => this.onState(s, prev)),
    );
  }
  /** Stops listening to the source. */
  dispose(): void { this.unsubscribe.forEach((u) => u()); this.unsubscribe = []; }

  get recording(): boolean { return this._recording; }
  get session(): Session | null { return this._session; }

  /** A hardware or signal-path change means new records here; nothing is carried over by name alone. */
  setCalibration(profile: DeviceProfile | null, calibrations: CalibrationRecord[]): void {
    if (this._recording) throw new Error('The calibration cannot be changed while recording.');
    this.profile = profile; this.calibrations = calibrations; this.routes.clear();
  }

  private routeFor(channelId: string, settingsRef: string): Route | null {
    const key = channelId + '\n' + settingsRef;
    const hit = this.routes.get(key);
    if (hit !== undefined) return hit;
    const channel = this.source.channels.find((c) => c.id === channelId), settings = this.source.settingsFor(settingsRef), identity = this.source.identity;
    let route: Route | null = null;
    if (channel && settings && identity) {
      const conditioning = this.profile?.channels[channelId]?.conditioning;
      const cal = conditioning && channel.quantity !== 'voltage'
        ? this.calibrations.find((c) => c.quantity === channel.quantity && calibrationCompatibility(c, signalPathOf(identity, channel, settings, conditioning), this.source.kind).compatible)
        : undefined;
      route = { channel, settings, cal, conditioning };
    }
    this.routes.set(key, route);
    return route;
  }

  readiness(): Readiness {
    const one = (quantity: Measured): ChannelReadiness => {
      const channel = this.source.channels.find((c) => c.quantity === quantity), settings = this.source.settings, identity = this.source.identity;
      const r: ChannelReadiness = { quantity, channelId: channel ? channel.id : null, calibrated: false, calibrationId: null, reasons: [] };
      if (!identity || !settings) { r.reasons.push('No device is connected.'); return r; }
      if (!channel) { r.reasons.push('The device has no ' + quantity + ' channel.'); return r; }
      const conditioning = this.profile?.channels[channel.id]?.conditioning;
      if (!conditioning) { r.reasons.push('The device profile does not describe the conditioning circuit for this channel.'); return r; }
      const candidates = this.calibrations.filter((c) => c.quantity === quantity);
      if (!candidates.length) { r.reasons.push('There is no ' + quantity + ' calibration.'); return r; }
      const path = signalPathOf(identity, channel, settings, conditioning);
      for (const c of candidates) {
        const k = calibrationCompatibility(c, path, this.source.kind);
        if (k.compatible) { r.calibrated = true; r.calibrationId = c.id; r.reasons = []; return r; }
        r.reasons = ['Calibration "' + c.id + '" needs review before it can be used:'].concat(k.reasons);
      }
      return r;
    };
    const channels = { force: one('force'), displacement: one('displacement') };
    return { ready: channels.force.calibrated && channels.displacement.calibrated, channels };
  }

  /** The one state the screens show, from the connection and the recorder together. */
  state(): SessionState {
    const s: ConnectionState = this.source.state;
    if (s === 'disconnected' || s === 'connecting' || s === 'identifying' || s === 'fault' || s === 'stale') return s;
    if (this._recording) return 'recording';
    return this.readiness().ready ? 'ready' : 'connected-uncalibrated';
  }

  /** Starts saving samples. Refused unless the device is streaming and both channels are calibrated, or
      allowUncalibrated is set, in which case the session holds voltages only and can never be reported in N or MPa. */
  start(o: { allowUncalibrated?: boolean } = {}): Session {
    if (this._recording) throw new Error('A recording is already running.');
    const identity = this.source.identity;
    if (!identity || this.source.state !== 'streaming') throw new Error('Recording needs a connected device that is sending data.');
    const ready = this.readiness();
    if (!ready.ready && !o.allowUncalibrated) throw new Error('Recording is not available: ' + [...ready.channels.force.reasons, ...ready.channels.displacement.reasons].join(' '));
    const session: Session = {
      sourceKind: this.source.kind, startedAt_ms: this.now(), endedAt_ms: null, endReason: '', interrupted: false, identity, appVersion: this.appVersion,
      profileId: this.profile ? this.profile.id : null, channels: this.source.channels.slice(), settings: {}, calibrations: {}, calibrated: ready.ready,
      forceZero_N: this.pendingZero, columns: {}, gaps: [], missingSamples: 0, events: [],
    };
    for (const q of ['force', 'displacement'] as const) {
      const id = ready.channels[q].calibrationId, c = id ? this.calibrations.find((x) => x.id === id) : undefined;
      if (c) session.calibrations[q] = { id: c.id, origin: c.origin, slope: c.slope, offset: c.offset, unit: c.unit, signalPath: c.signalPath };
    }
    this._session = session;
    this._recording = true;
    return session;
  }

  stop(reason = 'Recording stopped by the user.'): Session | null {
    if (!this._recording || !this._session) return this._session;
    this._recording = false;
    this._session.endedAt_ms = this.now();
    this._session.endReason = reason;
    return this._session;
  }

  /** Takes the current force reading as zero for this session. A software offset, written into the session; not a calibration,
      and nothing is sent to the device or the tester. */
  zeroForce(): number | null {
    const f = this.latest.force;
    if (!f || f.value === null || this._recording) return null;
    this.pendingZero = f.value;
    return f.value;
  }
  private pendingZero = 0;
  get forceZero_N(): number { return this.pendingZero; }
  /** Clears the software baseline (a new specimen starts without one). */
  zeroForceReset(): void { if (!this._recording) this.pendingZero = 0; }

  private note(kind: SessionEvent['kind'], detail: string): void {
    if (this._session && this._recording) this._session.events.push({ at_ms: this.now(), kind, detail });
  }

  private onSample(s: StandardSample): void {
    const route = this.routeFor(s.channelId, s.settingsRef);
    if (!route) return;   /* a sample whose channel or settings are unknown cannot be interpreted, so it is not shown as a value */
    const c = convert(s.raw, route.settings, route.conditioning, route.cal);
    this.latest[route.channel.quantity] = { channelId: s.channelId, value: c.value, unit: c.unit, volts_adc: c.volts_adc, volts_signal: c.volts_signal, deviceTime_s: s.deviceTime_s, receivedAt_ms: s.receivedAt_ms };
    const session = this._session;
    if (!this._recording || !session) return;
    session.settings[s.settingsRef] = route.settings;
    const col = session.columns[s.channelId] ?? (session.columns[s.channelId] = {
      channelId: s.channelId, quantity: route.channel.quantity, seq: [], deviceTime_s: [], receivedAt_ms: [], raw: [], settingsRef: [], volts_adc: [], volts_signal: [], value: [], unit: c.unit, quality: [],
    });
    col.seq.push(s.seq); col.deviceTime_s.push(s.deviceTime_s); col.receivedAt_ms.push(s.receivedAt_ms); col.raw.push(s.raw); col.settingsRef.push(s.settingsRef);
    col.volts_adc.push(c.volts_adc); col.volts_signal.push(c.volts_signal ?? NaN); col.value.push(c.value ?? NaN);
    col.quality.push(s.quality.length ? s.quality : null);
  }

  private onGap(g: Gap): void {
    if (!this._recording || !this._session) return;
    this._session.gaps.push(g);
    this._session.missingSamples += g.missing;
    this.note('gap', g.missing + ' samples missing after sample ' + g.afterSeq + '.');
  }

  private onState(s: ConnectionState, prev: ConnectionState): void {
    if (!this._recording || !this._session) return;
    if (s === 'stale') this.note('stale', 'No data arrived for a while.');
    else if (s === 'streaming' && prev === 'stale') this.note('resumed', 'Data arrived again.');
    else if (s === 'fault' || s === 'disconnected') {
      const last = this.source.diagnostics[this.source.diagnostics.length - 1];
      const kind = last && last.code === 'device-reset' ? 'device-reset' : s === 'disconnected' ? 'disconnected' : 'fault';
      this.note(kind, last ? last.message : 'The connection ended.');
      this._session.interrupted = true;
      this.stop('Recording interrupted: ' + (last ? last.message : 'the connection ended.') + ' The data up to that point is kept.');
    }
  }
}

/** Samples per second actually achieved on one channel, from the device's own timestamps. Null with fewer than 2 samples. */
export function achievedRate(col: Pick<ChannelColumns, 'deviceTime_s'>): number | null {
  const n = col.deviceTime_s.length;
  if (n < 2) return null;
  const span = (col.deviceTime_s[n - 1] as number) - (col.deviceTime_s[0] as number);
  return span > 0 ? (n - 1) / span : null;
}
