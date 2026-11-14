/* Load test: open a recorded test (a session file saved by this app, or a CSV file), see its graph and key results,
   and export it. Opening never sends anything to a device. Left: the file; middle: the graph; right: key results;
   along the bottom: the loaded files. A second mode compares several tests (Compare.tsx). */
import { useRef, useState } from 'react';
import { usePrintReport } from '../components/usePrintReport';
import type { TestType } from '@tensile/core';
import { buildTestCsv, sig, skippedRowsText } from '@tensile/core';
import { PanelLayout } from '../components/PanelLayout';
import { RecentTable } from '../components/RecentTable';
import { RecordGraph } from '../components/RecordGraph';
import { ResultsTable } from '../components/ResultsTable';
import { SaveMenu } from '../components/SaveMenu';
import type { MenuItem } from '../components/SaveMenu';
import { save, svgText, svgToPng, xlsxForRecord } from '../exports';
import type { LoadedTest } from '../load';
import type { RecentRow } from './Home';
import { Compare } from './Compare';

const TEST_NAME = { uniaxial: 'Uniaxial tension', relaxation: 'Stress relaxation' } as const;
const maxOf = (a: readonly number[] | undefined) => { let m = -Infinity; for (const v of a ?? []) if (v > m) m = v; return Number.isFinite(m) ? m : null; };

export function ModeSwitch({ mode, setMode }: { mode: 'one' | 'compare'; setMode: (m: 'one' | 'compare') => void }) {
  return (
    <div className="seg" role="group" aria-label="Mode">
      <button type="button" aria-pressed={mode === 'one'} onClick={() => setMode('one')}>One test</button>
      <button type="button" aria-pressed={mode === 'compare'} onClick={() => setMode('compare')}>Compare tests</button>
    </div>
  );
}

