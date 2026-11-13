/* The graph with its view buttons, used for a live test and for an opened one. Views appear only when their data exists. */
import { useMemo, useState } from 'react';
import { keyPoints, regionsFor } from '@tensile/core';
import type { TestRecord, TestType } from '@tensile/core';
import { DARK_GRAPH, Graph, LIGHT_GRAPH } from '@tensile/ui';
import { resultsFor } from '../results';

type ViewId = 'stress' | 'force-disp' | 'force-time' | 'disp-time';

export function viewData(rec: TestRecord | null, view: ViewId, isRelax: boolean) {
  const raw = rec?.raw;
  if (view === 'force-disp') return { x: raw?.d ?? [], y: raw?.F ?? [], xLabel: 'Crosshead displacement (mm)', yLabel: 'Force (N)', xName: 'd', yName: 'F', xUnit: 'mm', yUnit: 'N' };
  if (view === 'force-time') return { x: raw?.t ?? [], y: raw?.F ?? [], xLabel: 'Time (s)', yLabel: 'Force (N)', xName: 't', yName: 'F', xUnit: 's', yUnit: 'N' };
  if (view === 'disp-time') return { x: raw?.t ?? [], y: raw?.d ?? [], xLabel: 'Time (s)', yLabel: 'Crosshead displacement (mm)', xName: 't', yName: 'd', xUnit: 's', yUnit: 'mm' };
  return isRelax
    ? { x: rec?.x ?? [], y: rec?.y ?? [], xLabel: 'Time, t (s)', yLabel: 'Stress, σ (MPa)', xName: 't', yName: 'σ', xUnit: 's', yUnit: 'MPa' }
    : { x: rec?.x ?? [], y: rec?.y ?? [], xLabel: 'Crosshead-based engineering strain, Δx/L₀ (mm/mm)', yLabel: 'Engineering stress, F/A₀ (MPa)', xName: 'ε', yName: 'σ', xUnit: 'mm/mm', yUnit: 'MPa' };
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
    ['stress', isRelax ? 'Relaxation (stress-time)' : 'Stress-strain', true],
    ['force-disp', 'Force-displacement', !!raw?.d && !isRelax],
    ['force-time', 'Force-time', !!raw?.t],
    ['disp-time', 'Displacement-time', !!raw?.t && !!raw?.d],
  ] as const).filter((v) => v[2] || !p.record);
  const [view, setView] = useState<ViewId>('stress');
  const current = views.some((v) => v[0] === view) ? view : 'stress';
  const results = useMemo(() => (p.showResults ? resultsFor(p.record) : { rows: [], markers: [], fitLine: null }), [p.record, p.showResults]);
  /* Display-only guides after a test: region guides on the stress view, and a tangent line on stress-strain. */
  const [showRegions, setShowRegions] = useState(false), [showTangent, setShowTangent] = useState(false);
  const canGuide = !!p.showResults && !p.live && !!p.record && p.record.x.length >= 10 && current === 'stress';
  const regions = useMemo(() => {
    if (!canGuide || !showRegions || !p.record) return [];
    try { return regionsFor(p.record, keyPoints(p.record, isRelax), isRelax).map(([name, from, to, approx]) => ({ name, from, to, ...(approx ? { approx } : {}) })); } catch { return []; }
  }, [canGuide, showRegions, p.record, isRelax]);
  const tangent = canGuide && !isRelax && showTangent ? { slopeName: 'dσ/dε', slopeUnit: 'MPa' } : null;
  return (
    <section className="graph-card" aria-label="Graph">
      <div className="views" role="group" aria-label="Graph view">
        {views.map(([id, name]) => (
          <button key={id} type="button" className={current === id ? 'view-on' : ''} aria-pressed={current === id} onClick={() => setView(id)}>{name}</button>
        ))}
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
