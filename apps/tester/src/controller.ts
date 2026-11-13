/* The session controller: it wires the real acquisition device to a recorder and holds what the screens show. It
   never looks at which board, ADC, or wire format is behind the connection. It has no page code, so it is tested by
   itself. It sends nothing to the tester: Start and Stop here start and stop saving samples.

   There is no simulator here. Recorded tests are opened in Load test (load.ts), never through this live path. */
import { DeviceSource, NdjsonAdapter } from '@tensile/acquisition';
import type { Transport } from '@tensile/acquisition';
import type { TestRecord, TestType } from '@tensile/core';
import { achievedRate, Recorder, sessionToTestRecord } from '@tensile/recording';
import type { CalibrationRecord, DeviceProfile, Readiness, Session, SessionState } from '@tensile/recording';
import { EMPTY_SETUP, paramsFrom, setupProblems } from './setup';
import type { Setup } from './setup';
import type { SessionJournal } from './storage/journal';
import type { TestMethod } from './storage/methods';
import { setupFromMethod } from './storage/methods';

export const APP_VERSION = '0.2.0';
export type Phase = 'setup' | 'recording' | 'done';
/** Saving on this computer: separate from the lab server. */
export type LocalSave = 'none' | 'saving' | 'saved' | 'error' | 'off';

/** A device profile and calibration records for a real setup, loaded from a file the person chooses. */
export interface SetupFile { profile: DeviceProfile; calibrations: CalibrationRecord[] }

/** A saved raw session: everything the device sent during the recording, so it can be replayed. */
export interface SessionFile {
  format: 'tensile-tester-session';
  version: 1;
  savedAt: string;
  appVersion: string;
  /** 'simulated' only in files from older versions or the website's practice tools; this app refuses those. */
  recordedFrom: 'real' | 'simulated';
  /** The test method and revision the test was started from, if any. */
  method?: { id: string; name: string; revision: number } | null;
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
  /** Opens the real connection (USB serial). Tests pass a stand-in device here. */
  openReal: () => Transport;
  /** Where recordings are committed on this computer. Without one, nothing is kept if the app closes. */
  journal?: SessionJournal | null;
  /** How often the journal is written while recording, ms. */
  commitEvery_ms?: number;
}

export class TestController {
  test: TestType = 'uniaxial';
  setup: Setup = { ...EMPTY_SETUP };
  setupFile: SetupFile | null = null;
  method: TestMethod | null = null;
  voltagesOnly = false;

  source: DeviceSource | null = null;
  recorder: Recorder | null = null;
  phase: Phase = 'setup';
  session: Session | null = null;
  record: TestRecord | null = null;
  /** Why there is no stress-strain record (for example: recorded without calibration). */
  recordProblem = '';
  message = '';
  startedAt: Date | null = null;
  saved = true;
  /** Local save state of the current recording, and the id it is kept under. */
  localSave: LocalSave;
  localError = '';
  journalId: string | null = null;
  lastCommitAt: Date | null = null;
  /** Computer time the latest sample arrived, for the data-freshness indicator. */
  lastSampleAt: number | null = null;

  private readonly o: ControllerOptions;
  private listeners = new Set<() => void>();
  private version = 0;
  private handshake: { line: string; at: number }[] = [];
  private recorded: { line: string; at: number }[] = [];
  private committed = 0;
  private committing: Promise<void> = Promise.resolve();
  private lastCommitTry = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastCount = -1;
  private liveCache: { count: number; record: TestRecord | null } = { count: -1, record: null };

  constructor(o: ControllerOptions) { this.o = o; this.localSave = o.journal ? 'none' : 'off'; }

  subscribe = (l: () => void): (() => void) => { this.listeners.add(l); return () => { this.listeners.delete(l); }; };
  snapshot = (): number => this.version;
  private changed(): void { this.version++; this.listeners.forEach((l) => l()); }
  /** For the screens: change a setting and redraw. */
  update(f: (c: TestController) => void): void { f(this); this.changed(); }

