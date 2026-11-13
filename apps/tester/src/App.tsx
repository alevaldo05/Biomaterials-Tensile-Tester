/* The one screen of the app: setup steps beside the workspace (status, toolbar, measurements, graph, results).
   It shows what the controller holds. It has no device, board, or protocol knowledge. */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { keyNumbers, sig } from '@tensile/core';
import type { TestRecord, TestType } from '@tensile/core';
import { DARK_GRAPH, Field, Graph, LIGHT_GRAPH, MeasurementStrip, Panel, StatusBar } from '@tensile/ui';
import type { Reading, Tone } from '@tensile/ui';
import type { SessionState } from '@tensile/recording';
import type { SourceChoice, TestController } from './controller';
import { parseSetupFile } from './controller';
import type { Account, ProfileRow } from './lab-api';
import { fileBase, samplesCsv, save, sessionDetails, svgText, svgToPng, testCsv, testXlsx } from './exports';
import { resultsFor, TERM_FOR } from './results';
import site from 'virtual:site-data';
import { EXAMPLE_DIMENSIONS, EXAMPLE_SETTINGS, MATERIAL_CHOICES, setupProblems, STEP_FIELDS } from './setup';
import type { Setup } from './setup';


const STATE_TEXT: Record<SessionState, { tone: Tone; name: string; detail: string }> = {
  disconnected: { tone: 'idle', name: 'Disconnected', detail: 'Choose a source and connect.' },
  connecting: { tone: 'busy', name: 'Connecting', detail: 'Opening the connection.' },
  identifying: { tone: 'busy', name: 'Identifying', detail: 'Asking the device who it is and what it measures.' },
  'connected-uncalibrated': { tone: 'warn', name: 'Connected, uncalibrated', detail: 'Readings are shown in volts. Force, stress, and strain need a calibration.' },
  ready: { tone: 'ok', name: 'Ready to record', detail: 'Calibrated readings are arriving.' },
  recording: { tone: 'live', name: 'Recording', detail: 'Samples are being saved in this tab.' },
  stale: { tone: 'warn', name: 'Stale data', detail: 'No readings have arrived for 2 seconds.' },
  fault: { tone: 'bad', name: 'Fault', detail: 'The connection stopped because of a problem.' },
};
const SOURCE_TEXT: Record<SourceChoice, { name: string; detail: string }> = {
  real: { name: 'Real acquisition', detail: 'An acquisition device connected by USB.' },
  simulated: { name: 'Simulation', detail: 'A pretend device with made-up data. Always labeled "Simulated data, not measured".' },
  replay: { name: 'Recorded-data replay', detail: 'Play back a session file saved by this app.' },
};
type StepId = 'source' | 'connection' | 'device' | 'calibration' | 'test' | 'dimensions' | 'review';
const STEPS: { id: StepId; name: string }[] = [
  { id: 'source', name: 'Source' }, { id: 'connection', name: 'Connection' }, { id: 'device', name: 'Device' }, { id: 'calibration', name: 'Calibration' },
  { id: 'test', name: 'Test and specimen' }, { id: 'dimensions', name: 'Dimensions' }, { id: 'review', name: 'Review' },
];
type ViewId = 'stress' | 'force-disp' | 'force-time';

