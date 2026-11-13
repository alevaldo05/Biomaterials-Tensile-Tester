/* Calibration maths (from calibration.js): force from known masses (F = m g), errors, and a least-squares line.
   It changes no reading anywhere. The page passes in the typed rows and settings. */

export const G0 = 9.80665; /* standard gravity, m/s2 */

export interface CalibrationRow {
  m: string;
  r: string;
}
export interface CalibrationSettings {
  unit: 'g' | 'kg';
  g: number | null;
  tol: number | null;
}
export interface CalibrationPoint {
  i: number;
  m: number | null;
  r: number | null;
  F: number | null;
  err: number | null;
  pct: number | null;
  out: boolean;
}
export interface CalibrationFit {
  n: number;
  ok: boolean;
  msg: string;
  a?: number;
  b?: number;
  r2?: number | null;
  big?: number | null;
  corr?: boolean;
}

/* A number typed by hand; a comma counts as the decimal point. Anything else gives null. */
export function parseNumber(v: unknown): number | null {
  const x = parseFloat(String(v).replace(',', '.'));
  return isFinite(x) ? x : null;
}

export function calibrationPoints(rows: CalibrationRow[], settings: CalibrationSettings): CalibrationPoint[] {
  const k = settings.unit === 'kg' ? 1 : 0.001;
  const out: CalibrationPoint[] = [];
  rows.forEach((row, i) => {
    const m = parseNumber(row.m), r = parseNumber(row.r);
    const F = m !== null && m >= 0 && settings.g !== null ? m * k * settings.g : null;
    const err = F !== null && r !== null ? r - F : null;
    const pct = err !== null && r !== null && r !== 0 ? err / r * 100 : null;
    out.push({
      i, m, r, F, err, pct,
      out: err !== null && settings.tol !== null && settings.tol >= 0 && pct !== null && Math.abs(pct) > settings.tol,
    });
  });
  return out;
}

/* Least squares: reading = gain * force + offset, over rows that have both a force and a reading. */
export function calibrationFit(pts: CalibrationPoint[]): CalibrationFit {
  const p: { F: number; r: number }[] = [];
  pts.forEach((q) => { if (q.F !== null && q.r !== null) p.push({ F: q.F, r: q.r }); });
  const n = p.length;
  const res: CalibrationFit = { n, ok: false, msg: '' };
  if (n < 2) { res.msg = 'Enter at least 2 points (a mass and its reading) to fit a line.'; return res; }
  let mf = 0, mr = 0;
  for (const q of p) { mf += q.F; mr += q.r; }
  mf /= n; mr /= n;
  let sff = 0, sfr = 0, srr = 0;
  for (const q of p) { sff += (q.F - mf) * (q.F - mf); sfr += (q.F - mf) * (q.r - mr); srr += (q.r - mr) * (q.r - mr); }
  if (!(sff > 0)) { res.msg = 'The masses are all the same, so no line can be fitted. Use at least 2 different masses.'; return res; }
  const a = sfr / sff, b = mr - a * mf;
  let ssres = 0;
  for (const q of p) { const d = q.r - (a * q.F + b); ssres += d * d; }
  res.ok = true; res.a = a; res.b = b; res.r2 = srr > 0 ? 1 - ssres / srr : null;
  let big: number | null = null;
  pts.forEach((q) => { if (q.err !== null && (big === null || Math.abs(q.err) > Math.abs(big))) big = q.err; });
  res.big = big;
  res.corr = Math.abs(a) > 1e-12;
  return res;
}

/* ---------- CSV record ---------- */
type CellValue = string | number | null | undefined;

function cell(v: CellValue): string {
  let s = v === null || v === undefined || (typeof v === 'number' && !isFinite(v)) ? '' : String(v);
  if (/^[=+\-@]/.test(s) && !/^-?\d/.test(s)) s = "'" + s; /* keep Excel from treating text as a formula */
  if (/[",;\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function n7(v: number | null | undefined): string {
  return v === null || v === undefined || !isFinite(v) ? '' : String(parseFloat(Number(v).toPrecision(7)));
}
function pad(n: number): string { return (n < 10 ? '0' : '') + n; }
function stamp(d: Date, file: boolean): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + (file ? '_' : ' ') + pad(d.getHours()) + (file ? '' : ':') + pad(d.getMinutes()) + (file ? '' : ':' + pad(d.getSeconds()));
}

export interface CalibrationCsvSettings extends CalibrationSettings {
  cell: string;
  notes: string;
}
export interface CalibrationCsvInput {
  settings: CalibrationCsvSettings;
  points: CalibrationPoint[];
  fit: CalibrationFit;
  /* true when the numbers came from the "Fill example" link */
  example: boolean;
  /* the time shown in the record (local time) */
  date: Date;
}

/* The CSV record text (with a leading byte-order mark, as the page downloads it). */
export function calibrationCsv(input: CalibrationCsvInput): string {
  const { settings: s, points: pts, fit: f, example } = input;
  const used = pts.filter((q) => q.m !== null || q.r !== null);
  const meta: [string, CellValue][] = [
    ['Biomaterials Tensile Tester', 'calibration record'],
    ['Source', example ? 'example numbers (not measured)' : 'entered by hand (not measured by this site)'],
    ['Status', 'draft; no claim of traceability or of meeting a standard'],
    ['Date', stamp(input.date, false)],
    ['Load cell', s.cell],
    ['Notes', s.notes],
    ['Mass unit', s.unit],
    ['Gravity g (m/s2)', s.g],
    ['Tolerance (+/- % of reading)', s.tol === null ? '' : s.tol],
    ['Points', used.length],
    ['Fit', 'reading = gain x force + offset (least squares)'],
    ['Gain', f.ok ? n7(f.a) : ''],
    ['Zero offset (N)', f.ok ? n7(f.b) : ''],
    ['R2', f.ok && f.r2 !== null ? n7(f.r2) : ''],
    ['Largest error (N)', f.ok ? n7(f.big) : ''],
    ['Suggested correction (not applied)', f.ok && f.corr ? 'corrected force = (reading - offset) / gain' : ''],
  ];
  const out = meta.map((m) => '# ' + m[0] + ',' + cell(m[1]));
  out.push('mass_' + s.unit + ',force_N,reading_N,error_N,error_pct_of_reading,outside_tolerance');
  used.forEach((q) => {
    out.push([n7(q.m), n7(q.F), n7(q.r), n7(q.err), n7(q.pct), s.tol === null ? '' : (q.out ? 'yes' : 'no')].join(','));
  });
  return '﻿' + out.join('\r\n') + '\r\n';
}

/* The file name the page gives the download. */
export function calibrationCsvFileName(loadCell: string, date: Date): string {
  return 'calibration_' + ((loadCell || 'record').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'record') + '_' + stamp(date, true) + '.csv';
}
