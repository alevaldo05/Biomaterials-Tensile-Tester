/* The Test screen: setup steps beside the workspace (status, toolbar, measurements, graph, results).
   It shows what the controller holds. It has no device, board, or protocol knowledge. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { keyNumbers, sig } from '@tensile/core';
import type { TestType } from '@tensile/core';
import { Field, MeasurementStrip, Panel, StatusBar } from '@tensile/ui';
import type { Reading, Tone } from '@tensile/ui';
import type { SessionState } from '@tensile/recording';
import site from 'virtual:site-data';
import type { TestController } from './controller';
import type { Account } from './lab-api';
import { fileBase, samplesCsv, save, sessionDetails, svgText, svgToPng, testCsv, testXlsx } from './exports';
import { EXAMPLE_DIMENSIONS, EXAMPLE_SETTINGS, MATERIAL_CHOICES, setupProblems, STEP_FIELDS } from './setup';
import type { Setup } from './setup';
import { CalibrationPanel, DeviceFacts } from './components/DevicePanels';
import { RecordGraph } from './components/RecordGraph';
import { usePrintReport } from './components/usePrintReport';
import { ResultsTable } from './components/ResultsTable';

const STATE_TEXT: Record<SessionState, { tone: Tone; name: string; detail: string }> = {
  disconnected: { tone: 'idle', name: 'Not connected', detail: 'Connect the acquisition device in the Connect step.' },
  connecting: { tone: 'busy', name: 'Connecting', detail: 'Opening the connection.' },
  identifying: { tone: 'busy', name: 'Identifying', detail: 'Asking the device who it is and what it measures.' },
  'connected-uncalibrated': { tone: 'warn', name: 'Connected, uncalibrated', detail: 'Readings are shown in volts. Force, stress, and strain need a calibration.' },
  ready: { tone: 'ok', name: 'Ready to record', detail: 'Calibrated readings are arriving. This says nothing about whether the machine is ready to move.' },
  recording: { tone: 'live', name: 'Recording', detail: 'Samples are saved in memory and on this computer.' },
  stale: { tone: 'warn', name: 'Stale data', detail: 'No readings have arrived for 2 seconds.' },
  fault: { tone: 'bad', name: 'Fault', detail: 'The connection stopped because of a problem.' },
};
type StepId = 'test' | 'dimensions' | 'connection' | 'calibration' | 'review';
const STEPS: { id: StepId; name: string }[] = [
  { id: 'test', name: 'Test and method' }, { id: 'dimensions', name: 'Specimen' }, { id: 'connection', name: 'Connect and identify' },
  { id: 'calibration', name: 'Channels and calibration' }, { id: 'review', name: 'Review and start' },
];

export function useTheme(): [string, () => void] {
  /* Follows the computer's light or dark setting until the person chooses one in Settings. */
  const [theme, setTheme] = useState(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem('app-theme'); } catch { /* storage refused */ }
    return saved === 'dark' || saved === 'light' ? saved : typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  return [theme, () => setTheme((t) => { const n = t === 'dark' ? 'light' : 'dark'; try { localStorage.setItem('app-theme', n); } catch { /* the choice is just not remembered */ } return n; })];
}

export interface TestScreenProps {
  controller: TestController;
  serialAvailable: boolean;
  theme: string;
  account: Account | null;
  /** Tells the frame which help to show: the current step, or recording / done. */
  onHelpSub: (sub: string) => void;
}