  get state(): SessionState { return this.recorder ? this.recorder.state() : this.source ? (this.source.state === 'streaming' || this.source.state === 'connected' ? 'connected-uncalibrated' : this.source.state) : 'disconnected'; }
  get connected(): boolean { const s = this.state; return s === 'ready' || s === 'connected-uncalibrated' || s === 'recording' || s === 'stale'; }
  get readiness(): Readiness | null { return this.recorder ? this.recorder.readiness() : null; }
  get locked(): boolean { return this.phase !== 'setup'; }
  get sampleCount(): number { return this.session ? Object.values(this.session.columns).reduce((a, c) => a + c.raw.length, 0) : 0; }
  /** Samples per second per channel actually achieved in the recording. */
  get rate(): number | null { const f = this.session && Object.values(this.session.columns)[0]; return f ? achievedRate(f) : null; }
  get dataLabel(): string { return 'Measured'; }

  /* ---------- connection ---------- */
  /** Must be called from a click: the person chooses the port. Nothing connects by itself. */
  async connect(): Promise<void> {
    if (this.source && this.source.state !== 'disconnected' && this.source.state !== 'fault') return;
    this.message = '';
    const transport = this.o.openReal();
    const profile = this.setupFile?.profile ?? null, calibrations = this.setupFile?.calibrations ?? [];
    const source = new DeviceSource({ transport, adapter: new NdjsonAdapter(), kind: 'real', requiredQuantities: ['force', 'displacement'] });
    this.source = source; this.recorder = null; this.handshake = []; this.recorded = [];
    source.on('state', (st) => this.onState(st));
    source.on('sample', () => { this.lastSampleAt = Date.now(); });
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
    this.source = null; this.recorder = null;
    this.changed();
  }

  /** A setup file or lab profile chosen on the Device screen or in the Calibration step. */
  useSetup(f: SetupFile): void {
    if (this.phase === 'recording') throw new Error('The calibration cannot be changed while recording.');
    this.setupFile = f;
    this.recorder?.setCalibration(f.profile, f.calibrations);
    this.changed();
  }

  /** A short text a person can copy and send when asking for help. */
  diagnosticSummary(): string {
    const s = this.source, id = s?.identity, st = s?.settings, r = this.readiness;
    const lines = [
      'Biomaterials Tensile Tester app ' + APP_VERSION,
      'State: ' + this.state,
      'Device: ' + (id ? id.deviceType + ' ' + id.deviceId + ', software ' + id.softwareVersion + ', protocol ' + id.protocol : 'not identified'),
      'Channels: ' + (s?.channels.map((c) => c.id + ' (' + c.quantity + ', ' + c.input + ', ' + c.mode + ')').join('; ') || 'none'),
      'ADC: ' + (st ? st.adc + ', ' + st.bits + ' bit, \u00b1' + st.fullScale_mV + ' mV, ' + st.dataRate_sps + ' conversions/s, ref ' + st.ref : 'unknown'),
      'Last sample: ' + (this.lastSampleAt ? new Date(this.lastSampleAt).toISOString() : 'none'),
      'Calibration: ' + (r ? (['force', 'displacement'] as const).map((q) => q + ' ' + (r.channels[q].calibrated ? r.channels[q].calibrationId : 'not calibrated (' + r.channels[q].reasons.join(' ') + ')')).join('; ') : 'not checked'),
      'Setup: ' + (this.setupFile ? this.setupFile.profile.id + ' with ' + this.setupFile.calibrations.length + ' calibration records' : 'none loaded'),
      'Recent messages: ' + ((s?.diagnostics ?? []).slice(-5).map((d) => d.code + ': ' + d.message).join(' | ') || 'none'),
    ];
    return lines.join('\n');
  }

