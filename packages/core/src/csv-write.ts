/* The downloaded CSV of a test: the file name, the "# Key,Value" header lines, and the data rows. Opens in Excel.
   Always base units. Ported from the website's live-csv.js and checked against it, so files written by the app
   reopen on the website's Load Test page and the other way round. */
import { dataChecks, holdStartText, modulusFitText } from './analysis';
import type { DataCheckOptions } from './analysis';
import { dimSourceText } from './record';
import type { TestRecord } from './record';

export interface SpecimenNotes {
  /** Material as typed (used in the file name when there is no specimen ID). */
  mat: string;
  matLabel: string;
  id: string;
  temp: string;
  env: string;
  notes: string;
}
export interface TestKind { slug: string; name: string }
export interface CsvContext {
  spec: SpecimenNotes;
  kind: TestKind;
  isRelax: boolean;
  /** When the recording started, written in the computer's local time; null when unknown. */
  startedAt: Date | null;
  endReason: string;
  checks?: DataCheckOptions;
}

const pad = (n: number) => (n < 10 ? '0' : '') + n;
function stamp(d: Date, forFile: boolean): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + (forFile ? '_' : ' ') + pad(d.getHours()) + (forFile ? '' : ':') + pad(d.getMinutes()) + (forFile ? '' : ':' + pad(d.getSeconds()));
}

/** File name without the extension: test, specimen ID or material, simulated or measured, start time. */
export function csvFileBase(rec: Pick<TestRecord, 'source'>, ctx: Pick<CsvContext, 'spec' | 'kind' | 'startedAt'>): string {
  const who = (ctx.spec.id || ctx.spec.mat).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'test';
  return ctx.kind.slug + '_' + who + '_' + (rec.source === 'simulated' ? 'simulated' : 'measured') + (ctx.startedAt ? '_' + stamp(ctx.startedAt, true) : '');
}

/** One CSV cell: text that Excel could read as a formula gets a leading apostrophe; separators and quotes are quoted. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v)) ? '' : String(v);
  if (/^[=+\-@]/.test(s) && !/^-?\d/.test(s)) s = "'" + s;
  if (/[",;\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
const n7 = (v: number) => (Number.isFinite(v) ? String(parseFloat(v.toPrecision(7))) : '');

export type MetaRow = [key: string, value: string | number | undefined];

export function csvMetaRows(rec: TestRecord, ctx: CsvContext): MetaRow[] {
  const s = ctx.spec, p = rec.params, sp = p.specimen, n = ((rec.raw && rec.raw.t) || []).length, A0 = sp.width_mm * sp.thickness_mm;
  const meta: MetaRow[] = [
    ['Biomaterials Tensile Tester', 'test data'],
    ['Test', ctx.kind.name],
    ['Source', rec.source === 'simulated' ? 'simulated (not measured)' : 'measured'],
    ['Material', s.matLabel],
    ['Specimen ID', s.id],
    ['Date', ctx.startedAt ? stamp(ctx.startedAt, false) : ''],
    ['Gauge length L0 (mm)', sp.L0_mm],
    ['Width (mm)', sp.width_mm],
    ['Thickness (mm)', sp.thickness_mm],
    ['Area A0 (mm2)', n7(A0)],
    ['Crosshead speed (mm/min)', p.speed_mm_min],
  ];
  if (ctx.isRelax) meta.push(['Hold displacement (mm)', p.hold_mm], ['Hold duration (s)', p.hold_s]);
  if (!ctx.isRelax && p.offsetPct !== undefined && p.offsetPct > 0) meta.push(['Offset yield (% strain)', p.offsetPct]);   /* only when it was asked for */
  meta.push(['Temperature (C)', s.temp], ['Environment', s.env], ['Notes', s.notes], ['End of test', ctx.endReason], ['Points', n]);
  const hst = ctx.isRelax ? holdStartText(rec) : '';
  if (hst) meta.push(['Hold start', hst]);
  const mfit = ctx.isRelax ? '' : modulusFitText(rec);
  if (mfit) meta.push(['Modulus fit interval', mfit]);
  const dsrc = dimSourceText(rec);
  if (dsrc) meta.push(['Dimensions source', dsrc]);
  const dq = dataChecks(rec, ctx.isRelax, ctx.checks);
  if (dq.text) meta.push(['Data checks', dq.text]);
  return meta;
}

/** The whole file as text (with a byte-order mark and CRLF line ends, so Excel opens it correctly). */
export function buildTestCsv(rec: TestRecord, ctx: CsvContext): string {
  const raw = rec.raw as { t: number[]; d: number[]; F: number[] }, sp = rec.params.specimen, A0 = sp.width_mm * sp.thickness_mm;
  const out = csvMetaRows(rec, ctx).map((m) => '# ' + m[0] + ',' + csvCell(m[1]));
  out.push('time_s,force_N,displacement_mm,strain,stress_MPa');
  for (let i = 0; i < raw.t.length; i++) {
    const t = raw.t[i] as number, F = raw.F[i] as number, d = raw.d[i] as number;
    out.push([n7(t), n7(F), n7(d), n7(d / sp.L0_mm), n7(F / A0)].join(','));
  }
  return '﻿' + out.join('\r\n') + '\r\n';
}
