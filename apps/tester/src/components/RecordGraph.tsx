/* The graph with its view buttons, used for a live test and for an opened one. Views appear only when their data exists. */
import { useMemo, useState } from 'react';
import { keyPoints, regionsFor } from '@tensile/core';
import type { TestRecord, TestType } from '@tensile/core';
import { DARK_GRAPH, Graph, LIGHT_GRAPH } from '@tensile/ui';
import { NO_RESULTS, resultsFor } from '../results';

type ViewId = 'stress' | 'force-disp' | 'force-time' | 'disp-time';

export function viewData(rec: TestRecord | null, view: ViewId, isRelax: boolean) {
  /* Plain axis titles: no symbols or equations on screen. Strain is crosshead-based; the key results say so. */
  const raw = rec?.raw;
  if (view === 'force-disp') return { x: raw?.d ?? [], y: raw?.F ?? [], xLabel: 'Displacement (mm)', yLabel: 'Force (N)', xName: 'Displacement', yName: 'Force', xUnit: 'mm', yUnit: 'N' };
  if (view === 'force-time') return { x: raw?.t ?? [], y: raw?.F ?? [], xLabel: 'Time (s)', yLabel: 'Force (N)', xName: 'Time', yName: 'Force', xUnit: 's', yUnit: 'N' };
  if (view === 'disp-time') return { x: raw?.t ?? [], y: raw?.d ?? [], xLabel: 'Time (s)', yLabel: 'Displacement (mm)', xName: 'Time', yName: 'Displacement', xUnit: 's', yUnit: 'mm' };
  return isRelax
    ? { x: rec?.x ?? [], y: rec?.y ?? [], xLabel: 'Time (s)', yLabel: 'Stress (MPa)', xName: 'Time', yName: 'Stress', xUnit: 's', yUnit: 'MPa' }
    : { x: rec?.x ?? [], y: rec?.y ?? [], xLabel: 'Strain (mm/mm)', yLabel: 'Stress (MPa)', xName: 'Strain', yName: 'Stress', xUnit: 'mm/mm', yUnit: 'MPa' };
}

export interface RecordGraphProps {
  record: TestRecord | null;
  test: TestType;
  theme: string;
  live?: boolean;
  showResults?: boolean;
  sourceTag: string;
  emptyText: string;
  onSvg?: (el: SVGSVGElement | null) => void;
}

export function RecordGraph(p: RecordGraphProps) {
  const isRelax = p.test === 'relaxation';
  const raw = p.record?.raw;
  const views = ([
    ['stress', isRelax ? 'Stress–time' : 'Stress–strain', true],
    ['force-disp', 'Force–displacement', !!raw?.d && !isRelax],
    ['force-time', 'Force–time', !!raw?.t],
    ['disp-time', 'Displacement–time', !!raw?.t && !!raw?.d],
  ] as const).filter((v) => v[2] || !p.record);
  const [view, setView] = useState<ViewId>('stress');
  const current = views.some((v) => v[0] === view) ? view : 'stress';
  const results = useMemo(() => (p.showResults ? resultsFor(p.record) : NO_RESULTS), [p.record, p.showResults]);
  /* Display-only guides after a test: region guides on the stress view, and a tangent line on stress-strain. */
  const [showRegions, setShowRegions] = useState(false), [showTangent, setShowTangent] = useState(false);
  const canGuide = !!p.showResults && !p.live && !!p.record && p.record.x.length >= 10 && current === 'stress';
  const regions = useMemo(() => {
    if (!canGuide || !showRegions || !p.record) return [];
    try { return regionsFor(p.record, keyPoints(p.record, isRelax), isRelax).map(([name, from, to, approx]) => ({ name, from, to, ...(approx ? { approx } : {}) })); } catch { return []; }
  }, [canGuide, showRegions, p.record, isRelax]);
  const tangent = canGuide && !isRelax && showTangent ? { slopeName: '', slopeUnit: 'MPa' } : null;
  return (
    <section className="graph-card" aria-label="Graph">
      <div className="graph-head">
        <div className="views" role="group" aria-label="Graph view">
          {views.map(([id, name]) => (
            <button key={id} type="button" className={current === id ? 'view-on' : ''} aria-pressed={current === id} onClick={() => setView(id)}>{name}</button>
          ))}
        </div>
        {/* On a phone the same choice is a dropdown (only one of the two is shown). */}
        <label className="view-select"><span className="field-label">Graph</span>
          <select value={current} onChange={(e) => setView(e.target.value as ViewId)}>{views.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
        </label>
        {p.sourceTag ? <span className="data-tag">{p.sourceTag}</span> : null}
      </div>
      <Graph {...viewData(p.record, current, isRelax)} palette={p.theme === 'dark' ? DARK_GRAPH : LIGHT_GRAPH} live={!!p.live} sourceTag={p.sourceTag}
        markers={current === 'stress' ? results.markers : []} fitLine={current === 'stress' ? results.fitLine : null} emptyText={p.emptyText}
        regions={regions} tangent={tangent}
        {...(p.onSvg ? { onSvg: p.onSvg } : {})} />
      {canGuide ? (
        <p className="row graph-guides">
          <label className="check"><input type="checkbox" checked={showRegions} onChange={(e) => setShowRegions(e.target.checked)} /> Show regions</label>
          {!isRelax ? <label className="check"><input type="checkbox" checked={showTangent} onChange={(e) => setShowTangent(e.target.checked)} /> Tangent line at cursor</label> : null}
          <span className="hint">Guides only: they change the picture, never the results. Region boundaries are estimates.</span>
        </p>) : null}
    </section>
  );
}