export function LoadTest(p: {
  loaded: LoadedTest | null;
  error: string;
  theme: string;
  recent: RecentRow[];
  openFile: (name: string, text: string, hint?: TestType) => void;
  clear: () => void;
}) {
  const [hint, setHint] = useState<'' | TestType>('');
  const [mode, setMode] = useState<'one' | 'compare'>('one');
  const { ref: mainRef, printing, print } = usePrintReport<HTMLElement>();
  const svg = useRef<SVGSVGElement | null>(null), fileInput = useRef<HTMLInputElement | null>(null);
  const l = p.loaded, base = l ? l.name.replace(/\.(session\.json|json|csv)$/i, '') : 'test';
  const exportAs = async (what: 'original' | 'csv' | 'xlsx' | 'png' | 'svg') => {
    if (!l) return;
    if (what === 'original') save(l.name, [l.original], l.kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/json');
    else if (what === 'csv' && l.record && l.setup) save(base + '.csv', [buildTestCsv({ ...l.record, source: 'measured' }, {
      spec: { mat: l.setup.material, matLabel: l.setup.material, id: l.setup.specimenId, temp: l.setup.temperature, env: l.setup.environment, notes: l.setup.notes },
      kind: l.test === 'relaxation' ? { slug: 'stress-relaxation', name: 'Stress relaxation' } : { slug: 'uniaxial-tension', name: 'Uniaxial tension' },
      isRelax: l.test === 'relaxation', startedAt: null, endReason: 'Rebuilt from the session file ' + l.name, checks: {} })], 'text/csv;charset=utf-8');
    else if (what === 'xlsx' && l.record) { const b = xlsxForRecord(l.record, l.test, l.name, l.provenance); save(base + '.xlsx', [b as BlobPart], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }
    else if (what === 'svg' && svg.current) save(base + '.svg', [svgText(svg.current)], 'image/svg+xml');
    else if (what === 'png' && svg.current) save(base + '.png', [await svgToPng(svg.current)], 'image/png');
  };
  const items: MenuItem[] = l ? [
    ...(l.record && l.setup ? [{ id: 'csv', label: 'Test data (CSV)', onSelect: () => void exportAs('csv') }] : []),
    ...(l.record ? [{ id: 'xlsx', label: 'Excel (.xlsx)', onSelect: () => void exportAs('xlsx') }] : []),
    { id: 'png', label: 'Graph (PNG)', onSelect: () => void exportAs('png') },
    { id: 'svg', label: 'Graph (SVG)', onSelect: () => void exportAs('svg') },
    { id: 'original', label: 'Original file', onSelect: () => void exportAs('original') },
  ] : [];
  const head = (
    <div className="page-head">
      <h1>Load test</h1>
      <ModeSwitch mode={mode} setMode={setMode} />
    </div>
  );
  if (mode === 'compare') return <main className="page page-wide" id="main-content">{head}<Compare theme={p.theme} recent={p.recent} /></main>;

  const openBox = (
    <>
      <input ref={fileInput} type="file" hidden accept=".json,.csv,application/json,text/csv" onChange={(e) => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (f) { if (f.size > 64 * 1024 * 1024) { p.openFile(f.name, '', undefined); return; } void f.text().then((t) => p.openFile(f.name, t, hint || undefined)); }
      }} />
      <button type="button" className="primary screen-only" onClick={() => fileInput.current?.click()}>{l ? 'Open another file' : 'Open a file'}</button>
      <label className="field screen-only"><span className="field-label">Test type (CSV files)</span>
        <select value={hint} onChange={(e) => setHint(e.target.value as '' | TestType)}>
          <option value="">Read it from the file</option><option value="uniaxial">Uniaxial tension</option><option value="relaxation">Stress relaxation</option>
        </select>
      </label>
      <p className="hint screen-only">A session file saved by this app, or a CSV file. Files marked as simulated are not opened here.</p>
      {p.error ? <p className="error" role="alert">{p.error}</p> : null}
    </>
  );
  const details = l ? (
    <div className="quick-part">
      <h3>File details</h3>
      <dl className="facts wide">
        <div><dt>File</dt><dd>{l.name}</dd></div>
        <div><dt>Test</dt><dd>{TEST_NAME[l.test]}</dd></div>
        {l.setup ? <><div><dt>Material</dt><dd>{l.setup.material || '—'}</dd></div><div><dt>Specimen ID</dt><dd>{l.setup.specimenId || '—'}</dd></div>
          <div><dt>Dimensions</dt><dd>{l.setup.L0 || '—'} × {l.setup.width || '—'} × {l.setup.thickness || '—'} mm</dd></div></> : null}
        {l.session ? <><div><dt>Device</dt><dd>{l.session.identity.deviceType} · {l.session.identity.deviceId}</dd></div>
          <div><dt>Samples</dt><dd>{Object.values(l.session.columns).reduce((a, col) => a + col.raw.length, 0)}{l.session.missingSamples ? ' (' + l.session.missingSamples + ' missing in gaps)' : ''}</dd></div>
          <div><dt>Calibration</dt><dd>{l.session.calibrated ? Object.values(l.session.calibrations).map((x) => x?.id).join(', ') : 'none (voltages only)'}</dd></div></> : null}
      </dl>
    </div>) : null;

  const peak = l?.record ? maxOf(l.record.raw?.F) : null, dur = l?.record?.raw?.t?.length ? l.record.raw.t.at(-1) ?? null : null;
  const summary = l ? <>{l.setup?.specimenId || base} · {TEST_NAME[l.test]}</> : 'No file open';

  const center = !l ? (
    <section className="card-plain" aria-labelledby="recent2-title">
      <h2 id="recent2-title">Recent tests</h2>
      <RecentTable rows={p.recent} />
      <p className="hint">Choose a test to open it here, or open a file from the panel on the left.</p>
    </section>
  ) : (<>
    <div className="print-only print-head">
      <p><strong>Test report · Draft</strong> · printed {new Date().toLocaleString()}</p>
      <p>Data: loaded from a file. {l.kind === 'session' ? 'Rebuilt from the readings in the session file.' : 'Imported CSV file.'} The hardware connection is untested.</p>
    </div>
    <p className="notice">{l.provenance}</p>
    {skippedRowsText(l.record) ? <p className="notice" role="status">{skippedRowsText(l.record)} Check the file before relying on these results.</p> : null}
    <RecordGraph record={l.record} test={l.test} theme={printing ? 'light' : p.theme} showResults sourceTag={'Loaded: ' + l.name} emptyText={l.problem || 'No data.'} onSvg={(el) => { svg.current = el; }}>
      <div className="actions">
        <SaveMenu items={items} />
        <button type="button" className="outline" onClick={print}>Print report</button>
        <p className="actions-note">Opened on this computer. Nothing is uploaded.</p>
      </div>
    </RecordGraph>
  </>);

  const right = (<>
    <section className="side-card" aria-labelledby="lt-kr">
      <h2 id="lt-kr">Key results</h2>
      {l ? <ResultsTable record={l.record} problem={l.problem} note={l.session?.endReason ?? ''} /> : <p className="hint">Open a test to see its key results.</p>}
    </section>
    {l?.record ? (
      <section className="side-card" aria-labelledby="lt-facts">
        <h2 id="lt-facts">From the file</h2>
        <dl className="facts">
          <div><dt>Points</dt><dd>{l.record.x.length}</dd></div>
          <div><dt>Peak force</dt><dd>{peak === null ? '—' : sig(peak, 4) + ' N'}</dd></div>
          <div><dt>Duration</dt><dd>{dur === null ? '—' : sig(dur, 4) + ' s'}</dd></div>
        </dl>
      </section>) : null}
  </>);

  const bottom = (
    <section className="specimens" aria-labelledby="lt-loaded">
      <div className="specimens-head">
        <h2 id="lt-loaded">Loaded files</h2>
        <p className="hint">In Compare tests, each file you add is listed here.</p>
      </div>
      {l ? (
        <div className="spec-scroll"><table className="spec-table">
          <thead><tr><th scope="col">File</th><th scope="col">Specimen</th><th scope="col">Material</th><th scope="col">Test</th><th scope="col" className="num">Points</th><th scope="col">Data</th></tr></thead>
          <tbody><tr className="spec-on" aria-current="true">
            <th scope="row">{l.name}</th><td>{l.setup?.specimenId || '—'}</td><td>{l.setup?.material || '—'}</td><td>{TEST_NAME[l.test]}</td>
            <td className="num">{l.record?.x.length ?? '—'}</td><td>{l.kind === 'session' ? 'Session file' : 'Imported CSV'}</td></tr></tbody>
        </table></div>) : <p className="hint">No file open.</p>}
      {l ? <p className="row"><button type="button" className="link" onClick={p.clear}>Close this file</button></p> : null}
    </section>
  );

  return (
    <main className="page page-wide" id="main-content" ref={mainRef}>
      {head}
      <PanelLayout id="file-panel" title="File" buttonLabel="File" printPanel summary={summary} panel={<>{openBox}{details}</>} center={center} right={right} bottom={bottom} />
    </main>
  );
}
