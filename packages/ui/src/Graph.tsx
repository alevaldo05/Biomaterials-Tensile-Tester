/* The graph: a hand-drawn SVG (no chart library), like the website's. It only draws what it is given.
   Zoom, pan, autoscale, and thinning change the picture, never the data or the calculated results. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sig } from '@tensile/core';
import { autoscaleY, fullView, nearestIndex, pan, snapTo, thin, ticksFor, toData, toPx, zoomAt } from './graph-math';
import type { Box, Marker, Pt, View } from './graph-math';

export interface GraphPalette { background: string; ink: string; muted: string; grid: string; curve: string; accent: string; mark: string }
export const LIGHT_GRAPH: GraphPalette = { background: '#ffffff', ink: '#111111', muted: '#555555', grid: '#e3e3e3', curve: '#000000', accent: '#3f6b52', mark: '#b45309' };
export const DARK_GRAPH: GraphPalette = { background: '#161d1a', ink: '#e8efe9', muted: '#b0bfb5', grid: '#2e3a34', curve: '#f2f6f3', accent: '#7fb08f', mark: '#f0a24b' };

/* Overlaid curves (comparing tests). Four hues that stay apart for crossing lines in both themes and for the common
   kinds of colour blindness (checked with a palette validator, all pairs), times three line styles: up to 12 curves.
   Each curve keeps its slot when others are removed, and a legend inside the picture names every curve. */
export const SERIES_LIGHT = ['#2a78d6', '#eda100', '#e87ba4', '#008300'] as const;
export const SERIES_DARK = ['#3987e5', '#c98500', '#d55181', '#008300'] as const;
export const SERIES_DASH = ['', '8 4', '2 3'] as const;
export const MAX_SERIES = SERIES_LIGHT.length * SERIES_DASH.length;
export function seriesStyle(slot: number, dark: boolean): { color: string; dash: string } {
  const s = ((slot % MAX_SERIES) + MAX_SERIES) % MAX_SERIES;
  return { color: (dark ? SERIES_DARK : SERIES_LIGHT)[s % 4] as string, dash: SERIES_DASH[Math.floor(s / 4)] as string };
}
export interface Series { x: readonly number[]; y: readonly number[]; label: string; color: string; dash?: string }

export interface GraphProps {
  x: readonly number[];
  y: readonly number[];
  xLabel: string;
  yLabel: string;
  /** Short names for the readout line, for example "ε" and "σ". */
  xName: string;
  yName: string;
  xUnit: string;
  yUnit: string;
  palette: GraphPalette;
  /** Key results to mark on the curve. */
  markers?: readonly Marker[];
  /** The fitted modulus line, in data units. */
  fitLine?: { from: Pt; to: Pt } | null;
  /** Written inside the picture so a saved image always says where the data came from. */
  sourceTag: string;
  /** While true the view follows the growing data and zoom is off. */
  live?: boolean;
  emptyText?: string;
  /** Receives the SVG element, for saving the picture. */
  onSvg?: (svg: SVGSVGElement | null) => void;
  /** Several curves instead of x and y (comparing tests). Markers and the fit line are not drawn then. */
  series?: readonly Series[];
}

const W = 720, H = 420;
const BOX: Box = { left: 64, top: 18, width: W - 64 - 18, height: H - 18 - 52 };

