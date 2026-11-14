/* The Test screen, in one window: the quick settings on the left (a slim rail while recording and after the test,
   a drawer opened with Setup on narrow windows), the graph with its action bar in the middle, live readouts or key
   results on the right, and this run's specimens along the bottom. It shows what the controller holds. It has no
   device, board, or protocol knowledge, and it sends nothing to the tester. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { keyNumbers, sig } from '@tensile/core';
import type { TestType } from '@tensile/core';
import { Field, Panel, StatusBar } from '@tensile/ui';
import type { Reading, Tone } from '@tensile/ui';
import type { SessionState } from '@tensile/recording';
import site from 'virtual:site-data';
import type { TestController } from './controller';
import type { Account } from './lab-api';
import { fileBase, samplesCsv, save, sessionDetails, svgText, svgToPng, testCsv, testXlsx } from './exports';
import { EXAMPLE_DIMENSIONS, EXAMPLE_SETTINGS, MATERIAL_CHOICES, num, setupProblems, STEP_FIELDS } from './setup';
import type { Setup } from './setup';
import type { RunTest } from './run-tests';
import { CalibrationPanel, DeviceFacts } from './components/DevicePanels';
import { RecordGraph } from './components/RecordGraph';
import { usePrintReport } from './components/usePrintReport';
import { ResultsTable } from './components/ResultsTable';
import { SaveMenu } from './components/SaveMenu';
import type { MenuItem } from './components/SaveMenu';

const STATE_TEXT: Record<SessionState, { tone: Tone; name: string; detail: string }> = {
  disconnected: { tone: 'idle', name: 'Not connected', detail: 'Connect the acquisition device under Connection in the quick settings.' },
  connecting: { tone: 'busy', name: 'Connecting', detail: 'Opening the connection.' },
  identifying: { tone: 'busy', name: 'Identifying', detail: 'Asking the device who it is and what it measures.' },
  'connected-uncalibrated': { tone: 'warn', name: 'Connected, uncalibrated', detail: 'Readings are shown in volts. Force, stress, and strain need a calibration.' },
  ready: { tone: 'ok', name: 'Ready to record', detail: 'Calibrated readings are arriving. This says nothing about whether the machine is ready to move.' },
  recording: { tone: 'live', name: 'Recording', detail: 'Samples are saved in memory and on this computer.' },
  stale: { tone: 'warn', name: 'Stale data', detail: 'No readings have arrived for 2 seconds.' },
  fault: { tone: 'bad', name: 'Fault', detail: 'The connection stopped because of a problem.' },
};
/* The quick settings, in order. Each part has its own help (help-text.ts, "test.<id>"). */
type SectionId = 'test' | 'dimensions' | 'connection' | 'calibration' | 'review';
const SECTIONS: { id: SectionId; name: string }[] = [
  { id: 'test', name: 'Test' }, { id: 'dimensions', name: 'Specimen' }, { id: 'connection', name: 'Connection' },
  { id: 'calibration', name: 'Setup file and calibration' }, { id: 'review', name: 'Before you start' },
];
const NOTE = 'Move and stop the crosshead on the tester’s own controller. This app only records.';

