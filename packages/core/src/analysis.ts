/* Key results calculated from a record. Ported from the website's graph-core.js; the formulas are unchanged
   and are checked against the website's own results (reference/fixtures/reference.json).
   The website has three copies of the uniaxial maths (text rows, points to draw, numbers to compare).
   Here there is one, analyzeUniaxial / analyzeRelaxation, and the other shapes are read from it. */
import { maxOf, sig } from './format';
import type { TestRecord } from './record';

export interface Point { x: number; y: number }
export interface LineFit { slope: number; i0: number; i1: number; b: number; w?: number }

export function peakIndex(Y: readonly number[]): number {
  let pk = 0;
  for (let i = 1; i < Y.length; i++) if ((Y[i] as number) > (Y[pk] as number)) pk = i;
  return pk;
}

/** The steepest least-squares slope over a moving window of w points; windows must end at index last or earlier. */
export function maxSlopeAt(X: readonly number[], Y: readonly number[], w: number, last?: number): LineFit | null {
  let best = -Infinity, at = -1, bq = 0;
  const end = last === undefined ? X.length : last + 1;
  for (let i = 0; i + w <= end; i++) {
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let j = i; j < i + w; j++) {
      const x = X[j] as number, y = Y[j] as number;
      sx += x; sy += y; sxx += x * x; sxy += x * y;
    }
    const d = w * sxx - sx * sx;
    if (d > 0) {
      const sl = (w * sxy - sx * sy) / d;
      if (sl > best) { best = sl; at = i; bq = (sy - sl * sx) / w; }
    }
  }
  return at < 0 ? null : { slope: best, i0: at, i1: at + w - 1, b: bq };
}

/** The automatic modulus estimate: the largest fitted loading slope, searched only up to the peak stress.
    5 points for short curves; 1/60 of the points for long recordings so noise does not set the slope. */
export function loadingFit(X: readonly number[], Y: readonly number[]): LineFit | null {
  const n = X.length, w = n <= 300 ? 5 : Math.round(n / 60);
  const fit = maxSlopeAt(X, Y, w, peakIndex(Y));
  if (fit) fit.w = w;
  return fit;
}

/** The fitted interval as text for the CSV, Excel, and report (always the strain ratio). */
export function fitText(X: readonly number[], fit: LineFit | null): string {
  if (!fit) return '';
  return 'Fitted over ε = ' + sig(X[fit.i0], 3) + ' to ' + sig(X[fit.i1], 3) + ' (' + fit.w + ' points).';
}
export function modulusFitText(rec: Pick<TestRecord, 'x' | 'y'> | null | undefined): string {
  const f = rec && rec.x && rec.x.length > 1 ? loadingFit(rec.x, rec.y) : null;
  return f ? fitText((rec as TestRecord).x, f).replace(/\.$/, '') : '';
}

/** Where the curve first goes from on or above the line to below it. */
function crossing(X: readonly number[], Y: readonly number[], line: (x: number) => number): Point | null {
  for (let m = 1; m < X.length; m++) {
    const x0 = X[m - 1] as number, x1 = X[m] as number, y0 = Y[m - 1] as number, y1 = Y[m] as number;
    const a = y0 - line(x0), b = y1 - line(x1);
    if (a >= 0 && b < 0) { const t = a / (a - b); return { x: x0 + t * (x1 - x0), y: y0 + t * (y1 - y0) }; }
  }
  return null;
}

export interface OffsetYield extends Point { off: number }
/** Opt-in offset yield (offPct in % strain): where the curve crosses the fitted modulus line moved right by the
    offset. The moved line starts from the fitted line's own intercept, so a toe region does not push the result to
    the start of the curve. A method-dependent estimate. */
export function offsetYield(X: readonly number[], Y: readonly number[], fit: LineFit | null, offPct: number): OffsetYield | null {
  const off = offPct / 100;
  if (!fit || !(off > 0)) return null;
  const c = crossing(X, Y, (x) => fit.slope * x + fit.b - fit.slope * off);
  return c ? { x: c.x, y: c.y, off } : null;
}

