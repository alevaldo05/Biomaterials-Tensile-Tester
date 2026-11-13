/* The session controller: it wires a source to a recorder and holds what the screens show. It is given a source
   choice and never looks at which board, ADC, or wire format is behind it. It has no page code, so it is tested
   by itself. It sends nothing to the tester: Start and Stop here start and stop saving samples. */
import { DeviceSource, NdjsonAdapter, ReplayTransport, SimulatedDevice, simulatedRelaxation, simulatedUniaxial } from '@tensile/acquisition';
import type { Transport } from '@tensile/acquisition';
import type { TestRecord, TestType } from '@tensile/core';
import { achievedRate, Recorder, sessionToTestRecord, simulatedCalibrations, simulatedProfile } from '@tensile/recording';
import type { CalibrationRecord, DeviceProfile, Readiness, Session, SessionState } from '@tensile/recording';
import { EMPTY_SETUP, num, setupProblems } from './setup';
import type { Setup } from './setup';

export const APP_VERSION = '0.1.0';
export type Edition = 'lab' | 'learning';
export type SourceChoice = 'simulated' | 'real' | 'replay';
export type Phase = 'setup' | 'recording' | 'done';

/** A device profile and calibration records for a real setup, loaded from a file the person chooses. */
export interface SetupFile { profile: DeviceProfile; calibrations: CalibrationRecord[] }

/** A saved raw session: everything the device sent during the recording, so it can be replayed. */
export interface SessionFile {
  format: 'tensile-tester-session';
  version: 1;
  savedAt: string;
  appVersion: string;
  /** What the session was when it was recorded. A replay of simulated data stays labeled simulated. */
  recordedFrom: 'real' | 'simulated';
  test: TestType;
  setup: Setup;
  profile: DeviceProfile | null;
  calibrations: CalibrationRecord[];
  /** The protocol lines as received: identification, channels, settings, then the samples of the recording. */
  lines: string[];
  /** Computer time each line arrived, ms. */
  receivedAt_ms: number[];
}

export function parseSessionFile(text: string): SessionFile {
  let f: Partial<SessionFile>;
  try { f = JSON.parse(text) as Partial<SessionFile>; } catch { throw new Error('This is not a session file saved by this app.'); }
  if (!f || f.format !== 'tensile-tester-session' || f.version !== 1 || !Array.isArray(f.lines) || !f.lines.every((l) => typeof l === 'string') || !f.setup || (f.test !== 'uniaxial' && f.test !== 'relaxation')) {
    throw new Error('This is not a session file saved by this app (or it is from a newer version).');
  }
  return { ...(f as SessionFile), calibrations: Array.isArray(f.calibrations) ? f.calibrations : [], profile: f.profile ?? null, receivedAt_ms: Array.isArray(f.receivedAt_ms) ? f.receivedAt_ms : [] };
}
export function parseSetupFile(text: string): SetupFile {
  let f: Partial<SetupFile>;
  try { f = JSON.parse(text) as Partial<SetupFile>; } catch { throw new Error('This is not a setup file (device profile and calibration).'); }
  const okCal = (c: CalibrationRecord) => c && typeof c.id === 'string' && (c.quantity === 'force' || c.quantity === 'displacement') && Number.isFinite(c.slope) && Number.isFinite(c.offset) && c.signalPath && c.origin === 'measured';
  if (!f || !f.profile || typeof f.profile.id !== 'string' || !f.profile.channels || !Array.isArray(f.calibrations) || !f.calibrations.every(okCal)) {
    throw new Error('The setup file needs a device profile and calibration records made on real equipment.');
  }
  return { profile: f.profile, calibrations: f.calibrations };
}

export interface ControllerOptions {
  edition: Edition;
  /** Opens the real connection (USB serial). Absent in the learning edition, which has no way to reach hardware. */
  openReal?: () => Transport;
  /** Tests pass false and step the simulator themselves. */
  autoRun?: boolean;
}