const icon = (d: ReactNode, size = 18) => <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const ICON = {
  left: icon(<path d="M15 6l-6 6 6 6" />, 20), right: icon(<path d="M9 6l6 6-6 6" />, 20),
  lock: icon(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  zero: icon(<><circle cx="12" cy="12" r="8" /><path d="M8 12h8" /></>), rec: icon(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>),
  stop: icon(<rect x="7" y="7" width="10" height="10" rx="1" />), plus: icon(<path d="M12 5v14M5 12h14" />),
  warn: icon(<><path d="M12 3l9 16H3z" /><path d="M12 10v4" /><path d="M12 17h.01" /></>, 16), sliders: icon(<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4" />),
};

export interface TestScreenProps {
  controller: TestController;
  serialAvailable: boolean;
  theme: string;
  account: Account | null;
  /** Tells the frame which help to show: the part of the quick settings in use, or recording / done. */
  onHelpSub: (sub: string) => void;
  /** Tests finished in this run of the app (the Specimens strip). */
  runTests: RunTest[];
}

/** The Test screen. */
export function App({ controller: c, serialAvailable, theme, account, onHelpSub, runTests }: TestScreenProps) {
  useSyncExternalStore(c.subscribe, c.snapshot);
  const [section, setSection] = useState<SectionId>('test');
  const [drawer, setDrawer] = useState(false);
  /* null: follow the phase (open while setting up, a rail while recording and after the test). */
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  /* At 1100 px and narrower the quick settings are a drawer. While it is closed it is off screen, so keep it out of the Tab order. */
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
  /* Focus goes into the drawer when it opens, and back to the Setup button when it closes. */
  const setupButton = useRef<HTMLButtonElement | null>(null), quickTitle = useRef<HTMLHeadingElement | null>(null), wasDrawer = useRef(false);
  useEffect(() => {
    if (drawer) { wasDrawer.current = true; quickTitle.current?.focus(); }
    else if (wasDrawer.current) { wasDrawer.current = false; if (narrow) setupButton.current?.focus(); }
  }, [drawer, narrow]);
  const [touched, setTouched] = useState<Partial<Record<keyof Setup, boolean>>>({});
  const [ask, setAsk] = useState<null | 'new' | 'disconnect'>(null);
  const svg = useRef<SVGSVGElement | null>(null);
  const report = usePrintReport<HTMLElement>();
  const dialog = useRef<HTMLDialogElement | null>(null);
  const specimenInput = useRef<HTMLInputElement | null>(null), [focusSpecimen, setFocusSpecimen] = useState(false);

  const isRelax = c.test === 'relaxation', state = c.state, st = STATE_TEXT[state], recording = c.phase === 'recording', done = c.phase === 'done';
  const problems = setupProblems(c.setup, c.test);
  const rec = c.live;
  const latest = c.recorder?.latest;
  const set = (patch: Partial<Setup>) => c.update((x) => { x.setup = { ...x.setup, ...patch }; });
  const show = (k: keyof Setup) => (touched[k] ? problems[k] : undefined);
  const touch = (k: keyof Setup) => () => setTouched((t) => ({ ...t, [k]: true }));
  const rail = !narrow && (collapsed ?? c.locked);

  useEffect(() => { onHelpSub(recording ? 'recording' : done ? 'done' : section); }, [section, recording, done, onHelpSub]);
  useEffect(() => { if (recording) setDrawer(false); }, [recording]);
  useEffect(() => { setCollapsed(null); }, [c.phase]);
  useEffect(() => { document.title = (recording ? 'Recording · ' : done ? 'Stopped · ' : '') + 'Biomaterials Tensile Tester'; }, [recording, done]);
  useEffect(() => { const d = dialog.current; if (!d) return; if (ask && !d.open) d.showModal(); if (!ask && d.open) d.close(); }, [ask]);
  useEffect(() => { if (focusSpecimen && specimenInput.current) { specimenInput.current.focus(); setFocusSpecimen(false); } }, [focusSpecimen, rail]);

  /* ---------- live readouts: a missing value is a dash, an uncalibrated one is volts ---------- */
  const live = (q: 'force' | 'displacement', unit: string): Reading => {
    const v = latest?.[q], label = q === 'force' ? 'Force' : 'Displacement';
    if (done) { const last = (q === 'force' ? rec?.raw?.F : rec?.raw?.d)?.at(-1); return { label, value: last === undefined ? null : sig(last, 4), unit }; }
    if (!v || !c.connected) return { label, value: null };
    if (v.value !== null) return { label, value: sig(q === 'force' ? v.value - (c.recorder?.forceZero_N ?? 0) : v.value, 4), unit };
    return { label, value: sig(v.volts_signal ?? v.volts_adc, 4), unit: 'V', note: v.volts_signal === null ? 'at the ADC, uncalibrated' : 'uncalibrated' };
  };
  const n = rec ? rec.x.length : 0, lastT = rec?.raw?.t?.[n - 1], lastY = rec?.y[n - 1], lastD = rec?.raw?.d?.[n - 1], L0 = num(c.setup.L0);
  /* Strain is crosshead-based: the recorded strain (uniaxial), or the displacement over the gauge length (relaxation). */
  const lastStrain = !isRelax ? rec?.x[n - 1] : lastD !== undefined && L0 ? lastD / L0 : undefined;
  const has = (v: number | undefined): v is number => c.phase !== 'setup' && v !== undefined && Number.isFinite(v);
  const readings: Reading[] = [
    live('force', 'N'), live('displacement', 'mm'),
    { label: 'Stress', value: has(lastY) ? sig(lastY, 4) : null, unit: 'MPa' },
    { label: 'Strain', value: has(lastStrain) ? sig(lastStrain, 4) : null, unit: 'mm/mm' },
    { label: 'Elapsed', value: has(lastT) ? sig(lastT, 4) : null, unit: 's' },
  ];
  const saveState = c.localSave === 'saved' ? 'On this computer' : c.localSave === 'saving' ? 'Saving' : c.localSave === 'error' ? 'Save error' : c.localSave === 'off' ? 'Memory only' : null;

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
  };
  /* Sends the session file and the key results to the lab server. The file is the record. */
  const saveToLab = async () => {
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
  const item = (key: string, label: string, onSelect: () => void): MenuItem => ({ id: key, label, onSelect });
  const saveItems: MenuItem[] = [
    ...(c.record ? [item('csv', 'Test data (CSV, opens in Excel)', () => void doSave('csv')), item('xlsx', 'Test data with chart (Excel .xlsx)', () => void doSave('xlsx'))] : []),
    item('png', 'Graph picture (PNG)', () => void doSave('png')), item('svg', 'Graph picture (SVG)', () => void doSave('svg')),
    item('samples', 'Every raw sample (CSV)', () => void doSave('samples')), item('session', 'Session file (full record)', () => void doSave('session')),
    item('print', 'Print report (save as PDF from the print window)', () => report.print()),
    ...(account?.user ? [item('lab', 'Save to the lab server', () => void saveToLab())] : []),
  ];
  const startNew = () => { c.newTest(); setTouched({}); setSection('dimensions'); if (!narrow) setFocusSpecimen(true); };
  const proceed = (how: 'save' | 'discard') => {
    const what = ask;
    if (how === 'save') void doSave(c.record ? 'csv' : 'session');
    setAsk(null);
    if (what === 'new') startNew();
    if (what === 'disconnect') void c.disconnect();
  };

  /* ---------- quick settings ---------- */
  const block: Record<SectionId, string | undefined> = {
    test: STEP_FIELDS.specimen.concat(STEP_FIELDS.settings).map((k) => problems[k]).find(Boolean),
    dimensions: STEP_FIELDS.dimensions.map((k) => problems[k]).find(Boolean),
    connection: c.connected ? undefined : 'Connect the acquisition device.',
    calibration: c.readiness?.ready ? undefined : c.voltagesOnly ? undefined : c.readiness ? 'Not calibrated: load the setup file for this tester.' : 'Connect first.',
    review: c.startProblem || undefined,
  };
  const lockNote = c.locked ? <p className="hint lock-note">{ICON.lock} Locked {recording ? 'while recording' : 'until New test'}.</p> : null;
  const text = (k: keyof Setup, label: string, o: { unit?: string; required?: boolean; hint?: string; numeric?: boolean; ref?: React.Ref<HTMLInputElement> } = {}) => (
    <Field label={label} {...(o.unit ? { unit: o.unit } : {})} {...(o.required ? { required: true } : {})} {...(show(k) ? { error: show(k) as string } : {})} {...(o.hint ? { hint: o.hint } : {})}>
      <input type="text" inputMode={o.numeric ? 'decimal' : 'text'} value={c.setup[k] as string} disabled={c.locked && k !== 'notes'} onChange={(e) => set({ [k]: e.target.value })} onBlur={touch(k)} aria-invalid={!!show(k)} {...(o.ref ? { ref: o.ref } : {})} />
    </Field>
  );
  const w = num(c.setup.width), t = num(c.setup.thickness);
  const calName = c.readiness ? (c.readiness.ready ? 'Matches' : c.voltagesOnly ? 'Voltages only' : 'Not calibrated') : '—';

  const parts: Record<SectionId, ReactNode> = {
    test: (<>
      {c.method ? <p className="hint">From method <strong>{c.method.name}</strong> (revision {c.method.revision}). <button type="button" className="link" disabled={c.locked} onClick={() => c.useMethod(null)}>Start without a method</button></p> : null}
      <Field label="Test type">
        <select value={c.test} disabled={c.locked} onChange={(e) => c.update((x) => { x.test = e.target.value as TestType; })}>
          <option value="uniaxial">Uniaxial tension</option><option value="relaxation">Stress relaxation</option>
        </select>
      </Field>
      <Field label="Material" required {...(show('material') ? { error: show('material') as string } : {})}>
        <input type="text" list="materials" value={c.setup.material} disabled={c.locked} onChange={(e) => set({ material: e.target.value })} onBlur={touch('material')} aria-invalid={!!show('material')} />
      </Field>
      <datalist id="materials">{MATERIAL_CHOICES.concat(site.materials.map((m: { name: string }) => m.name)).map((m) => <option key={m} value={m} />)}</datalist>
      {text('speed', 'Speed to set on the tester', { unit: 'mm/min', required: true, numeric: true, hint: 'An instruction for the operator, written into the record. The app does not set the machine speed.' })}
      {isRelax ? <>{text('holdMm', 'Hold displacement (instruction)', { unit: 'mm', required: true, numeric: true })}{text('holdS', 'Hold duration (instruction)', { unit: 's', required: true, numeric: true })}</> : (<>
        <label className="check"><input type="checkbox" checked={c.setup.offsetOn} disabled={c.locked} onChange={(e) => set({ offsetOn: e.target.checked })} /> Include offset yield (optional)</label>
        {c.setup.offsetOn ? text('offsetPct', 'Offset', { unit: '% strain', required: true, numeric: true, hint: '0.05 to 5.' }) : null}
      </>)}
      {!c.locked ? <p><button type="button" className="link" onClick={() => set(EXAMPLE_SETTINGS[c.test])}>Fill example</button></p> : null}
    </>),
    dimensions: (<>
      {text('specimenId', 'Specimen ID', { ref: specimenInput })}
      <fieldset className="dims">
        <legend>Dimensions (mm)</legend>
        <div className="dims-row">
          {text('L0', 'Gauge length', { required: true, numeric: true })}
          {text('width', 'Width', { required: true, numeric: true })}
          {text('thickness', 'Thickness', { required: true, numeric: true })}
        </div>
        {w !== null && t !== null && w > 0 && t > 0 ? <p className="hint">Area {sig(w * t, 4)} mm² (width × thickness)</p> : null}
      </fieldset>
      <details className="more">
        <summary>More details (temperature, environment, notes)</summary>
        <div className="more-body">
          {text('temperature', 'Temperature', { unit: '°C', hint: 'Leave empty if not known.' })}{text('environment', 'Environment', { hint: 'For example hydration condition.' })}{text('notes', 'Notes')}
        </div>
      </details>
      {!c.locked ? <p><button type="button" className="link" onClick={() => set(EXAMPLE_DIMENSIONS)}>Fill example</button></p> : null}
    </>),
    connection: (<>
      <p className={'conn-state conn-' + st.tone}><span className="conn-dot" aria-hidden="true" /><strong>{st.name}</strong></p>
      <p className="hint">USB serial, 921600 baud. You choose the port yourself; the app never opens one by itself. {serialAvailable ? '' : 'This browser cannot open USB serial ports: use Chrome on a computer, or the Windows app. '}The hardware connection is untested.</p>
      <p className="row">
        {/* after a fault the port is still open: both Disconnect and Connect (which closes the old connection first) are offered */}
        {c.connected || c.state === 'fault' ? <button type="button" onClick={() => (c.saved ? void c.disconnect() : setAsk('disconnect'))}>Disconnect</button> : null}
        {!c.connected ? <button type="button" className="primary" disabled={state === 'connecting' || state === 'identifying'} onClick={() => void c.connect()}>Connect…</button> : null}
      </p>
      {c.message && !c.connected ? <p className="error" role="alert">{c.message}</p> : null}
      <details className="more"><summary>Device details</summary><div className="more-body"><DeviceFacts c={c} /></div></details>
    </>),
    calibration: <CalibrationPanel c={c} account={account} />,
    review: (<>
      <ul className="checks">
        {SECTIONS.filter((s) => s.id !== 'review').map((s) => (
          <li key={s.id} className={block[s.id] ? 'check-no' : 'check-ok'}><span aria-hidden="true">{block[s.id] ? '•' : '✓'}</span> <strong>{s.name}:</strong> {block[s.id] ?? (s.id === 'calibration' ? calName : 'ready')}</li>))}
      </ul>
      <details className="more">
        <summary>All details</summary>
        <dl className="facts more-body">
          <div><dt>Method</dt><dd>{c.method ? c.method.name + ' (revision ' + c.method.revision + ')' : 'None'}</dd></div>
          <div><dt>Channels</dt><dd>{c.source?.channels.map((ch) => ch.quantity).join(', ') || '—'}</dd></div>
          <div><dt>Acquisition</dt><dd>{c.source?.settings ? c.source.settings.dataRate_sps + ' conversions/s, ±' + c.source.settings.fullScale_mV + ' mV' : '—'}</dd></div>
          <div><dt>Zero force</dt><dd>{c.recorder && c.recorder.forceZero_N ? sig(c.recorder.forceZero_N, 4) + ' N (software baseline)' : 'None'}</dd></div>
          {isRelax ? <div><dt>Hold</dt><dd>{c.setup.holdMm || '—'} mm for {c.setup.holdS || '—'} s (instruction)</dd></div> : null}
          <div><dt>Saved to</dt><dd>{c.localSave === 'off' ? 'Memory only (download when done)' : 'This computer'}{account?.user ? '; the lab server when you choose Save' : ''}</dd></div>
        </dl>
      </details>
      {c.phase === 'setup' ? (c.startProblem ? <p className="hint">Start recording is not available: {c.startProblem}</p> : <p className="hint">Ready to record. Press Start recording, then start the test on the tester’s own controller.</p>) : null}
    </>),
  };

  const summary = [c.setup.specimenId || 'No specimen ID', c.setup.material || 'no material'].join(' · ');
  const dims = (c.setup.L0 || '—') + ' × ' + (c.setup.width || '—') + ' × ' + (c.setup.thickness || '—') + ' mm · ' + (c.setup.speed || '—') + ' mm/min';

  /* ---------- this run's specimens: finished tests, then the one recording or the next one ---------- */
  const currentId = c.startedAt?.toISOString() ?? '';
  const strip: (Omit<RunTest, 'status'> & { status: RunTest['status'] | 'Recording' | 'Next'; current: boolean })[] = runTests.map((r) => ({ ...r, current: r.id === currentId }));
  if (!done) strip.push({ id: 'next', specimenId: c.setup.specimenId, material: c.setup.material, test: c.test, status: recording ? 'Recording' : 'Next', modulus: '—', peak: '—', saved: recording ? (saveState ?? '—') : '—', current: true });

  return (
    <main className={'test-page' + (recording ? ' is-recording' : '') + (done ? ' is-done' : '') + (drawer ? ' drawer-open' : '') + (rail ? ' has-rail' : '')} id="main-content" ref={report.ref}>
      {done ? (
        <div className="print-only print-head">
          <p><strong>Test report · Draft</strong> · printed {new Date().toLocaleString()}</p>
          <p>Data: measured, recorded from the acquisition device by this app{c.startedAt ? ' on ' + c.startedAt.toLocaleString() : ''}. {c.setup.material ? 'Material: ' + c.setup.material + '. ' : ''}{c.setup.specimenId ? 'Specimen: ' + c.setup.specimenId + '. ' : ''}The hardware connection is untested.</p>
        </div>) : null}
      <h1 className="sr-only">Test</h1>

      {/* Narrow windows: the quick settings open as a drawer from here. */}
      <div className="test-top">
        <button type="button" className="setup-button" ref={setupButton} aria-expanded={drawer} aria-controls="quick-settings" onClick={() => setDrawer(true)}>{ICON.sliders}Setup</button>
        <p className="test-top-summary">{c.locked ? <span className="lock-tag">{ICON.lock}Locked</span> : null}{summary} · {dims}</p>
      </div>

      <div className="test-grid">
        <aside className={'quick' + (rail ? ' quick-rail' : '')} id="quick-settings" aria-labelledby="quick-title" inert={narrow && !drawer}>
          {rail ? (<>
            <h2 id="quick-title" className="sr-only">Quick settings</h2>
            <button type="button" className="rail-button" aria-label="Show quick settings" aria-expanded="false" aria-controls="quick-settings" onClick={() => setCollapsed(false)}>{ICON.right}</button>
            {c.locked ? <span className="rail-lock">{ICON.lock}<span>Locked</span></span> : null}
            <p className="rail-id">{c.setup.specimenId || '—'}</p>
          </>) : (<>
            <div className="quick-head">
              <h2 id="quick-title" ref={quickTitle} tabIndex={-1}>Quick settings</h2>
              {narrow ? <button type="button" className="quiet drawer-close" onClick={() => setDrawer(false)}>Close</button>
                : <button type="button" className="icon-button" aria-label="Collapse quick settings" aria-expanded="true" aria-controls="quick-settings" onClick={() => setCollapsed(true)}>{ICON.left}</button>}
            </div>
            {lockNote}
            {SECTIONS.map((s) => (
              <section key={s.id} className={'quick-part' + (section === s.id ? ' part-on' : '')} aria-labelledby={'part-' + s.id} onFocusCapture={() => setSection(s.id)} onPointerDown={() => setSection(s.id)}>
                <h3 id={'part-' + s.id}>{s.name}{s.id !== 'review' ? (block[s.id] ? null : <span className="part-done" aria-label="(done)"> ✓</span>) : null}</h3>
                {parts[s.id]}
              </section>
            ))}
          </>)}
        </aside>
        {drawer ? <button type="button" className="scrim" aria-label="Close setup" onClick={() => setDrawer(false)} /> : null}

        <div className="test-center">
          <StatusBar tone={st.tone} state={st.name} detail={(state === 'fault' || state === 'disconnected') && c.message ? c.message : st.detail} />
          {c.message && c.connected ? <p className="notice" role="status">{c.message}</p> : null}
          {c.localSave === 'error' ? <p className="notice notice-bad" role="alert">{c.localError}</p> : null}

          <RecordGraph record={rec} test={c.test} theme={report.printing ? 'light' : theme} live={recording} showResults={done} sourceTag={rec ? c.dataLabel : ''}
            emptyText={done ? (c.recordProblem || 'No data was recorded.') : recording ? 'Waiting for readings…' : 'Waiting for recording'}
            onSvg={(el) => { svg.current = el; }}>
            <div className="actions" role="group" aria-label="Recording">
              {!done ? (<>
                {recording ? <span className="rec-pill"><span className="rec-dot" aria-hidden="true" />Recording</span> : null}
                <button type="button" className="outline" onClick={() => c.zeroForce()} disabled={!c.connected || recording || latest?.force?.value == null} aria-describedby="zero-what"
                  title="A software baseline: subtracted in the results and recorded with the test. Not a machine tare or a calibration; nothing is sent to the tester.">{ICON.zero}Zero force</button>
                <span id="zero-what" className="sr-only">A software baseline: subtracted in the results and recorded with the test. Not a machine tare or a calibration; nothing is sent to the tester.</span>
                {recording ? <button type="button" className="strong" onClick={() => c.stopRecording()}>{ICON.stop}End recording</button>
                  : <button type="button" className="primary" onClick={() => void c.startRecording()} disabled={!!c.startProblem} title={c.startProblem || 'Start saving samples'}>{ICON.rec}Start recording</button>}
              </>) : (<>
                <SaveMenu items={saveItems} />
                <button type="button" className="outline" onClick={() => (c.saved || c.localSave === 'saved' ? startNew() : setAsk('new'))}>{ICON.plus}New test</button>
                <span className={'save-state' + (c.saved || c.localSave === 'saved' ? ' save-ok' : '')}>{c.saved ? 'Downloaded or saved to the lab server' : c.localSave === 'saved' ? 'Saved on this computer' : 'Not saved yet.'}</span>
              </>)}
              {c.phase === 'setup' && c.startProblem ? <p className="hint start-why">Start recording is not available: {c.startProblem}</p> : null}
              <p className="actions-note">{ICON.warn}<span>{NOTE}</span></p>
            </div>
          </RecordGraph>
        </div>

        <aside className="side" aria-label={done ? 'Results' : 'Live readouts'}>
          {done ? (
            <section className="side-card" aria-labelledby="kr-title">
              <h2 id="kr-title">Key results</h2>
              <ResultsTable record={c.record} problem={c.recordProblem} note={c.session?.endReason ?? ''} />
            </section>
          ) : (
            <section className="side-card" aria-labelledby="live-title">
              <h2 id="live-title">Live</h2>
              <dl className="live-list">
                {readings.map((r) => (
                  <div key={r.label}><dt>{r.label}</dt><dd><span className="live-value">{r.value ?? '—'}</span>{r.value !== null && r.unit ? <span className="live-unit"> {r.unit}</span> : null}{r.note ? <span className="live-note">{r.note}</span> : null}</dd></div>))}
              </dl>
              <dl className="facts live-extra">
                <div><dt>Rate</dt><dd>{c.rate !== null && c.phase !== 'setup' ? sig(c.rate, 3) + ' samples/s' : '—'}</dd></div>
                <div><dt>Saved</dt><dd>{saveState ?? '—'}</dd></div>
              </dl>
            </section>
          )}
          <section className="side-card side-summary" aria-label="This specimen">
            <p className={'side-state' + (recording ? ' side-live' : '')}><span className="rec-dot" aria-hidden="true" />{recording ? 'Recording' : done ? (c.session?.interrupted ? 'Interrupted' : 'Done') : 'Not recording'}</p>
            <p>{summary}</p>
            <p>{dims}</p>
          </section>
          {done ? (
            <Panel title="Session details">
              <dl className="facts">{sessionDetails(c).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || '—'}</dd></div>)}</dl>
            </Panel>) : null}
        </aside>
      </div>

      <section className="specimens" aria-labelledby="spec-title">
        <div className="specimens-head"><h2 id="spec-title">Specimens</h2><p className="hint">Tests finished since the app was opened; older tests are in Load test.</p></div>
        <div className="spec-scroll spec-table-box">
          <table className="spec-table">
            <thead><tr><th scope="col">Specimen</th><th scope="col">Material</th><th scope="col">Status</th><th scope="col" className="num">Modulus estimate</th><th scope="col" className="num">Peak stress</th><th scope="col">Saved</th></tr></thead>
            <tbody>
              {strip.map((r) => (
                <tr key={r.id} aria-current={r.current ? 'true' : undefined} className={r.current ? 'spec-on' : ''}>
                  <th scope="row">{r.specimenId || '—'}</th><td>{r.material || '—'}</td><td className={'spec-status spec-' + r.status.toLowerCase()}>{r.status}</td>
                  <td className="num">{r.modulus}</td><td className="num">{r.peak}</td><td>{r.saved}</td>
                </tr>))}
            </tbody>
          </table>
        </div>
        <ul className="spec-scroll spec-cards" aria-label="Specimens, swipe sideways for more">
          {strip.map((r) => (
            <li key={r.id} aria-current={r.current ? 'true' : undefined} className={r.current ? 'spec-on' : ''}>
              <p className="spec-card-title">{r.specimenId || '—'} · <span className={'spec-status spec-' + r.status.toLowerCase()}>{r.status}</span></p>
              <p>{r.material || '—'}</p>
              {r.status === 'Done' || r.status === 'Interrupted' ? <><p>Modulus <span className="num">{r.modulus}</span></p><p>Peak stress <span className="num">{r.peak}</span></p><p className="hint">{r.saved}</p></> : null}
            </li>))}
        </ul>
      </section>

      <dialog ref={dialog} className="ask" onCancel={(e) => { e.preventDefault(); setAsk(null); }} aria-labelledby="ask-title">
        <h2 id="ask-title">{ask === 'disconnect' ? 'Disconnect without saving?' : 'Start a new test without saving?'}</h2>
        <p>The data from this test has not been downloaded or saved on this computer.</p>
        <p className="row">
          <button type="button" className="primary" onClick={() => proceed('save')}>Download and continue</button>
          <button type="button" onClick={() => proceed('discard')}>Don’t save and continue</button>
          <button type="button" onClick={() => setAsk(null)}>Cancel</button>
        </p>
      </dialog>
    </main>
  );
}