export interface UniaxialAnalysis {
  n: number;
  fit: LineFit | null;
  /** Automatic modulus estimate in MPa; null when no fitting window was found. */
  E: number | null;
  pk: number;
  uts: Point;
  /** Index of the last point before stress falls below 50% of the peak (force-drop rule). */
  f: number;
  /** False when stress never fell below 50% of the peak, so there is no failure point. */
  detected: boolean;
  fail: Point | null;
  /** Energy density to the failure index (or the last point), MJ/m3, trapezoid rule. */
  tough: number;
  /** 0.2% offset from the origin; only when params.yield is set (ductile sample materials). */
  yield02: Point | null;
  /** Toe-compensated offset yield; only when params.offsetPct is set. */
  offsetYield: OffsetYield | null;
  /** Approximate end of the toe region (illustration only): first point where the slope reaches half the fitted slope. */
  toe: number | null;
}

export function analyzeUniaxial(rec: Pick<TestRecord, 'x' | 'y' | 'params'>): UniaxialAnalysis | null {
  const X = rec.x, Y = rec.y, n = X.length, p = rec.params;
  if (n < 2) return null;
  const fit = loadingFit(X, Y), pk = peakIndex(Y), uts = Y[pk] as number;
  let f = pk;
  while (f + 1 < n && (Y[f + 1] as number) >= 0.5 * uts) f++;
  let tough = 0;
  for (let k = 1; k <= f; k++) tough += 0.5 * ((Y[k] as number) + (Y[k - 1] as number)) * ((X[k] as number) - (X[k - 1] as number));
  const detected = f + 1 < n;
  let toe: number | null = null;
  if (fit) {
    for (let q = 1; q <= pk; q++) {
      const dx = (X[q] as number) - (X[q - 1] as number);
      if (dx > 0 && ((Y[q] as number) - (Y[q - 1] as number)) / dx >= 0.5 * fit.slope) { toe = X[q] as number; break; }
    }
  }
  return {
    n, fit, E: fit && Number.isFinite(fit.slope) ? fit.slope : null, pk, uts: { x: X[pk] as number, y: uts }, f, detected,
    fail: detected ? { x: X[f] as number, y: Y[f] as number } : null, tough,
    yield02: p.yield && fit ? crossing(X, Y, (x) => fit.slope * (x - 0.002)) : null,
    offsetYield: p.offsetPct !== undefined && p.offsetPct > 0 ? offsetYield(X, Y, fit, p.offsetPct) : null,
    toe,
  };
}

export const HOLD_START_FRACTION = 0.98;
export type HoldStart = { i: number; target: number } | { i?: undefined; why: string };
/** Hold start: the first reading where displacement, measured from the first reading, reaches 98% of the hold displacement. */
export function holdStart(rec: Pick<TestRecord, 'x' | 'raw' | 'params'>): HoldStart {
  const raw = rec.raw, p = rec.params, n = rec.x.length;
  if (!raw || !raw.d || raw.d.length !== n) return { why: 'the record has no displacement column' };
  if (!(p.hold_mm !== undefined && p.hold_mm > 0)) return { why: 'there is no hold displacement target' };
  for (let i = 0; i < n; i++) if ((raw.d[i] as number) - (raw.d[0] as number) >= HOLD_START_FRACTION * p.hold_mm) return { i, target: p.hold_mm };
  return { why: 'displacement never reaches ' + Math.round(HOLD_START_FRACTION * 100) + '% of the hold displacement in this record' };
}
/** One line of text for the CSV header: where the hold started, or why it could not be found. */
export function holdStartText(rec: Pick<TestRecord, 'x' | 'y' | 'raw' | 'params'> | null | undefined): string {
  if (!rec || !rec.x || rec.x.length <= 1) return '';
  const h = holdStart(rec);
  return h.i === undefined ? 'not available because ' + h.why :
    'first reading at ' + Math.round(HOLD_START_FRACTION * 100) + '% of the ' + sig(h.target, 4) + ' mm hold displacement: t = ' + sig(rec.x[h.i], 4) + ' s, stress ' + sig(rec.y[h.i], 4) + ' MPa';
}

export interface RelaxationAnalysis {
  n: number;
  pk: number;
  /** Ramp-peak stress. */
  s0: Point;
  /** Final recorded stress; not automatically an equilibrium value. */
  send: Point;
  holdStart: HoldStart;
  hs: Point | null;
  /** Relaxed amount in %, relative to the ramp-peak stress. */
  relaxed: number;
  /** Hold strain: measured at the peak when the record has displacement, else the entered hold strain. */
  e0: number;
  e0Measured: boolean;
  /** Apparent stress/strain ratio after the ramp, MPa; null when the hold strain is not positive. */
  E0: number | null;
  /** Endpoint-referenced 1/e decay time in s, measured from the ramp peak; null when the curve never gets there. */
  tau: number | null;
  tauPoint: (Point & { t0: number }) | null;
}