export class TestController {
  readonly edition: Edition;
  choice: SourceChoice = 'simulated';
  test: TestType = 'uniaxial';
  simulatedDeviceType = 'esp32';
  setup: Setup = { ...EMPTY_SETUP };
  setupFile: SetupFile | null = null;
  replayFile: SessionFile | null = null;
  voltagesOnly = false;

  source: DeviceSource | null = null;
  recorder: Recorder | null = null;
  simulator: SimulatedDevice | null = null;
  phase: Phase = 'setup';
  session: Session | null = null;
  record: TestRecord | null = null;
  /** Why there is no stress-strain record (for example: recorded without calibration). */
  recordProblem = '';
  message = '';
  startedAt: Date | null = null;
  saved = true;

  private readonly o: ControllerOptions;
  private listeners = new Set<() => void>();
  private version = 0;
  private handshake: { line: string; at: number }[] = [];
  private recorded: { line: string; at: number }[] = [];
  private replay: ReplayTransport | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastCount = -1;
  private liveCache: { count: number; record: TestRecord | null } = { count: -1, record: null };

  constructor(o: ControllerOptions) { this.o = o; this.edition = o.edition; }

  subscribe = (l: () => void): (() => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  snapshot = (): number => this.version;
  private changed(): void { this.version++; this.listeners.forEach((l) => l()); }
  /** For the screens: change a setting and redraw. */
  update(f: (c: TestController) => void): void { f(this); this.changed(); }

  get choices(): SourceChoice[] { return this.edition === 'learning' || !this.o.openReal ? ['simulated', 'replay'] : ['real', 'simulated', 'replay']; }
  get state(): SessionState { return this.recorder ? this.recorder.state() : this.source ? (this.source.state === 'streaming' || this.source.state === 'connected' ? 'connected-uncalibrated' : this.source.state) : 'disconnected'; }
  get connected(): boolean { const s = this.state; return s === 'ready' || s === 'connected-uncalibrated' || s === 'recording' || s === 'stale'; }
  get readiness(): Readiness | null { return this.recorder ? this.recorder.readiness() : null; }
  get locked(): boolean { return this.phase !== 'setup'; }
  get sampleCount(): number { return this.session ? Object.values(this.session.columns).reduce((a, c) => a + c.raw.length, 0) : 0; }
  /** Samples per second per channel actually achieved in the recording. */
  get rate(): number | null { const f = this.session && Object.values(this.session.columns)[0]; return f ? achievedRate(f) : null; }
  get dataLabel(): string {
    const kind = this.source ? this.source.kind : this.choice === 'real' ? 'real' : this.choice === 'simulated' ? 'simulated' : 'replayed';
    return kind === 'real' ? 'Measured' : kind === 'simulated' ? 'Simulated data, not measured' : 'Replayed' + (this.replayFile && this.replayFile.recordedFrom === 'simulated' ? ' (simulated data, not measured)' : ' recording');
  }

  /* ---------- connection ---------- */
  async connect(): Promise<void> {
    if (this.source && this.source.state !== 'disconnected' && this.source.state !== 'fault') return;
    this.message = '';
    let transport: Transport, kind: 'real' | 'simulated' | 'replayed';
    let profile: DeviceProfile | null = null, calibrations: CalibrationRecord[] = [];
    this.simulator = null; this.replay = null;
    if (this.choice === 'simulated') {
      this.simulator = new SimulatedDevice({ deviceType: this.simulatedDeviceType, manualMotion: true, auto: this.o.autoRun !== false });
      transport = this.simulator; kind = 'simulated';
    } else if (this.choice === 'replay') {
      if (!this.replayFile) { this.message = 'Choose a saved session file first.'; this.changed(); return; }
      this.replay = new ReplayTransport({ lines: this.replayFile.lines, auto: false });
      transport = this.replay; kind = 'replayed';
      profile = this.replayFile.profile; calibrations = this.replayFile.calibrations;
    } else {
      if (!this.o.openReal) { this.message = 'This edition cannot connect to hardware.'; this.changed(); return; }
      transport = this.o.openReal(); kind = 'real';
      if (this.setupFile) { profile = this.setupFile.profile; calibrations = this.setupFile.calibrations; }
    }
    const source = new DeviceSource({ transport, adapter: new NdjsonAdapter(), kind, requiredQuantities: ['force', 'displacement'] });
    this.source = source; this.recorder = null; this.handshake = []; this.recorded = [];
    source.on('state', (s) => this.onState(s));
    source.on('line', (line, at) => {
      if (line.includes('"type":"sample"')) { if (this.phase === 'recording') this.recorded.push({ line, at }); }
      else if (/"type":"(hello|channels|settings)"/.test(line)) this.handshake.push({ line, at });
    });
    this.changed();
    try {
      await source.connect();
    } catch (e) {
      this.message = e instanceof Error ? e.message : String(e);
      this.changed();
      return;
    }
    if (kind === 'simulated') { profile = simulatedProfile(); calibrations = simulatedCalibrations(source); }
    this.recorder = new Recorder({ source, profile, calibrations, appVersion: APP_VERSION });
    await source.startStream();
    this.startTicking();
    this.changed();
  }

  async disconnect(): Promise<void> {
    if (this.phase === 'recording') this.stopRecording('Recording stopped: disconnected by the user.');
    this.stopTicking();
    await this.source?.disconnect();
    this.recorder?.dispose();
    this.source = null; this.recorder = null; this.simulator = null; this.replay = null;
    this.changed();
  }

  private onState(s: string): void {
    if ((s === 'fault' || s === 'disconnected') && this.phase === 'recording') this.finish();
    if (s === 'fault' || s === 'disconnected') { const d = this.source?.diagnostics.at(-1); if (d) this.message = d.message; }
    this.changed();
  }
  private startTicking(): void {
    this.stopTicking();
    this.timer = setInterval(() => this.tick(), 100);
  }
  private stopTicking(): void { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  /** Redraws at most ten times a second, however fast samples arrive. Recording does not wait for it. */
  tick(): void {
    if (this.replay && this.phase === 'recording') {
      this.replay.play(160);
      if (this.replay.remaining === 0) { this.stopRecording('The replay reached the end of the file.'); return; }
    }
    const f = this.recorder?.latest.force;
    const count = this.sampleCount + (f ? f.deviceTime_s : 0);
    if (count !== this.lastCount) { this.lastCount = count; this.changed(); }
  }

  /* ---------- recording ---------- */
  get startProblem(): string {
    if (this.phase !== 'setup') return '';
    const probs = Object.values(setupProblems(this.setup, this.test));
    if (probs.length) return probs[0] as string;
    if (!this.recorder || !this.source || (this.source.state !== 'streaming' && this.source.state !== 'stale')) return 'Connect a source first.';
    if (this.source.state === 'stale') return 'No data is arriving.';
    const r = this.recorder.readiness();
    if (!r.ready && !this.voltagesOnly) return 'Measurements are not calibrated, so force, stress, and strain are not available. To record voltages only, tick "Record voltages only".';
    return '';
  }

  zeroForce(): void {
    const v = this.recorder?.zeroForce();
    this.message = v === null || v === undefined ? 'Zero force needs a calibrated force reading and is not available while recording.' : 'Force zero set from the current reading (a software zero, not a calibration).';
    this.changed();
  }

  startRecording(): void {
    if (this.startProblem || !this.recorder) { this.message = this.startProblem; this.changed(); return; }
    const s = this.setup, area = (num(s.width) as number) * (num(s.thickness) as number), speed = num(s.speed) as number;
    this.session = this.recorder.start({ allowUncalibrated: this.voltagesOnly });
    this.record = null; this.recordProblem = ''; this.recorded = []; this.message = ''; this.saved = false;
    this.startedAt = new Date();
    this.phase = 'recording';
    this.liveCache = { count: -1, record: null };
    /* The simulator's pretend crosshead starts with the recording. A real tester is started from its own controller. */
    this.simulator?.beginMotion(this.test === 'relaxation'
      ? simulatedRelaxation({ speed_mm_min: speed, hold_mm: num(s.holdMm) as number, area_mm2: area })
      : simulatedUniaxial({ speed_mm_min: speed, gauge_mm: num(s.L0) as number, area_mm2: area }));
    this.changed();
  }

  stopRecording(reason = 'Recording stopped by the user.'): void {
    if (this.phase !== 'recording' || !this.recorder) return;
    this.recorder.stop(reason);
    this.finish();
  }
  private finish(): void {
    this.phase = 'done';
    this.simulator?.resetMotion();
    const built = this.build();
    this.record = built.record; this.recordProblem = built.problem;
    this.changed();
  }

  private params() {
    const s = this.setup;
    return {
      specimen: { L0_mm: num(s.L0) ?? 0, width_mm: num(s.width) ?? 0, thickness_mm: num(s.thickness) ?? 0 },
      params: { speed_mm_min: num(s.speed) ?? '', yield: false,
        ...(this.test === 'relaxation' ? { hold_mm: num(s.holdMm) ?? 0, hold_s: num(s.holdS) ?? 0, holdSource: 'typed' as const } : {}),
        ...(this.test === 'uniaxial' && s.offsetOn && num(s.offsetPct) ? { offsetPct: num(s.offsetPct) as number } : {}) },
    };
  }
  private build(): { record: TestRecord | null; problem: string } {
    if (!this.session) return { record: null, problem: '' };
    const p = this.params(), r = sessionToTestRecord(this.session, { test: this.test, specimen: p.specimen, params: p.params });
    if (!r.ok) return { record: null, problem: r.reason };
    if (this.source?.kind === 'replayed' && this.replayFile) r.record.simulated = this.replayFile.recordedFrom === 'simulated';
    return { record: r.record, problem: '' };
  }
  /** The record so far, for the live graph. Rebuilt only when new samples have arrived. */
  get live(): TestRecord | null {
    if (this.phase === 'done') return this.record;
    if (this.phase !== 'recording') return null;
    const count = this.sampleCount;
    if (count !== this.liveCache.count) this.liveCache = { count, record: this.build().record };
    return this.liveCache.record;
  }

  newTest(): void {
    this.phase = 'setup'; this.session = null; this.record = null; this.recordProblem = ''; this.recorded = []; this.message = ''; this.saved = true; this.startedAt = null;
    this.changed();
  }

  /* ---------- the raw session file ---------- */
  sessionFile(): SessionFile | null {
    if (!this.session || !this.source) return null;
    const all = [...this.handshake, ...this.recorded], cal = this.session.calibrations;
    return {
      format: 'tensile-tester-session', version: 1, savedAt: new Date().toISOString(), appVersion: APP_VERSION,
      recordedFrom: this.source.kind === 'real' ? 'real' : this.source.kind === 'simulated' ? 'simulated' : (this.replayFile ? this.replayFile.recordedFrom : 'simulated'),
      test: this.test, setup: this.setup,
      profile: this.source.kind === 'simulated' ? simulatedProfile() : this.source.kind === 'replayed' ? (this.replayFile?.profile ?? null) : (this.setupFile?.profile ?? null),
      calibrations: (['force', 'displacement'] as const).flatMap((q) => { const c = cal[q]; return c ? [{ id: c.id, quantity: q, unit: c.unit, slope: c.slope, offset: c.offset, signalPath: c.signalPath, origin: c.origin, createdAt: '' }] : []; }),
      lines: all.map((x) => x.line), receivedAt_ms: all.map((x) => x.at),
    };
  }
  loadReplay(text: string): void {
    const f = parseSessionFile(text);
    this.replayFile = f; this.choice = 'replay'; this.test = f.test; this.setup = { ...EMPTY_SETUP, ...f.setup };
    this.message = '';
    this.changed();
  }
}
