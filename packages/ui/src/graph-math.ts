/* The arithmetic behind the graph: scales, the view, thinning points for drawing, and finding the point
   under the cursor. No drawing and no page access here, so it can be tested by itself.
   Thinning changes only what is drawn. The recorded arrays are never changed. */
import { niceTicks } from '@tensile/core';

export interface View { x0: number; x1: number; y0: number; y1: number }
export interface Box { left: number; top: number; width: number; height: number }
export interface Pt { x: number; y: number }

function span(values: readonly number[]): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (const v of values) { if (Number.isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }
  return lo <= hi ? [lo, hi] : [0, 1];
}
/** A round number at or above v, so a growing recording does not rescale the axis on every new point. */
export function roundUp(v: number): number {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
  return (f <= 1 ? 1 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 3 ? 3 : f <= 5 ? 5 : f <= 7.5 ? 7.5 : 10) * p;
}
/** The view that shows all the data, starting from zero on both axes, with a little room above. */
export function fullView(x: readonly number[], y: readonly number[]): View {
  const [xl, xh] = span(x), [yl, yh] = span(y);
  return { x0: Math.min(0, xl), x1: roundUp(xh > 0 ? xh : 1), y0: yl < 0 ? -roundUp(-yl) : 0, y1: roundUp(yh > 0 ? yh * 1.02 : 1) };
}
/** Keeps the x range and fits y to the points inside it, with 8% room. */
export function autoscaleY(x: readonly number[], y: readonly number[], v: View): View {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i] as number, yi = y[i] as number;
    if (xi >= v.x0 && xi <= v.x1 && Number.isFinite(yi)) { if (yi < lo) lo = yi; if (yi > hi) hi = yi; }
  }
  if (!(lo <= hi)) return v;
  const pad = (hi - lo || Math.abs(hi) || 1) * 0.08;
  return { ...v, y0: Math.min(0, lo - (lo < 0 ? pad : 0)), y1: hi + pad };
}
export function zoomAt(v: View, fx: number, fy: number, factor: number): View {
  const k = Math.min(2, Math.max(0.5, factor)), cx = v.x0 + fx * (v.x1 - v.x0), cy = v.y0 + fy * (v.y1 - v.y0);
  return { x0: cx - (cx - v.x0) * k, x1: cx + (v.x1 - cx) * k, y0: cy - (cy - v.y0) * k, y1: cy + (v.y1 - cy) * k };
}
export function pan(v: View, dx: number, dy: number): View { return { x0: v.x0 + dx, x1: v.x1 + dx, y0: v.y0 + dy, y1: v.y1 + dy }; }

export function toPx(p: Pt, v: View, b: Box): Pt {
  return { x: b.left + ((p.x - v.x0) / (v.x1 - v.x0)) * b.width, y: b.top + b.height - ((p.y - v.y0) / (v.y1 - v.y0)) * b.height };
}
export function toData(px: Pt, v: View, b: Box): Pt {
  return { x: v.x0 + ((px.x - b.left) / b.width) * (v.x1 - v.x0), y: v.y0 + ((b.top + b.height - px.y) / b.height) * (v.y1 - v.y0) };
}
export function ticksFor(lo: number, hi: number, n: number): number[] {
  if (!(hi > lo)) return [lo];
  return niceTicks(lo, hi, n).ticks.filter((t) => t >= lo - 1e-12 && t <= hi + 1e-12);
}

/** The points to draw: everything when there are few; otherwise the lowest and highest point of each of `buckets`
    slices, so peaks and drops are still drawn. Returns indexes into the arrays, in order. */
export function thin(x: readonly number[], y: readonly number[], v: View, buckets = 2000): number[] {
  let a = 0, b = x.length - 1;
  while (a < b && (x[a + 1] as number) < v.x0) a++;
  while (b > a && (x[b - 1] as number) > v.x1) b--;
  const n = b - a + 1;
  if (n <= buckets * 2) return Array.from({ length: Math.max(0, n) }, (_, i) => a + i);
  const out: number[] = [], size = n / buckets;
  for (let k = 0; k < buckets; k++) {
    const s = a + Math.floor(k * size), e = Math.min(b, a + Math.floor((k + 1) * size) - 1);
    let lo = s, hi = s;
    for (let i = s; i <= e; i++) { if ((y[i] as number) < (y[lo] as number)) lo = i; if ((y[i] as number) > (y[hi] as number)) hi = i; }
    if (lo === hi) out.push(lo); else out.push(Math.min(lo, hi), Math.max(lo, hi));
  }
  return out;
}

/** Index of the recorded point nearest the cursor on screen. -1 when there is none. */
export function nearestIndex(x: readonly number[], y: readonly number[], cursor: Pt, v: View, b: Box): number {
  let best = -1, bd = Infinity;
  const step = Math.max(1, Math.floor(x.length / 20000));
  const dist = (i: number) => { const p = toPx({ x: x[i] as number, y: y[i] as number }, v, b); return (p.x - cursor.x) ** 2 + (p.y - cursor.y) ** 2; };
  for (let i = 0; i < x.length; i += step) { const d = dist(i); if (d < bd) { bd = d; best = i; } }
  for (let i = Math.max(0, best - step); i <= Math.min(x.length - 1, best + step); i++) { const d = dist(i); if (d < bd) { bd = d; best = i; } }
  return best;
}

export interface Marker extends Pt { id: string; label: string }
export const SNAP_PX = 14;
/** The key-result marker within 14 px of the cursor, if any (the nearest one). */
export function snapTo(markers: readonly Marker[], cursor: Pt, v: View, b: Box): Marker | null {
  let best: Marker | null = null, bd = SNAP_PX * SNAP_PX;
  for (const m of markers) {
    const p = toPx(m, v, b), d = (p.x - cursor.x) ** 2 + (p.y - cursor.y) ** 2;
    if (d <= bd) { bd = d; best = m; }
  }
  return best;
}