export function analyzeRelaxation(rec: Pick<TestRecord, 'x' | 'y' | 'raw' | 'params'>): RelaxationAnalysis | null {
  const X = rec.x, Y = rec.y, n = X.length;
  if (n < 2) return null;
  const pk = peakIndex(Y), s0 = Y[pk] as number, se = Y[n - 1] as number, t0 = X[pk] as number;
  const measured = !!(rec.raw && rec.raw.d && rec.raw.d.length === n);
  const e0 = measured ? ((rec.raw as { d: number[] }).d[pk] as number) / rec.params.specimen.L0_mm : (rec.params.hold_strain as number);
  const target = se + (s0 - se) / Math.E;
  let tauPoint: (Point & { t0: number }) | null = null;
  for (let i = pk + 1; i < n; i++) {
    if ((Y[i] as number) <= target) {
      const t = ((Y[i - 1] as number) - target) / ((Y[i - 1] as number) - (Y[i] as number));
      tauPoint = { x: (X[i - 1] as number) + t * ((X[i] as number) - (X[i - 1] as number)), y: target, t0 };
      break;
    }
  }
  const hs = holdStart(rec);
  return {
    n, pk, s0: { x: t0, y: s0 }, send: { x: X[n - 1] as number, y: se }, holdStart: hs,
    hs: hs.i === undefined ? null : { x: X[hs.i] as number, y: Y[hs.i] as number },
    relaxed: 100 * (1 - se / s0), e0, e0Measured: measured, E0: e0 > 0 ? s0 / e0 : null,
    tau: tauPoint ? tauPoint.x - t0 : null, tauPoint,
  };
}

/* ---------- the shapes the website uses (kept so both front ends show the same things) ---------- */

export interface UniaxialNumbers { E: number | null; yield: number | null; uts: number; utsStrain: number; failStrain: number | null; tough: number }
export interface RelaxationNumbers { hs: number | null; s0: number; send: number; relaxed: number; E0: number | null; tau: number | null }
export type KeyNumbers = UniaxialNumbers | RelaxationNumbers | Record<string, never>;

/** Key results as numbers (MPa, s, %, MJ/m3), for comparing specimens.
    The website's version leaves the opt-in offset yield out of `yield`; pass includeOffsetYield to report it
    (the offset yield wins when both are set, as on the graph). */
export function keyNumbers(rec: TestRecord, isRelax: boolean, opts: { includeOffsetYield?: boolean } = {}): KeyNumbers {
  if (isRelax) {
    const a = analyzeRelaxation(rec);
    return a ? { hs: a.hs ? a.hs.y : null, s0: a.s0.y, send: a.send.y, relaxed: a.relaxed, E0: a.E0, tau: a.tau } : {};
  }
  const a = analyzeUniaxial(rec);
  if (!a) return {};
  let y = a.yield02 ? a.yield02.y : null;
  if (opts.includeOffsetYield && rec.params.offsetPct !== undefined && rec.params.offsetPct > 0) y = a.offsetYield ? a.offsetYield.y : null;
  return { E: a.E, yield: y, uts: a.uts.y, utsStrain: a.uts.x, failStrain: a.fail ? a.fail.x : null, tough: a.tough };
}

export interface KeyPoints {
  n: number;
  ok: boolean;
  pk?: number;
  fit?: LineFit;
  E?: number;
  f?: number;
  detected?: boolean;
  uts?: Point;
  fail?: Point | null;
  yield?: Point & { off?: number; comp?: boolean };
  toe?: number;
  s0?: Point;
  send?: Point;
  hs?: Point;
  tau?: Point & { t0: number };
}

/** Positions on the curve for the key results, so they can be drawn. Display only. Needs at least 10 points. */
export function keyPoints(r: TestRecord, isRelax: boolean): KeyPoints {
  const n = r.x.length, k: KeyPoints = { n, ok: false };
  if (n < 10) return k;
  if (isRelax) {
    const a = analyzeRelaxation(r) as RelaxationAnalysis;
    k.ok = true; k.pk = a.pk; k.s0 = a.s0; k.send = a.send;
    if (a.hs) k.hs = a.hs;
    if (a.tauPoint) k.tau = a.tauPoint;
    return k;
  }
  const a = analyzeUniaxial(r) as UniaxialAnalysis;
  if (!a.fit) return k;
  k.ok = true; k.fit = a.fit; k.E = a.fit.slope; k.pk = a.pk; k.f = a.f; k.detected = a.detected; k.uts = a.uts; k.fail = a.fail;
  if (a.yield02) k.yield = a.yield02;
  if (a.offsetYield) k.yield = { x: a.offsetYield.x, y: a.offsetYield.y, off: a.offsetYield.off, comp: true };
  if (a.toe !== null) k.toe = a.toe;
  return k;
}

