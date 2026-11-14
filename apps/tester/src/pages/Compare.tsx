/* Compare tests: up to 12 recorded tests of one test type, from files or recent tests. An overlay graph (each test
   keeps its colour and line style), the key results per test with the mean and sample standard deviation, warnings,
   and a summary CSV. Opening and comparing never send anything to a device; nothing is saved by the app. */
import { useMemo, useRef, useState } from 'react';
import { sig } from '@tensile/core';
import { DARK_GRAPH, Graph, LIGHT_GRAPH, MAX_SERIES, seriesStyle } from '@tensile/ui';
import { viewData } from '../components/RecordGraph';
import { PanelLayout } from '../components/PanelLayout';
import { SaveMenu } from '../components/SaveMenu';
import { usePrintReport } from '../components/usePrintReport';
import { compareCsv, compareItemFromLoaded, compareSummary, MAX_COMPARE } from '../compare';
import { save, svgText, svgToPng } from '../exports';
import { openTestFile } from '../load';
import type { LoadedTest } from '../load';
import type { RecentRow } from './Home';

interface Entry { key: string; slot: number; loaded: LoadedTest }
const LIMIT = Math.min(MAX_COMPARE, MAX_SERIES);
const TEST_NAME = { uniaxial: 'Uniaxial tension', relaxation: 'Stress relaxation' } as const;