export function Graph(p: GraphProps) {
  const [zoom, setZoom] = useState<View | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: Pt; to: Pt; mode: 'box' | 'pan'; start: View } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const many = !!p.series && p.series.length > 0;
  /* All points, for the view and autoscale; with series the readout looks along every curve. */
  const allX = useMemo(() => (many ? (p.series as readonly Series[]).flatMap((s) => s.x.slice(0, Math.min(s.x.length, s.y.length))) : p.x), [many, p.series, p.x]);
  const allY = useMemo(() => (many ? (p.series as readonly Series[]).flatMap((s) => s.y.slice(0, Math.min(s.x.length, s.y.length))) : p.y), [many, p.series, p.y]);
  const n = Math.min(allX.length, allY.length);
  const full = useMemo(() => fullView(allX, allY), [allX, allY, n]);
  const view = p.live || !zoom ? full : zoom;
  useEffect(() => { if (p.live) { setZoom(null); setPicked(null); } }, [p.live]);
  useEffect(() => { setZoom(null); setPicked(null); }, [p.xLabel, p.yLabel]);

  const setSvg = useCallback((el: SVGSVGElement | null) => { svgRef.current = el; p.onSvg?.(el); }, [p.onSvg]);
  const at = (e: { clientX: number; clientY: number }): Pt => {
    const r = (svgRef.current as SVGSVGElement).getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const inside = (c: Pt) => c.x >= BOX.left && c.x <= BOX.left + BOX.width && c.y >= BOX.top && c.y <= BOX.top + BOX.height;

  /* The wheel must be able to stop the page from scrolling, which React's own wheel handler cannot do. */
  useEffect(() => {
    const el = svgRef.current;
    if (!el || p.live || n < 2) return;
    const onWheel = (e: WheelEvent) => {
      const c = at(e);
      if (!inside(c)) return;
      e.preventDefault();
      setZoom((z) => zoomAt(z ?? full, (c.x - BOX.left) / BOX.width, 1 - (c.y - BOX.top) / BOX.height, e.deltaY > 0 ? 1.25 : 0.8));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [p.live, n, full]);

  const pathOf = (x: readonly number[], y: readonly number[]) => {
    if (Math.min(x.length, y.length) < 2) return '';
    const idx = thin(x, y, view), parts: string[] = [];
    for (const i of idx) {
      const q = toPx({ x: x[i] as number, y: y[i] as number }, view, BOX);
      if (Number.isFinite(q.x) && Number.isFinite(q.y)) parts.push((parts.length ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.y.toFixed(1));
    }
    return parts.join('');
  };
  const path = useMemo(() => (many ? '' : pathOf(p.x, p.y)), [many, p.x, p.y, n, view]);
  const paths = useMemo(() => (many ? (p.series as readonly Series[]).map((s) => pathOf(s.x, s.y)) : []), [many, p.series, view]);

  const xt = ticksFor(view.x0, view.x1, 6), yt = ticksFor(view.y0, view.y1, 5);
  const markers = many ? [] : p.markers ?? [];
  const snapped = cursor && !p.live ? snapTo(markers, cursor, view, BOX) : null;
  /* With several curves, the readout shows the nearest point on any curve and names the curve. */
  const nearestSeries = (): (Pt & { name: string }) | null => {
    if (!cursor || !inside(cursor)) return null;
    let best: (Pt & { name: string }) | null = null, bestD = Infinity;
    for (const s of p.series as readonly Series[]) {
      const i = nearestIndex(s.x, s.y, cursor, view, BOX);
      if (i < 0) continue;
      const q = toPx({ x: s.x[i] as number, y: s.y[i] as number }, view, BOX), d = (q.x - cursor.x) ** 2 + (q.y - cursor.y) ** 2;
      if (d < bestD) { bestD = d; best = { x: s.x[i] as number, y: s.y[i] as number, name: s.label }; }
    }
    return best;
  };
  const hoverIndex = !many && cursor && inside(cursor) && n > 0 ? nearestIndex(p.x, p.y, cursor, view, BOX) : -1;
  const shownIndex = hoverIndex >= 0 ? hoverIndex : picked ?? -1;
  const shown: (Pt & { name?: string }) | null = many ? nearestSeries()
    : snapped ? { x: snapped.x, y: snapped.y, name: snapped.label }
    : shownIndex >= 0 && shownIndex < n ? { x: p.x[shownIndex] as number, y: p.y[shownIndex] as number } : null;
  const shownPx = shown ? toPx(shown, view, BOX) : null;
  const pal = p.palette;

  const onKey = (e: React.KeyboardEvent) => {
    if (p.live || n < 2) return;
    if (many && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End')) return;   /* point stepping is for one curve */
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setCursor(null); setPicked((i) => Math.max(0, Math.min(n - 1, (i ?? 0) + (e.key === 'ArrowRight' ? step : -step)))); }
    else if (e.key === 'Home') { e.preventDefault(); setCursor(null); setPicked(0); }
    else if (e.key === 'End') { e.preventDefault(); setCursor(null); setPicked(n - 1); }
    else if (e.key === '+' || e.key === '=') setZoom((z) => zoomAt(z ?? full, 0.5, 0.5, 0.8));
    else if (e.key === '-') setZoom((z) => zoomAt(z ?? full, 0.5, 0.5, 1.25));
    else if (e.key === '0') setZoom(null);
  };

  return (
    <div className={'graph' + (expanded ? ' graph-expanded' : '')}>
      <div className="graph-tools">
        <button type="button" onClick={() => setZoom(autoscaleY(allX, allY, view))} disabled={p.live || n < 2}>Autoscale</button>
        <button type="button" onClick={() => setZoom(null)} disabled={p.live || !zoom}>Reset view</button>
        <button type="button" onClick={() => setExpanded((v) => !v)} aria-pressed={expanded}>{expanded ? 'Close expanded graph' : 'Expand graph'}</button>
      </div>
      <svg
        ref={setSvg} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img" tabIndex={0} className="graph-svg"
        aria-label={`${p.yLabel} against ${p.xLabel}. ${p.sourceTag ? p.sourceTag + ". " : ""}${many ? (p.series as readonly Series[]).length + ' curves: ' + (p.series as readonly Series[]).map((s) => s.label).join(', ') + '.' : n + ' points.'}`}
        style={{ background: pal.background, cursor: p.live || n < 2 ? 'default' : zoom ? 'grab' : 'crosshair' }}
        onKeyDown={onKey}
        onMouseMove={(e) => {
          const c = at(e);
          setCursor(c);
          if (drag) {
            if (drag.mode === 'pan') {
              const a = toData(drag.from, drag.start, BOX), b = toData(c, drag.start, BOX);
              setZoom(pan(drag.start, a.x - b.x, a.y - b.y));
            }
            setDrag({ ...drag, to: c });
          }
        }}
        onMouseLeave={() => { setCursor(null); setDrag(null); }}
        onMouseDown={(e) => { const c = at(e); if (!p.live && n >= 2 && inside(c)) setDrag({ from: c, to: c, mode: zoom && !e.shiftKey ? 'pan' : 'box', start: view }); }}
        onMouseUp={() => {
          if (drag && drag.mode === 'box' && Math.abs(drag.to.x - drag.from.x) > 8 && Math.abs(drag.to.y - drag.from.y) > 8) {
            const a = toData(drag.from, view, BOX), b = toData(drag.to, view, BOX);
            setZoom({ x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y) });
          }
          setDrag(null);
        }}
        onDoubleClick={() => setZoom(null)}
      >
        <rect x="0" y="0" width={W} height={H} fill={pal.background} />
        <clipPath id="plot-area"><rect x={BOX.left} y={BOX.top} width={BOX.width} height={BOX.height} /></clipPath>
        {xt.map((t) => { const q = toPx({ x: t, y: view.y0 }, view, BOX); return (
          <g key={'x' + t}>
            <line x1={q.x} x2={q.x} y1={BOX.top} y2={BOX.top + BOX.height} stroke={pal.grid} strokeWidth="1" />
            <text x={q.x} y={BOX.top + BOX.height + 18} textAnchor="middle" fontSize="12" fill={pal.muted} fontFamily="system-ui, sans-serif">{sig(t, 4)}</text>
          </g>); })}
        {yt.map((t) => { const q = toPx({ x: view.x0, y: t }, view, BOX); return (
          <g key={'y' + t}>
            <line x1={BOX.left} x2={BOX.left + BOX.width} y1={q.y} y2={q.y} stroke={pal.grid} strokeWidth="1" />
            <text x={BOX.left - 8} y={q.y + 4} textAnchor="end" fontSize="12" fill={pal.muted} fontFamily="system-ui, sans-serif">{sig(t, 4)}</text>
          </g>); })}
        <rect x={BOX.left} y={BOX.top} width={BOX.width} height={BOX.height} fill="none" stroke={pal.ink} strokeWidth="1" />
        <text x={BOX.left + BOX.width / 2} y={H - 10} textAnchor="middle" fontSize="13" fill={pal.ink} fontFamily="system-ui, sans-serif">{p.xLabel}</text>
        <text x={16} y={BOX.top + BOX.height / 2} textAnchor="middle" fontSize="13" fill={pal.ink} fontFamily="system-ui, sans-serif" transform={`rotate(-90 16 ${BOX.top + BOX.height / 2})`}>{p.yLabel}</text>
        <g clipPath="url(#plot-area)">
          {p.fitLine && !p.live ? (() => { const a = toPx(p.fitLine.from, view, BOX), b = toPx(p.fitLine.to, view, BOX); return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={pal.accent} strokeWidth="2" strokeDasharray="6 4" />; })() : null}
          {path ? <path d={path} fill="none" stroke={pal.curve} strokeWidth="2" strokeLinejoin="round" /> : null}
          {paths.map((d, i) => (d ? <path key={'s' + i} d={d} fill="none" stroke={(p.series as readonly Series[])[i]!.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" {...((p.series as readonly Series[])[i]!.dash ? { strokeDasharray: (p.series as readonly Series[])[i]!.dash } : {})} /> : null))}
          {!p.live ? markers.map((m) => { const q = toPx(m, view, BOX); return <circle key={m.id} cx={q.x} cy={q.y} r={snapped && snapped.id === m.id ? 6 : 4} fill={pal.mark} stroke={pal.background} strokeWidth="1.5" />; }) : null}
          {shownPx && !p.live ? <circle cx={shownPx.x} cy={shownPx.y} r="4" fill="none" stroke={pal.accent} strokeWidth="2" /> : null}
          {drag && drag.mode === 'box' ? <rect x={Math.min(drag.from.x, drag.to.x)} y={Math.min(drag.from.y, drag.to.y)} width={Math.abs(drag.to.x - drag.from.x)} height={Math.abs(drag.to.y - drag.from.y)} fill={pal.accent} fillOpacity="0.12" stroke={pal.accent} /> : null}
        </g>
        {n < 2 ? <text x={BOX.left + BOX.width / 2} y={BOX.top + BOX.height / 2} textAnchor="middle" fontSize="14" fill={pal.muted} fontFamily="system-ui, sans-serif">{p.emptyText ?? 'No data yet.'}</text> : null}
        <text x={BOX.left + 8} y={BOX.top + 16} textAnchor="start" fontSize="12" fill={pal.muted} fontFamily="system-ui, sans-serif">{p.sourceTag}</text>
        {many ? (() => {
          /* Legend inside the picture, top right, so a saved image names every curve. Text in ink; the line sample carries the identity. */
          const list = p.series as readonly Series[], rowH = 16, w = 188, x0 = BOX.left + BOX.width - w - 6, y0 = BOX.top + 6;
          return (
            <g aria-hidden="true">
              <rect x={x0} y={y0} width={w} height={list.length * rowH + 8} fill={pal.background} fillOpacity="0.88" stroke={pal.grid} />
              {list.map((s, i) => (
                <g key={'l' + i}>
                  <line x1={x0 + 8} x2={x0 + 36} y1={y0 + 12 + i * rowH} y2={y0 + 12 + i * rowH} stroke={s.color} strokeWidth="2.5" strokeLinecap="round" {...(s.dash ? { strokeDasharray: s.dash } : {})} />
                  <text x={x0 + 42} y={y0 + 16 + i * rowH} fontSize="11" fill={pal.ink} fontFamily="system-ui, sans-serif">{s.label.length > 24 ? s.label.slice(0, 23) + '…' : s.label}</text>
                </g>))}
            </g>);
        })() : null}
      </svg>
      <p className="graph-readout" aria-live="off">
        {shown ? <>{shown.name ? <strong>{shown.name}: </strong> : null}{p.xName} = {sig(shown.x, 4)} {p.xUnit}, {p.yName} = {sig(shown.y, 4)} {p.yUnit}</>
          : n < 2 ? ' ' : p.live ? 'Recording. Zoom and the readout are available when recording stops.' : many ? 'Move over a curve to read a point and see which test it is. Scroll or drag to zoom; double-click to reset.' : 'Move over the curve, or use the arrow keys, to read a point. Scroll or drag to zoom; double-click to reset.'}
        {zoom && !p.live ? <span className="graph-range"> · Showing {p.xName} {sig(view.x0, 3)} to {sig(view.x1, 3)}</span> : null}
      </p>
    </div>
  );
}