/** The Test screen: setup steps beside the workspace. */
export function App({ controller: c, serialAvailable, theme, account, onHelpSub }: TestScreenProps) {
  useSyncExternalStore(c.subscribe, c.snapshot);
  const [step, setStep] = useState<StepId>('test');
  const [drawer, setDrawer] = useState(false);
  /* At 1100 px and narrower the setup is a drawer. While it is closed it is off screen, so keep it out of the Tab order. */
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(max-width: 1100px)').matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const q = window.matchMedia('(max-width: 1100px)'), on = () => setNarrow(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false); };   /* closes the drawer only; it sends nothing to any device */
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);
  const [touched, setTouched] = useState<Partial<Record<keyof Setup, boolean>>>({});
  const [ask, setAsk] = useState<null | 'new' | 'disconnect'>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const svg = useRef<SVGSVGElement | null>(null);
  const report = usePrintReport<HTMLElement>();
  const dialog = useRef<HTMLDialogElement | null>(null);

  const isRelax = c.test === 'relaxation', state = c.state, st = STATE_TEXT[state], recording = c.phase === 'recording';
  const problems = setupProblems(c.setup, c.test);
  const rec = c.live;
  const latest = c.recorder?.latest;
  const set = (patch: Partial<Setup>) => c.update((x) => { x.setup = { ...x.setup, ...patch }; });
  const show = (k: keyof Setup) => (touched[k] ? problems[k] : undefined);
  const touch = (k: keyof Setup) => () => setTouched((t) => ({ ...t, [k]: true }));

  useEffect(() => { onHelpSub(recording ? 'recording' : c.phase === 'done' ? 'done' : step); }, [step, recording, c.phase, onHelpSub]);
  useEffect(() => { if (recording) setDrawer(false); }, [recording]);
  useEffect(() => { document.title = (recording ? 'Recording · ' : c.phase === 'done' ? 'Stopped · ' : '') + 'Biomaterials Tensile Tester'; }, [recording, c.phase]);
  useEffect(() => { const d = dialog.current; if (!d) return; if (ask && !d.open) d.showModal(); if (!ask && d.open) d.close(); }, [ask]);

  /* ---------- measurement strip: a missing value is a dash, an uncalibrated one is volts ---------- */
  const live = (q: 'force' | 'displacement', unit: string): Reading => {
    const v = latest?.[q], label = q === 'force' ? 'Force' : 'Displacement';
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
    { label: 'Saved', value: c.localSave === 'saved' ? 'Locally' : c.localSave === 'saving' ? 'Saving' : c.localSave === 'error' ? 'Save error' : c.localSave === 'off' ? 'Memory only' : null },
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
  /* Sends the session file and the key results to the lab server. The file is the record. */
  const saveToLab = async () => {
    setSaveOpen(false);
    const f = c.sessionFile();
    if (!f || !account?.user) return;
    const nums = c.record ? keyNumbers(c.record, isRelax, { includeOffsetYield: true }) : {};
    const summary: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(nums)) summary[k] = typeof v === 'number' && Number.isFinite(v) ? v : null;
    try {
      const r = await account.api.saveSession(f, summary, c.setup.notes);
      c.update((x) => { x.saved = true; x.message = 'Saved to the lab server as test ' + r.id + ' (' + r.sampleCount + ' samples).'; });
    } catch (e) {
      c.update((x) => { x.message = 'Not saved to the lab server: ' + (e instanceof Error ? e.message : String(e)) + ' It is still saved on this computer.'; });
    }
  };
  const startNew = () => { c.newTest(); setTouched({}); setStep('dimensions'); };
  const proceed = (how: 'save' | 'discard') => {
    const what = ask;
    if (how === 'save') void doSave(c.record ? 'csv' : 'session');
    setAsk(null);
    if (what === 'new') startNew();
    if (what === 'disconnect') void c.disconnect();
  };

  /* ---------- setup steps ---------- */
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const stepBlock: Partial<Record<StepId, string>> = {
    test: STEP_FIELDS.specimen.concat(STEP_FIELDS.settings).map((k) => problems[k]).find(Boolean),
    dimensions: STEP_FIELDS.dimensions.map((k) => problems[k]).find(Boolean),
    connection: c.connected ? undefined : 'Connect to continue.',
  };
  const lockNote = c.locked ? <p className="hint">Setup is locked {recording ? 'while recording' : 'until New test'}.</p> : null;
  const text = (k: keyof Setup, label: string, o: { unit?: string; required?: boolean; hint?: string; numeric?: boolean } = {}) => (
    <Field label={label} {...(o.unit ? { unit: o.unit } : {})} {...(o.required ? { required: true } : {})} {...(show(k) ? { error: show(k) as string } : {})} {...(o.hint ? { hint: o.hint } : {})}>
      <input type="text" inputMode={o.numeric ? 'decimal' : 'text'} value={c.setup[k] as string} disabled={c.locked && k !== 'notes'} onChange={(e) => set({ [k]: e.target.value })} onBlur={touch(k)} aria-invalid={!!show(k)} />
    </Field>
  );

  const steps: Record<StepId, ReactNode> = {
    test: (<>
      {c.method ? <p className="hint">From method <strong>{c.method.name}</strong> (revision {c.method.revision}). <button type="button" className="link" disabled={c.locked} onClick={() => c.useMethod(null)}>Start without a method</button></p> : null}
      <Field label="Test">
        <select value={c.test} disabled={c.locked} onChange={(e) => c.update((x) => { x.test = e.target.value as TestType; })}>
          <option value="uniaxial">Uniaxial tension</option><option value="relaxation">Stress relaxation</option>
        </select>
      </Field>
      <Field label="Material" required {...(show('material') ? { error: show('material') as string } : {})}>
        <input type="text" list="materials" value={c.setup.material} disabled={c.locked} onChange={(e) => set({ material: e.target.value })} onBlur={touch('material')} aria-invalid={!!show('material')} />
      </Field>
      <datalist id="materials">{MATERIAL_CHOICES.concat(site.materials.map((m: { name: string }) => m.name)).map((m) => <option key={m} value={m} />)}</datalist>
      {text('speed', 'Crosshead speed to set on the tester', { unit: 'mm/min', required: true, numeric: true, hint: 'An instruction for the operator, written into the record. The app does not set the machine speed.' })}
      {isRelax ? <>{text('holdMm', 'Hold displacement (instruction)', { unit: 'mm', required: true, numeric: true })}{text('holdS', 'Hold duration (instruction)', { unit: 's', required: true, numeric: true })}</> : (<>
        <label className="check"><input type="checkbox" checked={c.setup.offsetOn} disabled={c.locked} onChange={(e) => set({ offsetOn: e.target.checked })} /> Include offset yield (optional)</label>
        {c.setup.offsetOn ? text('offsetPct', 'Offset', { unit: '% strain', required: true, numeric: true, hint: '0.05 to 5.' }) : null}
      </>)}
      {!c.locked ? <p><button type="button" className="link" onClick={() => set(EXAMPLE_SETTINGS[c.test])}>Fill example</button></p> : null}
      {lockNote}
    </>),
    dimensions: (<>
      {text('specimenId', 'Specimen ID')}
      {text('L0', 'Gauge length, L₀', { unit: 'mm', required: true, numeric: true })}
      {text('width', 'Width', { unit: 'mm', required: true, numeric: true })}
      {text('thickness', 'Thickness', { unit: 'mm', required: true, numeric: true })}
      {text('temperature', 'Temperature', { unit: '°C', hint: 'Leave empty if not known.' })}{text('environment', 'Environment', { hint: 'For example hydration condition.' })}{text('notes', 'Notes')}
      {!c.locked ? <p><button type="button" className="link" onClick={() => set(EXAMPLE_DIMENSIONS)}>Fill example</button></p> : null}
      {lockNote}
    </>),
    connection: (<>
      <dl className="facts">
        <div><dt>Connection</dt><dd>USB serial, 921600 baud</dd></div>
        <div><dt>State</dt><dd>{st.name}</dd></div>
      </dl>
      <p className="hint">You choose the port yourself; the app never opens one by itself. {serialAvailable ? '' : 'This browser cannot open USB serial ports: use Chrome on a computer, or the Windows app. '}The hardware connection is untested.</p>
      <p className="row">
        {c.connected ? <button type="button" onClick={() => (c.saved ? void c.disconnect() : setAsk('disconnect'))}>Disconnect</button>
          : <button type="button" className="primary" disabled={state === 'connecting' || state === 'identifying'} onClick={() => void c.connect()}>Connect…</button>}
      </p>
      {c.message && !c.connected ? <p className="error" role="alert">{c.message}</p> : null}
      <DeviceFacts c={c} />
    </>),
    calibration: <CalibrationPanel c={c} account={account} />,
    review: (<>
      <dl className="facts">
        <div><dt>Specimen ID</dt><dd>{c.setup.specimenId || '—'}</dd></div>
        <div><dt>Test</dt><dd>{isRelax ? 'Stress relaxation' : 'Uniaxial tension'}</dd></div>
        <div><dt>Method</dt><dd>{c.method ? c.method.name + ' (revision ' + c.method.revision + ')' : 'None'}</dd></div>
        <div><dt>Material</dt><dd>{c.setup.material || '—'}</dd></div>
        <div><dt>Dimensions</dt><dd>{c.setup.L0 || '—'} × {c.setup.width || '—'} × {c.setup.thickness || '—'} mm (L₀ × width × thickness)</dd></div>
        <div><dt>Channels</dt><dd>{c.source?.channels.map((ch) => ch.quantity).join(', ') || '—'}</dd></div>
        <div><dt>Calibration</dt><dd>{c.readiness ? (c.readiness.ready ? 'Matches' : c.voltagesOnly ? 'Voltages only' : 'Not calibrated') : '—'}</dd></div>
        <div><dt>Acquisition</dt><dd>{c.source?.settings ? c.source.settings.dataRate_sps + ' conversions/s, ±' + c.source.settings.fullScale_mV + ' mV' : '—'}</dd></div>
        <div><dt>Software baseline</dt><dd>{c.recorder && c.recorder.forceZero_N ? sig(c.recorder.forceZero_N, 4) + ' N' : 'None'}</dd></div>
        <div><dt>Speed to set</dt><dd>{c.setup.speed || '—'} mm/min (on the tester)</dd></div>
        {isRelax ? <div><dt>Hold</dt><dd>{c.setup.holdMm || '—'} mm for {c.setup.holdS || '—'} s (instruction)</dd></div> : null}
        <div><dt>Saved to</dt><dd>{c.localSave === 'off' ? 'Memory only (download when done)' : 'This computer'}{account?.user ? '; the lab server when you choose Save' : ''}</dd></div>
      </dl>
      {c.startProblem ? <p className="hint" role="status">Start recording is not available: {c.startProblem}</p> : c.phase === 'setup' ? <p className="hint">Ready to record. Press Start recording, then start the test on the tester’s own controller.</p> : null}
    </>),
  };

  return (
    <div className={'test-page' + (recording ? ' is-recording' : '') + (drawer ? ' drawer-open' : '')}>
      <div className="body">
        <aside className="setup" aria-label="Setup" inert={narrow && !drawer}>
          <div className="setup-head"><h2>Setup</h2><button type="button" className="quiet drawer-close" onClick={() => setDrawer(false)}>Close</button></div>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.id}><button type="button" className={'step' + (s.id === step ? ' step-on' : '')} aria-current={s.id === step ? 'step' : undefined} onClick={() => setStep(s.id)}>
                <span className="step-n">{i + 1}</span>{s.name}{!stepBlock[s.id] && s.id !== 'review' && (s.id !== 'calibration' || c.readiness?.ready) ? <span className="step-done" aria-label="done">✓</span> : null}
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

        <main className="work" id="main-content" ref={report.ref}>
          {c.phase === 'done' ? (
            <div className="print-only print-head">
              <p><strong>Test report · Draft</strong> · printed {new Date().toLocaleString()}</p>
              <p>Data: measured, recorded from the acquisition device by this app{c.startedAt ? ' on ' + c.startedAt.toLocaleString() : ''}. {c.setup.material ? 'Material: ' + c.setup.material + '. ' : ''}{c.setup.specimenId ? 'Specimen: ' + c.setup.specimenId + '. ' : ''}The hardware connection is untested.</p>
            </div>) : null}
          <StatusBar tone={st.tone} state={st.name} detail={(state === 'fault' || state === 'disconnected') && c.message ? c.message : st.detail}>
            <button type="button" className="setup-button" onClick={() => setDrawer(true)}>Setup</button>
          </StatusBar>

          <div className="toolbar" role="toolbar" aria-label="Recording">
            {c.phase !== 'done' ? (<>
              <button type="button" onClick={() => c.zeroForce()} disabled={!c.connected || recording || latest?.force?.value == null} title="Subtracted in results and recorded with the test. Not a machine tare or a calibration; nothing is sent to the tester.">Software baseline</button>
              <button type="button" className="primary" onClick={() => void c.startRecording()} disabled={recording || !!c.startProblem} title={c.startProblem || 'Start saving samples'}>Start recording</button>
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
                    <button type="button" role="menuitem" onClick={() => void doSave('session')}>Session file (full record)</button>
                    <button type="button" role="menuitem" onClick={() => { setSaveOpen(false); report.print(); }}>Print report (save as PDF from the print window)</button>
                    {account?.user ? <button type="button" role="menuitem" onClick={() => void saveToLab()}>Save to the lab server</button> : null}
                  </span>) : null}
              </span>
              <button type="button" onClick={() => (c.saved || c.localSave === 'saved' ? startNew() : setAsk('new'))}>New test</button>
              {!c.saved && c.localSave !== 'saved' ? <span className="hint">Not saved yet.</span> : null}
            </>)}
            <span className="toolbar-note">The crosshead is moved and stopped from the tester’s own controller. This app only records.</span>
          </div>
          {c.message && c.connected ? <p className="notice" role="status">{c.message}</p> : null}
          {c.localSave === 'error' ? <p className="notice notice-bad" role="alert">{c.localError}</p> : null}

          <MeasurementStrip readings={readings} />

          <RecordGraph record={rec} test={c.test} theme={report.printing ? 'light' : theme} live={recording} showResults={c.phase === 'done'} sourceTag={rec ? c.dataLabel : ''}
            emptyText={c.phase === 'done' ? (c.recordProblem || 'No data was recorded.') : recording ? 'Waiting for readings…' : 'The curve appears here when recording starts.'}
            onSvg={(el) => { svg.current = el; }} />

          {c.phase === 'done' ? (<>
            <Panel title="Key results" open>
              <ResultsTable record={c.record} problem={c.recordProblem} note={c.session?.endReason ?? ''} />
            </Panel>
            <Panel title="Session details">
              <dl className="facts wide">{sessionDetails(c).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}</dl>
            </Panel>
          </>) : null}
        </main>
      </div>

      <dialog ref={dialog} className="ask" onCancel={(e) => { e.preventDefault(); setAsk(null); }} aria-labelledby="ask-title">
        <h2 id="ask-title">{ask === 'disconnect' ? 'Disconnect without saving?' : 'Start a new test without saving?'}</h2>
        <p>The data from this test has not been downloaded or saved on this computer.</p>
        <p className="row">
          <button type="button" className="primary" onClick={() => proceed('save')}>Download and continue</button>
          <button type="button" onClick={() => proceed('discard')}>Don’t save and continue</button>
          <button type="button" onClick={() => setAsk(null)}>Cancel</button>
        </p>
      </dialog>
    </div>
  );
}