export function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('app-theme') || 'light'; } catch { return 'light'; } });
  useEffect(() => { document.documentElement.dataset.theme = theme; try { localStorage.setItem('app-theme', theme); } catch { /* the choice is just not remembered */ } }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

function viewData(rec: TestRecord | null, view: ViewId, isRelax: boolean) {
  const raw = rec?.raw;
  if (view === 'force-disp') return { x: raw?.d ?? [], y: raw?.F ?? [], xLabel: 'Crosshead displacement (mm)', yLabel: 'Force (N)', xName: 'd', yName: 'F', xUnit: 'mm', yUnit: 'N' };
  if (view === 'force-time') return { x: raw?.t ?? [], y: raw?.F ?? [], xLabel: 'Time (s)', yLabel: 'Force (N)', xName: 't', yName: 'F', xUnit: 's', yUnit: 'N' };
  return isRelax
    ? { x: rec?.x ?? [], y: rec?.y ?? [], xLabel: 'Time, t (s)', yLabel: 'Stress, σ (MPa)', xName: 't', yName: 'σ', xUnit: 's', yUnit: 'MPa' }
    : { x: rec?.x ?? [], y: rec?.y ?? [], xLabel: 'Crosshead-based engineering strain, Δx/L₀ (mm/mm)', yLabel: 'Engineering stress, F/A₀ (MPa)', xName: 'ε', yName: 'σ', xUnit: 'mm/mm', yUnit: 'MPa' };
}

export interface TestScreenProps { controller: TestController; serialAvailable: boolean; theme: string; account: Account | null }

/** The test screen: setup steps beside the workspace. */
export function App({ controller: c, serialAvailable, theme, account }: TestScreenProps) {
  useSyncExternalStore(c.subscribe, c.snapshot);
  const [step, setStep] = useState<StepId>('source');
  const [drawer, setDrawer] = useState(false);
  const [view, setView] = useState<ViewId>('stress');
  const [touched, setTouched] = useState<Partial<Record<keyof Setup, boolean>>>({});
  const [ask, setAsk] = useState<null | 'new' | 'disconnect'>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [fileError, setFileError] = useState('');
  const [showDefs, setShowDefs] = useState(false);
  const svg = useRef<SVGSVGElement | null>(null);
  const [labProfiles, setLabProfiles] = useState<ProfileRow[] | null>(null);
  useEffect(() => {
    if (step !== 'calibration' || c.choice !== 'real' || !account?.user || labProfiles !== null) return;
    void account.api.profiles().then(setLabProfiles, () => setLabProfiles([]));
  }, [step, c.choice, account?.user, labProfiles]);
  const dialog = useRef<HTMLDialogElement | null>(null);

  const isRelax = c.test === 'relaxation', state = c.state, st = STATE_TEXT[state], recording = c.phase === 'recording';
  const problems = setupProblems(c.setup, c.test);
  const rec = c.live;
  const results = useMemo(() => resultsFor(c.phase === 'done' ? c.record : null), [c.record, c.phase]);
  const data = viewData(rec, view, isRelax);
  const latest = c.recorder?.latest;
  const set = (patch: Partial<Setup>) => c.update((x) => { x.setup = { ...x.setup, ...patch }; });
  const show = (k: keyof Setup) => (touched[k] ? problems[k] : undefined);
  const touch = (k: keyof Setup) => () => setTouched((t) => ({ ...t, [k]: true }));

  useEffect(() => { if (recording) setDrawer(false); }, [recording]);
  useEffect(() => { document.title = (recording ? 'Recording · ' : c.phase === 'done' ? 'Stopped · ' : '') + 'Biomaterials Tensile Tester · App'; }, [recording, c.phase]);
  useEffect(() => { const d = dialog.current; if (!d) return; if (ask && !d.open) d.showModal(); if (!ask && d.open) d.close(); }, [ask]);
  /* The browser's own box when the tab is closed with data that was not saved. */
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (recording || !c.saved) e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [recording, c.saved]);

  /* ---------- measurement strip: a missing value is a dash, an uncalibrated one is volts ---------- */
  const live = (q: 'force' | 'displacement', unit: string): Reading => {
    const v = latest?.[q], label = q === 'force' ? 'Force' : 'Displacement';
    /* after a test the strip shows the last recorded point, not the idle readings that keep arriving */
    if (c.phase === 'done') { const last = (q === 'force' ? rec?.raw?.F : rec?.raw?.d)?.at(-1); return { label, value: last === undefined ? null : sig(last, 4), unit }; }
    if (!v || !c.connected) return { label, value: null };
    if (v.value !== null) return { label, value: sig(q === 'force' ? v.value - (c.recorder?.forceZero_N ?? 0) : v.value, 4), unit };
    return { label, value: sig(v.volts_signal ?? v.volts_adc, 4), unit: 'V', note: v.volts_signal === null ? 'at the ADC, uncalibrated' : 'uncalibrated' };
  };
  const n = rec ? rec.x.length : 0, lastT = rec?.raw?.t?.[n - 1], lastY = rec?.y[n - 1];
  const readings: Reading[] = [
    live('force', 'N'), live('displacement', 'mm'),
    { label: 'Elapsed', value: c.phase !== 'setup' && lastT !== undefined ? sig(lastT, 4) : null, unit: 's' },
    { label: 'Stress', value: c.phase !== 'setup' && lastY !== undefined && Number.isFinite(lastY) ? sig(lastY, 4) : null, unit: 'MPa' },
    { label: 'Rate', value: c.rate !== null && c.phase !== 'setup' ? sig(c.rate, 3) : null, unit: 'samples/s' },
    { label: 'Data', value: c.dataLabel },
  ];

  /* ---------- saving ---------- */
  const doSave = async (what: 'csv' | 'xlsx' | 'png' | 'svg' | 'session' | 'samples') => {
    const base = fileBase(c);
    if (what === 'csv') { const t = testCsv(c); if (t) save(base + '.csv', [t], 'text/csv;charset=utf-8'); }
    else if (what === 'xlsx') { const b = testXlsx(c); if (b) save(base + '.xlsx', [b as BlobPart], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }
    else if (what === 'svg' && svg.current) save(base + '.svg', [svgText(svg.current)], 'image/svg+xml');
    else if (what === 'png' && svg.current) save(base + '.png', [await svgToPng(svg.current)], 'image/png');
    else if (what === 'session') { const f = c.sessionFile(); if (f) save(base + '.session.json', [JSON.stringify(f)], 'application/json'); }
    else if (what === 'samples' && c.session) save(base + '_samples.csv', [samplesCsv(c, c.session)], 'text/csv;charset=utf-8');
    if (what === 'csv' || what === 'session' || what === 'samples') c.update((x) => { x.saved = true; });
    setSaveOpen(false);
  };
  /* Sends the session file (every line as received) and the key results to the lab database. The file is the record. */
  const saveToLab = async () => {
    setSaveOpen(false);
    const f = c.sessionFile();
    if (!f || !account?.user) return;
    const nums = c.record ? keyNumbers(c.record, isRelax, { includeOffsetYield: true }) : {};
    const summary: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(nums)) summary[k] = typeof v === 'number' && Number.isFinite(v) ? v : null;
    try {
      const r = await account.api.saveSession(f, summary, c.setup.notes);
      c.update((x) => { x.saved = true; x.message = 'Saved to the lab database as test ' + r.id + ' (' + r.sampleCount + ' samples).'; });
    } catch (e) {
      c.update((x) => { x.message = 'Not saved to the lab database: ' + (e instanceof Error ? e.message : String(e)) + ' The data is still in this tab; download it to keep it.'; });
    }
  };
  const startNew = () => { c.newTest(); setTouched({}); setView('stress'); };
  const proceed = (how: 'save' | 'discard') => {
    const what = ask;
    if (how === 'save') void doSave(c.record ? 'csv' : 'session');
    setAsk(null);
    if (what === 'new') startNew();
    if (what === 'disconnect') void c.disconnect();
  };
  const readFile = (e: React.ChangeEvent<HTMLInputElement>, use: (text: string) => void) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFileError('');
    void f.text().then((t) => { try { use(t); } catch (err) { setFileError(err instanceof Error ? err.message : String(err)); } });
  };

  /* ---------- setup steps ---------- */
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const stepBlock: Partial<Record<StepId, string>> = {
    source: c.choice === 'replay' && !c.replayFile ? 'Choose a session file.' : undefined,
    connection: c.connected ? undefined : 'Connect to continue.',
    test: STEP_FIELDS.specimen.concat(STEP_FIELDS.settings).map((k) => problems[k]).find(Boolean),
    dimensions: STEP_FIELDS.dimensions.map((k) => problems[k]).find(Boolean),
  };
  const lockNote = c.locked ? <p className="hint">Setup is locked {recording ? 'while recording' : 'until New test'}.</p> : null;
  const text = (k: keyof Setup, label: string, o: { unit?: string; required?: boolean; hint?: string; numeric?: boolean } = {}) => (
    <Field label={label} {...(o.unit ? { unit: o.unit } : {})} {...(o.required ? { required: true } : {})} {...(show(k) ? { error: show(k) as string } : {})} {...(o.hint ? { hint: o.hint } : {})}>
      <input type="text" inputMode={o.numeric ? 'decimal' : 'text'} value={c.setup[k] as string} disabled={c.locked && k !== 'notes'} onChange={(e) => set({ [k]: e.target.value })} onBlur={touch(k)} aria-invalid={!!show(k)} />
    </Field>
  );
  const identity = c.source?.identity, settings = c.source?.settings, readiness = c.readiness;

  const steps: Record<StepId, ReactNode> = {
    source: (<>
      <fieldset className="choices" disabled={c.connected || c.locked}>
        <legend>Where the data comes from</legend>
        {c.choices.map((k) => (
          <label key={k} className="choice">
            <input type="radio" name="source" checked={c.choice === k} onChange={() => c.update((x) => { x.choice = k; })} />
            <span><strong>{SOURCE_TEXT[k].name}</strong><span className="hint">{SOURCE_TEXT[k].detail}</span></span>
          </label>
        ))}
      </fieldset>
      {c.edition === 'learning' ? <p className="hint">Learning edition: this build cannot connect to hardware.</p> : null}
      {c.choice === 'simulated' ? (
        <Field label="Pretend device" hint="The same screens and checks run for every device type.">
          <select value={c.simulatedDeviceType} disabled={c.connected} onChange={(e) => c.update((x) => { x.simulatedDeviceType = e.target.value; })}>
            <option value="esp32">ESP32</option><option value="pico">Raspberry Pi Pico</option><option value="raspberry-pi-service">Raspberry Pi service</option>
          </select>
        </Field>) : null}
      {c.choice === 'replay' ? (
        <Field label="Session file" hint={c.replayFile ? c.replayFile.lines.length + ' lines, recorded from ' + (c.replayFile.recordedFrom === 'simulated' ? 'the simulator' : 'a real device') + ', saved ' + c.replayFile.savedAt.slice(0, 10) + '.' : 'A .session.json file saved with Save data.'}>
          <input type="file" accept=".json,application/json" disabled={c.connected} onChange={(e) => readFile(e, (t) => c.loadReplay(t))} />
        </Field>) : null}
      {fileError ? <p className="error" role="alert">{fileError}</p> : null}
    </>),
    connection: (<>
      <dl className="facts">
        <div><dt>Method</dt><dd>{c.choice === 'real' ? 'USB serial (Web Serial), 921600 baud' : c.choice === 'simulated' ? 'In this tab (no port is opened)' : 'From the chosen file'}</dd></div>
        <div><dt>State</dt><dd>{st.name}</dd></div>
      </dl>
      {c.choice === 'real' ? <p className="hint">You pick the port in the browser’s own box; the app never opens one by itself. {serialAvailable ? '' : 'This browser has no Web Serial: use Chrome on a computer. '}The hardware connection is untested.</p> : null}
      <p className="row">
        {c.connected ? <button type="button" onClick={() => (c.saved ? void c.disconnect() : setAsk('disconnect'))}>Disconnect</button>
          : <button type="button" className="primary" disabled={state === 'connecting' || state === 'identifying' || (c.choice === 'replay' && !c.replayFile)} onClick={() => void c.connect()}>Connect</button>}
      </p>
      {c.message && !c.connected ? <p className="error" role="alert">{c.message}</p> : null}
    </>),
    device: identity && settings ? (<>
      <dl className="facts">
        <div><dt>Device</dt><dd>{identity.deviceType} · {identity.deviceId}</dd></div>
        <div><dt>Software</dt><dd>{identity.softwareVersion}</dd></div>
        <div><dt>Protocol</dt><dd>{identity.protocol} (compatible)</dd></div>
        <div><dt>Channels</dt><dd>{c.source?.channels.map((ch) => ch.quantity + ' on ' + ch.input + ', ' + ch.mode).join('; ')}</dd></div>
        <div><dt>ADC</dt><dd>{settings.adc}, {settings.bits} bit, ±{settings.fullScale_mV} mV</dd></div>
        <div><dt>Conversion rate</dt><dd>{settings.dataRate_sps} per second, shared by {settings.channelOrder.length} channels converted one after another</dd></div>
      </dl>
      <p className="hint">The device identified itself in answer to the app’s question; a port name alone is not accepted.</p>
    </>) : <p className="hint">Connect first. The device’s identity, channels, and settings appear here.</p>,
    calibration: (<>
      {readiness ? (['force', 'displacement'] as const).map((q) => { const r = readiness.channels[q]; return (
        <div key={q} className={'cal ' + (r.calibrated ? 'cal-ok' : 'cal-no')}>
          <strong>{q === 'force' ? 'Force' : 'Displacement'}: {r.calibrated ? 'calibrated' : 'uncalibrated'}</strong>
          <span className="hint">{r.calibrated ? 'Calibration ' + r.calibrationId + (c.source?.kind === 'simulated' ? ' (made up for the simulator)' : '') : r.reasons.join(' ')}</span>
        </div>); }) : <p className="hint">Connect first.</p>}
      {c.choice === 'real' ? (<>
        <Field label="Setup file" hint={c.setupFile ? 'Loaded profile "' + c.setupFile.profile.name + '" with ' + c.setupFile.calibrations.length + ' calibration records.' : 'The device profile (conditioning circuit) and calibration records for this setup. Without it, readings stay in volts.'}>
          <input type="file" accept=".json,application/json" disabled={c.locked} onChange={(e) => readFile(e, (t) => { const f = parseSetupFile(t); c.update((x) => { x.setupFile = f; x.recorder?.setCalibration(f.profile, f.calibrations); }); })} />
        </Field>
        {account?.user ? (
          <Field label="Setup from the lab database" hint={labProfiles === null ? 'Loading…' : labProfiles.length ? 'A device profile and its approved calibrations.' : 'No device profiles are stored yet. An admin adds them.'}>
            <select value="" disabled={c.locked || !labProfiles?.length} onChange={(e) => { const id = e.target.value; if (!id) return; setFileError(''); void account.api.setupFile(id).then((f) => c.update((x) => { x.setupFile = f; x.recorder?.setCalibration(f.profile, f.calibrations); }), (err: unknown) => setFileError(err instanceof Error ? err.message : String(err))); }}>
              <option value="">Choose a profile…</option>
              {(labProfiles ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
            </select>
          </Field>) : null}
        <label className="check"><input type="checkbox" checked={c.voltagesOnly} disabled={c.locked} onChange={(e) => c.update((x) => { x.voltagesOnly = e.target.checked; })} /> Record voltages only (no force, stress, or strain)</label>
      </>) : null}
      {fileError ? <p className="error" role="alert">{fileError}</p> : null}
      <p className="hint">A calibration is used only when the whole signal path matches the one it was made with. Zero force is not a calibration.</p>
    </>),
    test: (<>
      <Field label="Test">
        <select value={c.test} disabled={c.locked || c.choice === 'replay'} onChange={(e) => { c.update((x) => { x.test = e.target.value as TestType; }); setView('stress'); }}>
          <option value="uniaxial">Uniaxial tension</option><option value="relaxation">Stress relaxation</option>
        </select>
      </Field>
      <Field label="Material" required {...(show('material') ? { error: show('material') as string } : {})}>
        <input type="text" list="materials" value={c.setup.material} disabled={c.locked} onChange={(e) => set({ material: e.target.value })} onBlur={touch('material')} aria-invalid={!!show('material')} />
      </Field>
      <datalist id="materials">{MATERIAL_CHOICES.concat(site.materials.map((m: { name: string }) => m.name)).map((m) => <option key={m} value={m} />)}</datalist>
      {text('specimenId', 'Specimen ID')}
      {text('speed', 'Crosshead speed set on the tester', { unit: 'mm/min', required: true, numeric: true, hint: 'Written into the record. The app does not set it.' })}
      {isRelax ? <>{text('holdMm', 'Hold displacement', { unit: 'mm', required: true, numeric: true })}{text('holdS', 'Hold duration', { unit: 's', required: true, numeric: true })}</> : (<>
        <label className="check"><input type="checkbox" checked={c.setup.offsetOn} disabled={c.locked} onChange={(e) => set({ offsetOn: e.target.checked })} /> Include offset yield (optional)</label>
        {c.setup.offsetOn ? text('offsetPct', 'Offset', { unit: '% strain', required: true, numeric: true, hint: '0.05 to 5.' }) : null}
      </>)}
      {text('temperature', 'Temperature', { unit: '°C' })}{text('environment', 'Environment')}{text('notes', 'Notes')}
      {!c.locked ? <p><button type="button" className="link" onClick={() => set(EXAMPLE_SETTINGS[c.test])}>Fill example</button></p> : null}
      {lockNote}
    </>),
    dimensions: (<>
      {text('L0', 'Gauge length, L₀', { unit: 'mm', required: true, numeric: true })}
      {text('width', 'Width', { unit: 'mm', required: true, numeric: true })}
      {text('thickness', 'Thickness', { unit: 'mm', required: true, numeric: true })}
      {!c.locked ? <p><button type="button" className="link" onClick={() => set(EXAMPLE_DIMENSIONS)}>Fill example</button></p> : null}
      {lockNote}
    </>),
    review: (<>
      <dl className="facts">
        <div><dt>Source</dt><dd>{SOURCE_TEXT[c.choice].name}</dd></div>
        <div><dt>State</dt><dd>{st.name}</dd></div>
        <div><dt>Test</dt><dd>{isRelax ? 'Stress relaxation' : 'Uniaxial tension'}</dd></div>
        <div><dt>Material</dt><dd>{c.setup.material || '—'}</dd></div>
        <div><dt>Dimensions</dt><dd>{c.setup.L0 || '—'} × {c.setup.width || '—'} × {c.setup.thickness || '—'} mm (L₀ × width × thickness), typed</dd></div>
        <div><dt>Speed on the tester</dt><dd>{c.setup.speed || '—'} mm/min</dd></div>
        {isRelax ? <div><dt>Hold</dt><dd>{c.setup.holdMm || '—'} mm for {c.setup.holdS || '—'} s</dd></div> : null}
        {!isRelax && c.setup.offsetOn ? <div><dt>Offset yield</dt><dd>{c.setup.offsetPct || '—'} % strain</dd></div> : null}
      </dl>
      {c.startProblem ? <p className="hint" role="status">Start recording is not available: {c.startProblem}</p> : c.phase === 'setup' ? <p className="hint">Ready. Press Start recording, then start the test on the tester’s own controller.</p> : null}
    </>),
  };

  const stressView = isRelax ? 'Stress-time' : 'Stress-strain';
  return (
    <div className={'test-page' + (recording ? ' is-recording' : '') + (drawer ? ' drawer-open' : '')}>

      <div className="body">
        <aside className="setup" aria-label="Setup">
          <div className="setup-head"><h2>Setup</h2><button type="button" className="quiet drawer-close" onClick={() => setDrawer(false)}>Close</button></div>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.id}><button type="button" className={'step' + (s.id === step ? ' step-on' : '')} aria-current={s.id === step ? 'step' : undefined} onClick={() => setStep(s.id)}>
                <span className="step-n">{i + 1}</span>{s.name}{!stepBlock[s.id] && (s.id !== 'review') && (s.id !== 'device' || identity) && (s.id !== 'calibration' || readiness?.ready) ? <span className="step-done" aria-label="done">✓</span> : null}
              </button></li>
            ))}
          </ol>
          <section className="step-body" aria-labelledby="step-title">
            <h3 id="step-title">{stepIndex + 1}. {STEPS[stepIndex]?.name}</h3>
            {steps[step]}
          </section>
          <div className="step-nav">
            <button type="button" disabled={stepIndex === 0} onClick={() => setStep((STEPS[stepIndex - 1] as { id: StepId }).id)}>Back</button>
            {stepIndex < STEPS.length - 1 ? <button type="button" className="primary" disabled={!!stepBlock[step]} onClick={() => setStep((STEPS[stepIndex + 1] as { id: StepId }).id)}>Next</button> : null}
            {stepBlock[step] && stepIndex < STEPS.length - 1 ? <span className="hint step-why">{stepBlock[step]}</span> : null}
          </div>
        </aside>
        {drawer ? <button type="button" className="scrim" aria-label="Close setup" onClick={() => setDrawer(false)} /> : null}

        <main className="work" id="main-content">
          <StatusBar tone={st.tone} state={st.name} detail={(state === 'fault' || state === 'disconnected') && c.message ? c.message : st.detail}>
            {identity && c.connected ? <span className="status-device">{SOURCE_TEXT[c.choice].name} · {identity.deviceId}</span> : null}
            <button type="button" className="setup-button" onClick={() => setDrawer(true)}>Setup</button>
          </StatusBar>

          <div className="toolbar" role="toolbar" aria-label="Recording">
            {c.phase !== 'done' ? (<>
              <button type="button" onClick={() => c.zeroForce()} disabled={!c.connected || recording || latest?.force?.value == null} title="A software zero for this session. Not a calibration; nothing is sent to the tester.">Zero force</button>
              <button type="button" className="primary" onClick={() => c.startRecording()} disabled={recording || !!c.startProblem} title={c.startProblem || 'Start saving samples'}>Start recording</button>
              <button type="button" onClick={() => c.stopRecording()} disabled={!recording}>Stop recording</button>
            </>) : (<>
              <span className="menu">
                <button type="button" className="primary" aria-expanded={saveOpen} aria-haspopup="true" onClick={() => setSaveOpen((v) => !v)}>Save data</button>
                {saveOpen ? (
                  <span className="menu-list" role="menu">
                    {c.record ? <button type="button" role="menuitem" onClick={() => void doSave('csv')}>Test data (CSV, opens in Excel)</button> : null}
                    {c.record ? <button type="button" role="menuitem" onClick={() => void doSave('xlsx')}>Test data with chart (Excel .xlsx)</button> : null}
                    <button type="button" role="menuitem" onClick={() => void doSave('png')}>Graph picture (PNG)</button>
                    <button type="button" role="menuitem" onClick={() => void doSave('svg')}>Graph picture (SVG)</button>
                    <button type="button" role="menuitem" onClick={() => void doSave('samples')}>Every raw sample (CSV)</button>
                    <button type="button" role="menuitem" onClick={() => void doSave('session')}>Session file (for replay)</button>
                    {account?.user ? <button type="button" role="menuitem" onClick={() => void saveToLab()}>Save to lab database</button> : null}
                  </span>) : null}
              </span>
              <button type="button" onClick={() => (c.saved ? startNew() : setAsk('new'))}>New test</button>
              {!c.saved ? <span className="hint">Not saved yet.</span> : null}
            </>)}
            <span className="toolbar-note">The crosshead is moved from the tester’s own controller. This app only records.</span>
          </div>
          {c.message && c.connected ? <p className="notice" role="status">{c.message}</p> : null}

          <MeasurementStrip readings={readings} />

          <section className="graph-card" aria-label="Graph">
            <div className="views" role="group" aria-label="Graph view">
              {([['stress', stressView], ['force-disp', 'Force-displacement'], ['force-time', 'Force-time']] as const).map(([id, name]) => (
                <button key={id} type="button" className={view === id ? 'view-on' : ''} aria-pressed={view === id} onClick={() => setView(id)}>{name}</button>
              ))}
            </div>
            <Graph {...data} palette={theme === 'dark' ? DARK_GRAPH : LIGHT_GRAPH} live={recording} sourceTag={c.dataLabel}
              markers={view === 'stress' ? results.markers : []} fitLine={view === 'stress' ? results.fitLine : null}
              emptyText={c.phase === 'done' ? (c.recordProblem || 'No data was recorded.') : recording ? 'Waiting for readings…' : 'The curve appears here when recording starts.'}
              onSvg={(el) => { svg.current = el; }} />
          </section>

          {c.phase === 'done' ? (<>
            <Panel title="Key results" open>
              <p className="row">{c.session ? <span className="hint">{c.session.endReason}</span> : null}<label className="check defs-switch"><input type="checkbox" checked={showDefs} onChange={(e) => setShowDefs(e.target.checked)} /> Show definitions</label></p>
              {results.rows.length ? (
                <table className="results"><tbody>
                  {results.rows.map((r) => { const t = site.terms[TERM_FOR[r.id] ?? '']; return (
                    <tr key={r.id}><th scope="row">{r.name}{showDefs && t ? <span className="def">{t.def}{t.eq ? ' ' + t.eq + '.' : ''}</span> : null}</th><td className="num">{r.value}</td><td className="hint">{r.note}</td></tr>); })}
                </tbody></table>) : <p>{c.recordProblem || 'Too few points for key results.'}</p>}
              {results.rows.length ? <p className="hint">Strain is crosshead-based (crosshead displacement divided by the gauge length), not measured on the specimen. {c.dataLabel}.</p> : null}
            </Panel>
            <Panel title="Session details">
              <dl className="facts wide">{sessionDetails(c).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}</dl>
            </Panel>
          </>) : null}
        </main>
      </div>

      <dialog ref={dialog} className="ask" onCancel={(e) => { e.preventDefault(); setAsk(null); }} aria-labelledby="ask-title">
        <h2 id="ask-title">{ask === 'disconnect' ? 'Disconnect without saving?' : 'Start a new test without saving?'}</h2>
        <p>The data from this test has not been downloaded. It is kept only in this tab.</p>
        <p className="row">
          <button type="button" className="primary" onClick={() => proceed('save')}>Download and continue</button>
          <button type="button" onClick={() => proceed('discard')}>Don’t save and continue</button>
          <button type="button" onClick={() => setAsk(null)}>Cancel</button>
        </p>
      </dialog>
    </div>
  );
}
