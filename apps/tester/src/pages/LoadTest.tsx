/* Load test: open a recorded test (a session file saved by this app, or a CSV file), see its graph and key results,
   and export it. Opening never sends anything to a device. Also the place for recent tests and exports. */
import { useRef, useState } from 'react';
import { usePrintReport } from '../components/usePrintReport';
import type { TestType } from '@tensile/core';
import { buildTestCsv, sig } from '@tensile/core';
import { Panel } from '@tensile/ui';
import { RecordGraph } from '../components/RecordGraph';
import { ResultsTable } from '../components/ResultsTable';
import { save, svgText, svgToPng, xlsxForRecord } from '../exports';
import type { LoadedTest } from '../load';
import type { RecentRow } from './Home';

export function LoadTest(p: {
  loaded: LoadedTest | null;
  error: string;
  theme: string;
  recent: RecentRow[];
  openFile: (name: string, text: string, hint?: TestType) => void;
  clear: () => void;
}) {
  const [hint, setHint] = useState<'' | TestType>('');
  const { ref: mainRef, printing, print } = usePrintReport<HTMLElement>();
  const svg = useRef<SVGSVGElement | null>(null);
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
  return (
    <main className="page" id="main-content" ref={mainRef}>
      <div className="row"><h1>Load test</h1>{l ? <button type="button" onClick={p.clear}>Open another</button> : null}</div>
      {!l ? (<>
        <section className="card-plain" aria-labelledby="open-title">
          <h2 id="open-title">Open a file</h2>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <label className="field"><span className="field-label">File</span>
              <input type="file" accept=".json,.csv,application/json,text/csv" onChange={(e) => {
                const f = e.target.files?.[0]; e.target.value = '';
                if (f) { if (f.size > 64 * 1024 * 1024) { p.openFile(f.name, '', undefined); return; } void f.text().then((t) => p.openFile(f.name, t, hint || undefined)); }
              }} />
            </label>
            <label className="field"><span className="field-label">Test type (CSV files)</span>
              <select value={hint} onChange={(e) => setHint(e.target.value as '' | TestType)}>
                <option value="">Read it from the file</option><option value="uniaxial">Uniaxial tension</option><option value="relaxation">Stress relaxation</option>
              </select>
            </label>
          </div>
          <p className="hint">A session file (.session.json) saved by this app, or a CSV file with force and displacement (or stress and strain). Files marked as simulated are not opened here.</p>
          {p.error ? <p className="error" role="alert">{p.error}</p> : null}
        </section>
        <section aria-labelledby="recent2-title">
          <h2 id="recent2-title">Recent tests</h2>
          {p.recent.length ? (
            <div className="tablebox"><table className="list-table">
              <thead><tr><th scope="col">Saved</th><th scope="col">Specimen</th><th scope="col">Test</th><th scope="col">Samples</th><th scope="col">Stored</th><th scope="col"><span className="sr">Open</span></th></tr></thead>
              <tbody>{p.recent.map((r) => <tr key={r.key}><td>{r.saved}</td><td>{r.specimen}</td><td>{r.test}</td><td>{r.samples}</td><td>{r.stored}</td><td><button type="button" className="link" onClick={r.open}>Open</button></td></tr>)}</tbody>
            </table></div>) : <p className="hint">No recorded tests on this computer yet.</p>}
        </section>
      </>) : (<>
        <div className="print-only print-head">
          <p><strong>Test report · Draft</strong> · printed {new Date().toLocaleString()}</p>
          <p>Data: loaded from a file. {l.kind === 'session' ? 'Rebuilt from the readings in the session file.' : 'Imported CSV file.'} The hardware connection is untested.</p>
        </div>
        <p className="notice">{l.provenance}</p>
        <div className="toolbar" role="toolbar" aria-label="Export">
          {l.record && l.setup ? <button type="button" onClick={() => void exportAs('csv')}>Test data (CSV)</button> : null}
          {l.record ? <button type="button" onClick={() => void exportAs('xlsx')}>Excel (.xlsx)</button> : null}
          <button type="button" onClick={() => void exportAs('png')}>Graph (PNG)</button>
          <button type="button" onClick={() => void exportAs('svg')}>Graph (SVG)</button>
          <button type="button" onClick={() => void exportAs('original')}>Original file</button>
          <button type="button" onClick={print}>Print report</button>
        </div>
        <RecordGraph record={l.record} test={l.test} theme={printing ? 'light' : p.theme} showResults sourceTag={'Loaded: ' + l.name} emptyText={l.problem || 'No data.'} onSvg={(el) => { svg.current = el; }} />
        <Panel title="Key results" open><ResultsTable record={l.record} problem={l.problem} note={l.session?.endReason ?? ''} /></Panel>
        <Panel title="File details">
          <dl className="facts wide">
            <div><dt>File</dt><dd>{l.name}</dd></div>
            <div><dt>Test</dt><dd>{l.test === 'relaxation' ? 'Stress relaxation' : 'Uniaxial tension'}</dd></div>
            {l.setup ? <><div><dt>Material</dt><dd>{l.setup.material || '—'}</dd></div><div><dt>Specimen ID</dt><dd>{l.setup.specimenId || '—'}</dd></div>
              <div><dt>Dimensions</dt><dd>{l.setup.L0 || '—'} × {l.setup.width || '—'} × {l.setup.thickness || '—'} mm</dd></div></> : null}
            {l.session ? <><div><dt>Device</dt><dd>{l.session.identity.deviceType} · {l.session.identity.deviceId}</dd></div>
              <div><dt>Samples</dt><dd>{Object.values(l.session.columns).reduce((a, col) => a + col.raw.length, 0)}{l.session.missingSamples ? ' (' + l.session.missingSamples + ' missing in gaps)' : ''}</dd></div>
              <div><dt>Calibration</dt><dd>{l.session.calibrated ? Object.values(l.session.calibrations).map((x) => x?.id).join(', ') : 'none (voltages only)'}</dd></div></> : null}
            {l.record ? <div><dt>Points</dt><dd>{l.record.x.length}{l.record.raw?.t?.length ? ', ' + sig(l.record.raw.t.at(-1) ?? 0, 4) + ' s' : ''}</dd></div> : null}
          </dl>
        </Panel>
      </>)}
    </main>
  );
}