export type Region = [name: string, from: number, to: number, approximate?: boolean];

function matKeyOf(r: Pick<TestRecord, 'mk' | 'region' | 'material'>): string | null {
  const m = r.mk || r.region || r.material;
  return m === 'biomaterial' || m === 'steel' || m === 'concrete' || m === 'plain' ? m : null;
}

/** Region boundaries for the textbook-style guides, in data units. Display only. */
export function regionsFor(r: TestRecord, k: KeyPoints | null | undefined, isRelax: boolean): Region[] {
  if (!k || !k.ok) return [];
  if (isRelax) {
    const xe = r.x[r.x.length - 1] as number, s0 = k.s0 as Point, out: Region[] = [];
    if ((k.pk as number) > 0) out.push(['Ramp', r.x[0] as number, s0.x]);
    out.push(['Hold', s0.x, xe]);
    return out;
  }
  const mk = matKeyOf(r), up = (k.uts as Point).x, xf = k.fail ? k.fail.x : null;
  /* Without a detected force drop there is no failure point, so the region after the peak is not drawn. */
  const post = (name: string): Region[] => (xf === null ? [] : [[name, up, xf]]);
  if (mk === 'concrete') return ([['Near-linear', 0, up]] as Region[]).concat(post('Fracture'));
  if (mk === 'plain') return ([['Loading', 0, up]] as Region[]).concat(post('Failure'));
  if (mk === 'biomaterial' || !r.params.yield) {
    if (k.toe && k.toe < up) return ([['Toe (approx.)', 0, k.toe, true], ['Linear', k.toe, up]] as Region[]).concat(post('Failure'));
    return ([['Loading', 0, up]] as Region[]).concat(post('Failure'));
  }
  if (k.yield && k.yield.x < up) return ([['Elastic', 0, k.yield.x], ['Strain hardening', k.yield.x, up]] as Region[]).concat(post('Necking'));
  return ([['Loading', 0, up]] as Region[]).concat(post('Failure'));
}

export interface DataChecks { items: string[]; checked: boolean; text: string }
export interface DataCheckOptions {
  /** The website's force-drop option needs this peak force before it can act; leave out to skip that check. */
  minPeakForce_N?: number;
}

/** Warnings only; nothing here changes, drops, or reorders a reading. */
export function dataChecks(r: TestRecord | null | undefined, isRelax: boolean, opts: DataCheckOptions = { minPeakForce_N: 1 }): DataChecks {
  const out: DataChecks = { items: [], checked: false, text: '' };
  if (!r || r.source === 'sample') return out;
  const raw = r.raw, T = (raw && raw.t) || r.checkT || (isRelax && r.direct ? r.x : null);
  if (T && T.length > 1) {
    let bad = 0, last = NaN;
    for (const t of T) {
      if (!Number.isFinite(t)) continue;
      if (Number.isFinite(last) && !(t > last)) bad++;
      last = t;
    }
    out.checked = true;
    if (bad) out.items.push(bad + (bad === 1 ? ' reading had a time equal to or earlier than the one before.' : ' readings had a time equal to or earlier than the one before.') +
      ' The recorded times may not be in order, so slopes and times may be unreliable. The data is kept unchanged.');
  }
  if (!isRelax && raw && raw.F && raw.F.length && opts.minPeakForce_N !== undefined) {
    const need = opts.minPeakForce_N || 1, pk = maxOf(raw.F);
    out.checked = true;
    if (Number.isFinite(pk) && pk < need) out.items.push('The highest force was ' + sig(pk, 3) + ' N, below the ' + need + ' N the force-drop option needs, so it could not send STOP. The data is kept unchanged.');
  }
  if (r.skippedLines !== undefined && r.skippedLines > 0) { out.checked = true; out.items.push(r.skippedLines + (r.skippedLines === 1 ? ' unreadable line was' : ' unreadable lines were') + ' skipped while recording.'); }
  out.text = out.items.length ? out.items.join(' ') : (out.checked ? 'No data-quality problems found by these checks. This does not confirm the data is valid.' : '');
  return out;
}