  private onState(st: string): void {
    if ((st === 'fault' || st === 'disconnected') && this.phase === 'recording') this.finish();
    if (st === 'fault' || st === 'disconnected') { const d = this.source?.diagnostics.at(-1); if (d) this.message = d.message; }
    this.changed();
  }
  private startTicking(): void {
    this.stopTicking();
    this.timer = setInterval(() => this.tick(), 100);
  }
  private stopTicking(): void { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  /** Redraws at most ten times a second and commits to the journal about once a second. Recording does not wait for either. */
  tick(): void {
    if (this.phase === 'recording' && Date.now() - this.lastCommitTry >= (this.o.commitEvery_ms ?? 1000)) void this.commit();
    const f = this.recorder?.latest.force;
    const count = this.sampleCount + (f ? f.deviceTime_s : 0);
    if (count !== this.lastCount) { this.lastCount = count; this.changed(); }
  }

  /* ---------- the journal on this computer ---------- */
  /** Writes the sample lines not yet committed. One write at a time; a failed write is retried with the next one. */
  commit(): Promise<void> {
    this.lastCommitTry = Date.now();
    const j = this.o.journal, id = this.journalId;
    if (!j || !id) return Promise.resolve();
    this.committing = this.committing.then(async () => {
      const batch = this.recorded.slice(this.committed);
      if (!batch.length) return;
      this.localSave = 'saving';
      try {
        await j.append(id, { lines: batch.map((x) => x.line), receivedAt_ms: batch.map((x) => x.at) });
        this.committed += batch.length;
        this.localSave = 'saved'; this.localError = ''; this.lastCommitAt = new Date();
      } catch (e) {
        this.localSave = 'error';
        this.localError = 'Saving on this computer failed: ' + (e instanceof Error ? e.message : String(e)) + ' The recording continues in memory; download the data when it ends.';
      }
      this.changed();
    });
    return this.committing;
  }

  /* ---------- recording ---------- */
  get startProblem(): string {
    if (this.phase !== 'setup') return '';
    const probs = Object.values(setupProblems(this.setup, this.test));
    if (probs.length) return probs[0] as string;
    if (!this.recorder || !this.source || (this.source.state !== 'streaming' && this.source.state !== 'stale')) return 'Connect the acquisition device first.';
    if (this.source.state === 'stale') return 'No data is arriving.';
    const r = this.recorder.readiness();
    if (!r.ready && !this.voltagesOnly) return 'Measurements are not calibrated, so force, stress, and strain are not available. To record voltages only, tick "Record voltages only".';
    return '';
  }

  zeroForce(): void {
    const v = this.recorder?.zeroForce();
    this.message = v === null || v === undefined ? 'A software baseline needs a calibrated force reading and is not available while recording.' : 'Software baseline taken from the current force reading. It is subtracted in the results and recorded with the test; the original readings are kept. It is not a machine tare and not a calibration.';
    this.changed();
  }

  /** Starts saving samples. Async only because the journal entry is created first; the recorder starts at once. */
  async startRecording(): Promise<void> {
    if (this.startProblem || !this.recorder || !this.source) { this.message = this.startProblem; this.changed(); return; }
    this.session = this.recorder.start({ allowUncalibrated: this.voltagesOnly });
    this.record = null; this.recordProblem = ''; this.recorded = []; this.committed = 0; this.message = ''; this.saved = false;
    this.startedAt = new Date();
    this.phase = 'recording';
    this.liveCache = { count: -1, record: null };
    this.journalId = null;
    this.changed();
    const j = this.o.journal;
    if (!j) return;
    const id = 's-' + this.startedAt.getTime().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    try {
      const est = await j.estimate();
      if (est && est.quota - est.usage < 50 * 1024 * 1024) this.message = 'This computer has little storage space left for recordings. Download and remove old recordings soon.';
      await j.begin({ id, test: this.test, setup: this.setup, profile: this.setupFile?.profile ?? null, calibrations: this.fileCalibrations(), appVersion: APP_VERSION,
        deviceId: this.source.identity?.deviceId ?? '', startedAt: this.startedAt.toISOString() },
        { lines: this.handshake.map((x) => x.line), receivedAt_ms: this.handshake.map((x) => x.at) });
      this.journalId = id;
      this.localSave = 'saving';
      await this.commit();
    } catch (e) {
      this.localSave = 'error';
      this.localError = 'Saving on this computer could not start: ' + (e instanceof Error ? e.message : String(e)) + ' The recording continues in memory; download the data when it ends.';
      this.changed();
    }
  }

  stopRecording(reason = 'Recording stopped by the user.'): void {
    if (this.phase !== 'recording' || !this.recorder) return;
    this.recorder.stop(reason);
    this.finish();
  }
  private finish(): void {
    this.phase = 'done';
    const built = this.build();
    this.record = built.record; this.recordProblem = built.problem;
    const j = this.o.journal, id = this.journalId, interrupted = !!this.session?.interrupted, reason = this.session?.endReason ?? '';
    if (j && id) void this.commit().then(() => j.finish(id, interrupted ? 'interrupted' : 'complete', reason)).then(() => this.changed(), () => undefined);
    this.changed();
  }
  /** Resolves when everything recorded so far is committed (tests use it). */
  async flushed(): Promise<void> { await this.commit(); await this.committing; }

  private build(): { record: TestRecord | null; problem: string } {
    if (!this.session) return { record: null, problem: '' };
    const p = paramsFrom(this.setup, this.test), r = sessionToTestRecord(this.session, { test: this.test, specimen: p.specimen, params: p.params });
    return r.ok ? { record: r.record, problem: '' } : { record: null, problem: r.reason };
  }
  /** The record so far, for the live graph. Rebuilt only when new samples have arrived. */
  get live(): TestRecord | null {
    if (this.phase === 'done') return this.record;
    if (this.phase !== 'recording') return null;
    const count = this.sampleCount;
    if (count !== this.liveCache.count) this.liveCache = { count, record: this.build().record };
    return this.liveCache.record;
  }

  /** Another specimen: the method, test type, and connection stay; the specimen's identity, baseline, and results do not. */
  newTest(): void {
    this.phase = 'setup'; this.session = null; this.record = null; this.recordProblem = ''; this.recorded = []; this.committed = 0;
    this.message = ''; this.saved = true; this.startedAt = null; this.journalId = null; this.localSave = this.o.journal ? 'none' : 'off'; this.localError = '';
    this.setup = this.method ? setupFromMethod(this.method) : { ...this.setup, specimenId: '', notes: '' };
    this.recorder?.zeroForceReset();
    this.changed();
  }
  /** Starts the setup from a saved method (Test methods). */
  useMethod(m: TestMethod | null): void {
    if (this.phase !== 'setup') throw new Error('Finish or clear the current test first.');
    this.method = m;
    if (m) { this.test = m.test; this.setup = setupFromMethod(m); }
    this.changed();
  }

  /* ---------- the raw session file ---------- */
  private fileCalibrations(): CalibrationRecord[] {
    const cal = this.session?.calibrations ?? {};
    return (['force', 'displacement'] as const).flatMap((q) => { const c = cal[q]; return c ? [{ id: c.id, quantity: q, unit: c.unit, slope: c.slope, offset: c.offset, signalPath: c.signalPath, origin: c.origin, createdAt: '' }] : []; });
  }
  sessionFile(): SessionFile | null {
    if (!this.session || !this.source) return null;
    const all = [...this.handshake, ...this.recorded];
    return {
      format: 'tensile-tester-session', version: 1, savedAt: new Date().toISOString(), appVersion: APP_VERSION,
      recordedFrom: 'real', test: this.test, setup: this.setup, profile: this.setupFile?.profile ?? null, calibrations: this.fileCalibrations(),
      method: this.method ? { id: this.method.id, name: this.method.name, revision: this.method.revision } : null,
      lines: all.map((x) => x.line), receivedAt_ms: all.map((x) => x.at),
    };
  }
}

/** A session file rebuilt from the journal (recovery, or a recent test kept on this computer). */
export async function sessionFileFromJournal(j: SessionJournal, id: string): Promise<SessionFile> {
  const meta = (await j.list()).find((m) => m.id === id);
  if (!meta) throw new Error('That recording is no longer on this computer.');
  const l = await j.lines(id);
  return { format: 'tensile-tester-session', version: 1, savedAt: meta.lastCommitAt, appVersion: meta.appVersion, recordedFrom: 'real', test: meta.test, setup: meta.setup,
    profile: meta.profile, calibrations: meta.calibrations, method: null, lines: l.lines, receivedAt_ms: l.receivedAt_ms };
}
