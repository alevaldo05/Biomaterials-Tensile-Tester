/* Calibration from bench points: the volts at the tester's output for known loads (N) or known displacements (mm),
   fitted with a straight line, value = slope × volts + offset. Pure: no screen code, so it is tested by itself.
   The line fit is the website's (packages/core calibrationFit), given volts as x and the known value as y.
   It changes nothing in the app. The result is a draft calibration record to download; the app uses it only after
   it is put in a setup file (or approved on the lab server). Not a traceable calibration. */
import { calibrationFit } from '@tensile/core';
import type { CalibrationPoint } from '@tensile/core';
import type { CalibrationRecord, SignalPath } from '@tensile/recording';
import { unitFor } from './pages/signal-path';

export type Quantity = 'force' | 'displacement';
export interface BenchRow { v: string; x: string }
export interface BenchInput {
  quantity: Quantity;
  rows: BenchRow[];
  /** Largest allowed difference between a point and the line, in N or mm, as typed. Empty means no flags. */
  tol: string;
}
export interface BenchPoint { i: number; v: number | null; x: number | null; fitted: number | null; residual: number | null; out: boolean }
export interface BenchResult {
  ok: boolean;
  /** Why there is no line yet, in words. */
  msg: string;
  n: number;
  slope?: number;
  offset?: number;
  r2?: number | null;
  /** The point furthest from the line (signed), in N or mm. */
  maxResidual?: number | null;
  points: BenchPoint[];
  rowProblems: Record<number, string>;
  tolProblem: string;
  unit: 'N' | 'mm';
}

export const MIN_POINTS = 5;
export const emptyBenchRows = (n = MIN_POINTS): BenchRow[] => Array.from({ length: n }, () => ({ v: '', x: '' }));

function num(t: string): number | null {
  const s = t.trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function fitBench(input: BenchInput): BenchResult {
  const unit = unitFor(input.quantity);
  const rowProblems: Record<number, string> = {};
  const raw = input.rows.map((r, i) => {
    const v = num(r.v), x = num(r.x);
    if (Number.isNaN(v) || Number.isNaN(x)) rowProblems[i] = 'Enter numbers only.';
    else if ((v === null) !== (x === null)) rowProblems[i] = 'Enter both the volts and the known value.';
    return { i, v: Number.isNaN(v) ? null : v, x: Number.isNaN(x) ? null : x };
  });
  const tolN = num(input.tol);
  const tolProblem = Number.isNaN(tolN) || (tolN !== null && !(tolN > 0)) ? 'The tolerance must be a number above 0.' : '';
  const tol = tolProblem || tolN === null ? null : tolN;
  const pairs = raw.filter((p) => p.v !== null && p.x !== null && !rowProblems[p.i]);
  const base: BenchResult = { ok: false, msg: '', n: pairs.length, points: raw.map((p) => ({ ...p, fitted: null, residual: null, out: false })), rowProblems, tolProblem, unit };
  if (pairs.length < 2) return { ...base, msg: 'Enter at least 2 points to fit a line (' + MIN_POINTS + ' or more are recommended).' };
  if (new Set(pairs.map((p) => p.v)).size < 2) return { ...base, msg: 'The volts are all the same, so no line can be fitted.' };
  /* calibrationFit fits r = a·F + b; here F is volts and r the known value, so a is the slope and b the offset. */
  const pts: CalibrationPoint[] = pairs.map((p) => ({ i: p.i, m: null, r: p.x, F: p.v, err: null, pct: null, out: false }));
  const f = calibrationFit(pts);
  if (!f.ok || f.a === undefined || f.b === undefined) return { ...base, msg: f.msg || 'No line could be fitted.' };
  const slope = f.a, offset = f.b;
  let maxResidual: number | null = null;
  const points = raw.map((p) => {
    if (p.v === null || p.x === null || rowProblems[p.i]) return { ...p, fitted: null, residual: null, out: false };
    const fitted = slope * p.v + offset, residual = p.x - fitted;
    if (maxResidual === null || Math.abs(residual) > Math.abs(maxResidual)) maxResidual = residual;
    return { ...p, fitted, residual, out: tol !== null && Math.abs(residual) > tol };
  });
  if (slope === 0) return { ...base, msg: 'The fitted slope is 0, so the volts do not follow the known values.' };
  return { ok: true, msg: '', n: pairs.length, slope, offset, r2: f.r2 ?? null, maxResidual, points, rowProblems, tolProblem, unit };
}

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;

/** The draft record to download, tied to the signal path it was made with. Measured, never simulated. */
export function benchRecord(r: BenchResult, quantity: Quantity, path: SignalPath, id: string, note: string, now: Date): { ok: true; record: CalibrationRecord } | { ok: false; reason: string } {
  if (!r.ok || r.slope === undefined || r.offset === undefined) return { ok: false, reason: r.msg || 'Fit a line first.' };
  const t = id.trim();
  if (!ID_PATTERN.test(t)) return { ok: false, reason: 'Use 2 to 64 lowercase letters, digits, dots, dashes, or underscores for the id.' };
  const extra = 'Bench fit of ' + r.n + ' points' + (r.r2 != null ? ', r² ' + r.r2.toFixed(5) : '') + (r.maxResidual != null ? ', largest difference ' + Math.abs(r.maxResidual).toPrecision(3) + ' ' + r.unit : '') + '.';
  return { ok: true, record: { id: t, quantity, unit: r.unit, slope: r.slope, offset: r.offset, signalPath: path, origin: 'measured', createdAt: now.toISOString(), note: (note.trim() ? note.trim() + ' ' : '') + extra } };
}

/** The points and the fit as CSV (opens in Excel). Text cells are quoted; numbers stay in base units. */
export function benchCsv(r: BenchResult, quantity: Quantity, now: Date): string {
  const q = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  const lines = ['# Calibration from bench points (draft, not traceable)', '# Date,' + now.toISOString(), '# Quantity,' + quantity,
    '# Slope (' + r.unit + '/V),' + (r.slope ?? ''), '# Offset (' + r.unit + '),' + (r.offset ?? ''), '# r2,' + (r.r2 ?? ''),
    q('Point') + ',' + q('Volts at tester output (V)') + ',' + q('Known value (' + r.unit + ')') + ',' + q('Line (' + r.unit + ')') + ',' + q('Difference (' + r.unit + ')') + ',' + q('Outside tolerance')];
  for (const p of r.points) if (p.v !== null && p.x !== null) lines.push([p.i + 1, p.v, p.x, p.fitted ?? '', p.residual ?? '', p.out ? 'yes' : ''].join(','));
  return lines.join('\r\n') + '\r\n';
}
