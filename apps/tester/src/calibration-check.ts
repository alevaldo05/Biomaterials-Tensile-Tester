/* Calibration check with known weights: the state and maths of the Device screen's check, with no screen code.
   It compares force readings with F = m g, fits a line, and flags points against a tolerance the person enters.
   It changes no reading or calibration anywhere and saves nothing. The maths is the website's (packages/core). */
import { calibrationCsv, calibrationFit, calibrationPoints, G0, parseNumber } from '@tensile/core';
import type { CalibrationFit, CalibrationPoint, CalibrationRow, CalibrationSettings } from '@tensile/core';

export interface CheckInput {
  rows: CalibrationRow[];
  unit: 'g' | 'kg';
  /** Gravity as typed, m/s2. */
  g: string;
  /** Tolerance as typed, % of reading. Empty means no flags. */
  tol: string;
  /** The device id, if a device is identified; else empty. */
  deviceId: string;
  notes: string;
}
export interface CheckResult {
  settings: CalibrationSettings;
  points: CalibrationPoint[];
  fit: CalibrationFit;
  /** Problems with the settings, in words (gravity, tolerance). */
  problems: string[];
  /** Problems with single rows, by row index (a negative mass, text that is not a number). */
  rowProblems: Record<number, string>;
}

export const MIN_ROWS = 5;
export const emptyRows = (n = MIN_ROWS): CalibrationRow[] => Array.from({ length: n }, () => ({ m: '', r: '' }));
export const DEFAULT_G = String(G0);

/** The mean of the readings, ignoring missing ones; null when there is none. */
export function averageReading(samples: readonly (number | null | undefined)[]): number | null {
  let s = 0, n = 0;
  for (const v of samples) if (typeof v === 'number' && isFinite(v)) { s += v; n++; }
  return n ? s / n : null;
}

/** A number for a text box: 5 significant digits, no trailing zeros. */
export function showNumber(v: number | null | undefined, digits = 5): string {
  return v === null || v === undefined || !isFinite(v) ? '' : String(parseFloat(v.toPrecision(digits)));
}

export function computeCheck(input: CheckInput): CheckResult {
  const problems: string[] = [], rowProblems: Record<number, string> = {};
  const gv = input.g.trim() === '' ? null : parseNumber(input.g);
  const g = gv !== null && gv > 0 ? gv : null;
  if (g === null) problems.push('Enter gravity as a number above 0 (m/s2); the standard value is ' + DEFAULT_G + '.');
  let tol: number | null = null;
  if (input.tol.trim() !== '') {
    const t = parseNumber(input.tol);
    if (t === null || t < 0) problems.push('Tolerance must be a number of 0 or more (% of reading), or left empty.');
    else tol = t;
  }
  input.rows.forEach((r, i) => {
    const m = r.m.trim() === '' ? undefined : parseNumber(r.m), rd = r.r.trim() === '' ? undefined : parseNumber(r.r);
    if (m === null) rowProblems[i] = 'The mass is not a number.';
    else if (m !== undefined && m < 0) rowProblems[i] = 'The mass cannot be negative.';
    else if (rd === null) rowProblems[i] = 'The reading is not a number.';
  });
  const settings: CalibrationSettings = { unit: input.unit, g, tol };
  const points = calibrationPoints(input.rows, settings);
  const fit = calibrationFit(points);
  return { settings, points, fit, problems, rowProblems };
}

/** Points with a mass or a reading typed (the rows the record lists). */
export const usedPoints = (r: CheckResult): CalibrationPoint[] => r.points.filter((q) => q.m !== null || q.r !== null);

export function fitSummary(f: CalibrationFit): string {
  if (!f.ok) return f.msg;
  return 'Slope (reading per N) ' + showNumber(f.a) + ', offset ' + showNumber(f.b) + ' N, R2 ' + (f.r2 === null || f.r2 === undefined ? 'not available' : showNumber(f.r2, 7)) + ', from ' + f.n + ' points.';
}

/** Text for Copy results. */
export function summaryText(input: CheckInput, r: CheckResult, date: Date): string {
  const out = [
    'Calibration check with known weights (draft; check only, no calibration was changed; no claim of traceability)',
    'Date: ' + date.toLocaleString(),
    'Device: ' + (input.deviceId || 'not recorded'),
    'Gravity g: ' + (r.settings.g ?? 'not set') + ' m/s2; mass unit ' + input.unit + '; tolerance ' + (r.settings.tol === null ? 'none' : r.settings.tol + ' % of reading'),
    '',
    'mass (' + input.unit + ') | expected F (N) | reading (N) | error (N) | error (% of reading) | flag',
  ];
  for (const q of usedPoints(r)) {
    out.push([showNumber(q.m), showNumber(q.F), showNumber(q.r), showNumber(q.err), showNumber(q.pct, 4), r.settings.tol === null || q.pct === null ? '' : q.out ? 'outside tolerance' : 'within tolerance'].join(' | '));
  }
  out.push('', fitSummary(r.fit));
  if (r.fit.ok && r.fit.big !== null && r.fit.big !== undefined) out.push('Largest error: ' + showNumber(r.fit.big) + ' N');
  const flagged = r.points.filter((q) => q.out).length;
  if (r.settings.tol !== null) out.push(flagged + ' point(s) outside the tolerance you entered.');
  out.push('A software baseline or a tare is not a calibration.');
  return out.join('\n');
}

const SOURCE = 'tester app: readings typed by hand or read from the connected device (check only; no calibration was changed)';

/** The CSV record (with the website's header lines). */
export function checkCsv(input: CheckInput, r: CheckResult, date: Date): string {
  return calibrationCsv({
    settings: { ...r.settings, cell: input.deviceId, notes: input.notes.trim() },
    points: r.points, fit: r.fit, example: false, date, source: SOURCE, title: 'calibration check',
  });
}