export function Compare({ theme, recent }: { theme: string; recent: RecentRow[] }) {
  const [entries, setEntriesState] = useState<Entry[]>([]);
  /* The current list, also for checks made between awaits while several files are added at once. */
  const listRef = useRef<Entry[]>([]);
  const setEntries = (next: Entry[]) => { listRef.current = next; setEntriesState(next); };
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [copied, setCopied] = useState('');
  const svg = useRef<SVGSVGElement | null>(null), fileInput = useRef<HTMLInputElement | null>(null);
  const report = usePrintReport<HTMLDivElement>();

  const add = async (key: string, name: string, text: string) => {
    if (listRef.current.some((e) => e.key === key)) return;
    if (listRef.current.length >= LIMIT) throw new Error('At most ' + LIMIT + ' tests can be compared at once.');
    const l = await openTestFile(name, text);
    const cur = listRef.current;
    if (cur.length >= LIMIT) throw new Error('At most ' + LIMIT + ' tests can be compared at once.');
    if (cur.length && cur[0]!.loaded.test !== l.test) throw new Error('it is a ' + TEST_NAME[l.test].toLowerCase() + ' test; this comparison is ' + TEST_NAME[cur[0]!.loaded.test].toLowerCase() + '. Compare one test type at a time.');
    /* A test keeps its colour and line style: the first free slot, never renumbered when another is removed. */
    const used = new Set(cur.map((e) => e.slot));
    let slot = 0; while (used.has(slot)) slot++;
    setEntries([...cur, { key, slot, loaded: l }]);
  };
  const run = async (f: () => Promise<void>) => {
    setBusy(true); setError(''); setCopied('');
    try { await f(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const addFiles = (files: FileList | null) => run(async () => {
    const problems: string[] = [];
    for (const f of Array.from(files ?? [])) {
      if (f.size > 64 * 1024 * 1024) { problems.push(f.name + ': larger than 64 MB.'); continue; }
      try { await add('file:' + f.name + ':' + f.size + ':' + f.lastModified, f.name, await f.text()); } catch (e) { problems.push(f.name + ': ' + (e instanceof Error ? e.message : String(e))); }
    }
    if (problems.length) throw new Error(problems.join(' '));
  });
  const addRecent = (r: RecentRow) => run(async () => {
    if (!r.fetch) throw new Error('This test cannot be fetched.');
    const f = await r.fetch();
    try { await add('recent:' + r.key, f.name, f.text); } catch (e) { throw new Error(r.specimen + ': ' + (e instanceof Error ? e.message : String(e))); }
  });

  const summary = useMemo(() => {
    if (!entries.length) return null;
    try { return compareSummary(entries.map((e) => compareItemFromLoaded(e.loaded))); } catch { return null; }
  }, [entries]);
  const test = entries[0]?.loaded.test ?? 'uniaxial';
  const { x: _x, y: _y, ...axes } = viewData(null, 'stress', test === 'relaxation');
  const dark = theme === 'dark' && !report.printing;
  const label = (e: Entry) => (e.loaded.setup?.specimenId || e.loaded.name.replace(/\.(session\.json|json|csv)$/i, ''));
  const series = entries.map((e) => ({ x: e.loaded.record?.x ?? [], y: e.loaded.record?.y ?? [], label: label(e), ...seriesStyle(e.slot, dark) }));
  const base = 'comparison-' + test + '-' + entries.length + '-tests';
  const csv = summary ? compareCsv(summary) : '';

  const panel = (
    <>
      <input ref={fileInput} type="file" multiple hidden accept=".json,.csv,application/json,text/csv" onChange={(e) => { const fl = e.target.files; void addFiles(fl).then(() => { e.target.value = ''; }); }} />
      <button type="button" className="primary" disabled={busy || entries.length >= LIMIT} onClick={() => fileInput.current?.click()}>Add files</button>
      <p className="hint">Up to {LIMIT} tests of one test type. Files marked as simulated are not opened.</p>
      {recent.some((r) => r.fetch) ? (
        <details className="panel"><summary>Add recent tests</summary>
          <div className="panel-body"><ul className="plain-list">
            {recent.filter((r) => r.fetch).map((r) => (
              <li key={r.key} className="row"><button type="button" disabled={busy || entries.length >= LIMIT || entries.some((e) => e.key === 'recent:' + r.key)} aria-label={'Add ' + r.specimen + ', ' + r.saved} onClick={() => void addRecent(r)}>Add</button>
                <span>{r.saved} · {r.specimen} · {r.test} · {r.stored}</span></li>))}
          </ul></div>
        </details>) : null}
      {busy ? <p className="hint" role="status">Opening…</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
    </>
  );
  const items = [
    { id: 'csv', label: 'Summary (CSV)', onSelect: () => { if (summary) save(base + '-summary.csv', [csv], 'text/csv;charset=utf-8'); } },
    { id: 'copy', label: 'Copy summary', onSelect: () => { if (summary) void navigator.clipboard?.writeText(csv).then(() => setCopied('Summary copied.'), () => setCopied('Copying is not allowed here.')); } },
    { id: 'png', label: 'Graph (PNG)', onSelect: () => { if (svg.current) void svgToPng(svg.current).then((b) => save(base + '.png', [b], 'image/png')); } },
    { id: 'svg', label: 'Graph (SVG)', onSelect: () => { if (svg.current) save(base + '.svg', [svgText(svg.current)], 'image/svg+xml'); } },
  ];
  const center = (<>
    <div className="print-only print-head">
      <p><strong>Comparison report · Draft</strong> · printed {new Date().toLocaleString()}</p>
      <p>Data: {entries.length} recorded test{entries.length === 1 ? '' : 's'} opened in the tester app. The origin of CSV imports cannot be verified. The hardware connection is untested.</p>
    </div>
    <section className="graph-card" aria-label="Comparison graph">
      <Graph x={[]} y={[]} {...axes} palette={report.printing || theme !== 'dark' ? LIGHT_GRAPH : DARK_GRAPH} series={series}
        sourceTag={entries.length ? TEST_NAME[test] + ' · ' + entries.length + ' test' + (entries.length === 1 ? '' : 's') + ' opened in the app' : 'Compare tests'} emptyText="No tests added yet." onSvg={(el) => { svg.current = el; }} />
      <div className="actions">
        <SaveMenu items={items} label="Save summary" />
        <button type="button" className="outline" disabled={!entries.length} onClick={report.print}>Print report</button>
        <button type="button" className="quiet" disabled={!entries.length} onClick={() => { setEntries([]); setError(''); setCopied(''); }}>Clear all</button>
        {copied ? <span className="hint" role="status">{copied}</span> : null}
      </div>
    </section>
  </>);
  const right = (<>
    {summary?.warnings.length ? (
      <section className="side-card" aria-labelledby="cmp-warn"><h2 id="cmp-warn">Check before relying on this</h2>
        <ul className="compare-warnings" aria-label="Warnings">{summary.warnings.map((w) => <li key={w}>{w}</li>)}</ul></section>) : null}
    <section className="side-card" aria-labelledby="cmp-mean">
      <h2 id="cmp-mean">Mean and SD</h2>
      {summary ? (
        <dl className="facts stack">
          {summary.metrics.map((m) => {
            const st = summary.stats[m.id]!;
            return <div key={m.id}><dt>{m.label}</dt><dd className="num">{st.mean === null ? '—' : sig(st.mean, 4)}{st.sd === null ? '' : ' ± ' + sig(st.sd, 3)}{st.mean === null ? '' : ' ' + m.unit}</dd></div>;
          })}
        </dl>) : <p className="hint">Add tests to see the mean and the sample standard deviation.</p>}
    </section>
  </>);
  const bottom = (
    <section className="specimens" aria-labelledby="cmp-loaded">
      <div className="specimens-head"><h2 id="cmp-loaded">Loaded files</h2>
        <p className="hint">A dash means the value could not be found in that test; it is left out of the mean and standard deviation. Strain is crosshead-based unless a file says otherwise.</p></div>
      {summary ? (
        <div className="tablebox">
          <table className="list-table compare-table">
            <caption className="sr">Key results per test, with the mean and sample standard deviation</caption>
            <thead><tr><th scope="col">Test</th>{summary.metrics.map((m) => <th scope="col" key={m.id}>{m.label} ({m.unit})</th>)}<th scope="col"><span className="sr">Remove</span></th></tr></thead>
            <tbody>
              {entries.map((e, i) => {
                const r = summary.rows[i]!, st = seriesStyle(e.slot, dark);
                return (
                  <tr key={e.key}>
                    <th scope="row"><span className="compare-key" aria-hidden="true"><svg width="28" height="10"><line x1="2" x2="26" y1="5" y2="5" stroke={st.color} strokeWidth="2.5" strokeLinecap="round" {...(st.dash ? { strokeDasharray: st.dash } : {})} /></svg></span>
                      {label(e)}{r.material ? <span className="hint"> · {r.material}</span> : null}{r.note ? <span className="hint" style={{ display: 'block' }}>{r.note}</span> : null}</th>
                    {summary.metrics.map((m) => <td key={m.id} className="num">{r.values[m.id] === null ? '—' : sig(r.values[m.id], 4)}</td>)}
                    <td><button type="button" className="quiet" aria-label={'Remove ' + label(e)} onClick={() => setEntries(listRef.current.filter((x) => x.key !== e.key))}>Remove</button></td>
                  </tr>);
              })}
              <tr className="compare-stat"><th scope="row">Mean</th>{summary.metrics.map((m) => <td key={m.id} className="num">{summary.stats[m.id]!.mean === null ? '—' : sig(summary.stats[m.id]!.mean, 4)}</td>)}<td /></tr>
              <tr className="compare-stat"><th scope="row">SD (sample, n − 1)</th>{summary.metrics.map((m) => <td key={m.id} className="num">{summary.stats[m.id]!.sd === null ? '—' : sig(summary.stats[m.id]!.sd, 4)}</td>)}<td /></tr>
            </tbody>
          </table>
        </div>) : <p className="hint">No tests added yet.</p>}
    </section>
  );
  return (
    <div ref={report.ref}>
      <PanelLayout id="compare-panel" title="Add tests" buttonLabel="Add tests" summary={entries.length ? entries.length + ' test' + (entries.length === 1 ? '' : 's') + ' · ' + TEST_NAME[test] : 'No tests added'} panel={panel} center={center} right={right} bottom={bottom} />
    </div>
  );
}
