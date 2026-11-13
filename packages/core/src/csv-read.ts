/* Reading a CSV file into a record. Columns are found by header keywords, units by tokens in the header.
   Lines starting with "#" are notes; files saved by the test pages use "# Key,Value" lines, which are read back.
   Ported from the website's graph-core.js and checked against it. */
import { maxOf, median } from './format';
import { clone, recompute } from './record';
import type { Specimen, TestParams, TestRecord, TestType } from './record';

type Quantity = 'time' | 'disp' | 'force' | 'strain' | 'stress';

const ALIAS: Record<Quantity, string[]> = {
  time: ['time', 't', 'sec', 'seconds'],
  disp: ['displacement', 'extension', 'elongation', 'disp'],
  force: ['force', 'load'],
  strain: ['strain'],
  stress: ['stress'],
};
const UNITS: Record<Quantity, Record<string, number>> = {
  time: { s: 1, sec: 1, ms: 0.001, min: 60 },
  disp: { mm: 1, cm: 10, m: 1000, um: 0.001 },
  force: { n: 1, kn: 1000, lbf: 4.44822 },
  strain: { '%': 0.01, percent: 0.01 },
  stress: { mpa: 1, kpa: 0.001, pa: 1e-6, gpa: 1000, psi: 0.00689476 },
};

function classify(h: string): { q: Quantity; f: number } | null {
  const tokens = h.toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim().split(' ');
  for (const q of Object.keys(ALIAS) as Quantity[]) {
    for (let i = 0; i < tokens.length; i++) {
      if (ALIAS[q].indexOf(tokens[i] as string) >= 0) {
        let f = 1;
        tokens.forEach((tk, j) => { const u = UNITS[q][tk]; if (j !== i && u !== undefined) f = u; });
        return { q, f };
      }
    }
  }
  return null;
}

export interface CsvMeta {
  test?: string; source?: string; material?: string; id?: string; date?: string;
  L0?: string; W?: string; T?: string; speed?: string; hold_mm?: string; hold_s?: string;
  temp?: string; env?: string; notes?: string; dimsrc?: string; offsetPct?: string;
  /** Every "# Key,Value" line of the file, in order. */
  all?: [string, string][];
}
type MetaField = Exclude<keyof CsvMeta, 'all'>;
const META_KEYS: [string, MetaField][] = [
  ['test', 'test'], ['source', 'source'], ['material', 'material'], ['specimen id', 'id'], ['date', 'date'],
  ['gauge length', 'L0'], ['width', 'W'], ['thickness', 'T'], ['crosshead speed', 'speed'],
  ['hold displacement', 'hold_mm'], ['hold duration', 'hold_s'], ['temperature', 'temp'],
  ['environment', 'env'], ['notes', 'notes'], ['dimensions source', 'dimsrc'], ['offset yield', 'offsetPct'],
];

function readMeta(line: string, meta: CsvMeta): void {
  const body = line.replace(/^["']?#\s*/, '');
  const m = body.match(/^([^,;\t]*)[,;\t](.*)$/);
  if (!m) return;
  const rawKey = (m[1] as string).replace(/"/g, '').trim(), key = rawKey.toLowerCase();
  const val = (m[2] as string).replace(/[,;\t]+$/, '').trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"').replace(/^'(?=[=+\-@])/, '');
  (meta.all = meta.all || []).push([rawKey, val]);
  META_KEYS.forEach((k) => { if (key.indexOf(k[0]) === 0 && meta[k[1]] === undefined) meta[k[1]] = val; });
}
function numMeta(v: string | undefined): number | null {
  const x = parseFloat(String(v === undefined ? '' : v).replace(',', '.'));
  return x > 0 ? x : null;
}

export interface ParsedCsv {
  /** raw: displacement and force (or time and force); direct: strain and stress (or time and stress). */
  mode: 'raw' | 'direct';
  a: number[];
  b: number[];
  hold: number[];
  holdQ: 'disp' | 'strain' | null;
  meta: CsvMeta;
  dims: Specimen | null;
  t: number[];
  /** Data rows left out because a needed cell was empty or not a plain number. */
  skipped: number;
}

/** Throws an Error with a plain-language message when the file cannot be used. */
export function parseCsv(text: string, isRelax: boolean): ParsedCsv {
  const meta: CsvMeta = {}, lines: string[] = [];
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((l) => {
    const t = l.trim();
    if (!t || /^[,;\t]*$/.test(t)) return;
    if (/^["']?#/.test(t)) readMeta(t, meta);
    else lines.push(l);
  });
  if (meta.test && /relax/i.test(meta.test) !== isRelax) {
    throw new Error('This file is from a ' + meta.test.toLowerCase() + ' test. Choose ' + (isRelax ? 'Uniaxial Tension' : 'Stress Relaxation') + ' above and open it again.');
  }
  if (lines.length < 11) throw new Error('The file needs a header row and at least 10 data rows.');
  if (lines.length > 200001) throw new Error('Too many rows (limit 200,000).');
  const first = lines[0] as string;
  let delim = ',';
  [';', '\t'].forEach((d) => { if (first.split(d).length > first.split(delim).length) delim = d; });
  const heads = first.split(delim).map((h) => h.trim().replace(/^"|"$/g, ''));
  const cols: Partial<Record<Quantity, { i: number; f: number }>> = {};
  heads.forEach((h, i) => { const c = classify(h); if (c && !cols[c.q]) cols[c.q] = { i, f: c.f }; });
  const L0 = numMeta(meta.L0), W = numMeta(meta.W), T = numMeta(meta.T);
  const dims: Specimen | null = L0 && W && T ? { L0_mm: L0, width_mm: W, thickness_mm: T } : null;
  let mode: 'raw' | 'direct', need: [Quantity, Quantity];
  if (isRelax) {
    if (!cols.time || !(cols.stress || cols.force)) throw new Error('Stress relaxation needs a time column plus a stress or force column. Found: ' + heads.join(', ') + '.');
    mode = cols.force && (dims || !cols.stress) ? 'raw' : 'direct';
    need = ['time', mode === 'raw' ? 'force' : 'stress'];
  } else if (cols.disp && cols.force && (dims || !(cols.strain && cols.stress))) { mode = 'raw'; need = ['disp', 'force']; }
  else if (cols.strain && cols.stress) { mode = 'direct'; need = ['strain', 'stress']; }
  else throw new Error('Uniaxial tension needs strain + stress, or displacement + force, columns. Found: ' + heads.join(', ') + '.');
  const holdQ = isRelax ? (cols.disp ? 'disp' : (cols.strain ? 'strain' : null)) : null;
  const out: ParsedCsv = { mode, a: [], b: [], hold: [], holdQ, meta, dims, t: [], skipped: 0 };
  const col = (q: Quantity) => cols[q] as { i: number; f: number };
  for (let r = 1; r < lines.length; r++) {
    const cells = (lines[r] as string).split(delim).map((c) => { c = c.trim().replace(/^"|"$/g, ''); return delim === ';' ? c.replace(',', '.') : c; });
    /* a cell must be a plain decimal number: 0x10, 0b1, and 0o7 are not read as numbers */
    const vals = need.map((q) => { const c = cells[col(q).i]; return c === undefined || c === '' || /^[+-]?0[xbo]/i.test(c) ? NaN : Number(c) * col(q).f; });
    if (vals.some((v) => !Number.isFinite(v))) { out.skipped++; continue; }
    out.a.push(vals[0] as number); out.b.push(vals[1] as number);
    if (cols.time && !isRelax) { const c = cells[cols.time.i]; out.t.push(c === undefined || c === '' ? NaN : Number(c) * cols.time.f); } /* kept only for the data checks */
    if (holdQ) out.hold.push(Number(cells[col(holdQ).i]) * col(holdQ).f);
  }
  if (out.a.length < 10) throw new Error('Fewer than 10 rows contain valid numbers in the ' + need.join(' and ') + ' columns.');
  if (isRelax) { const t0 = out.a[0] as number; out.a = out.a.map((v) => v - t0); }
  return out;
}

/** Plain-words note for a loaded CSV that had rows left out; empty when none. Kept apart from dataChecks, which matches the website. */
export function skippedRowsText(r: { skippedRows?: number } | null | undefined): string {
  const n = r && r.skippedRows ? r.skippedRows : 0;
  return n > 0 ? n + (n === 1 ? ' row of the file could not be read as numbers and was left out.' : ' rows of the file could not be read as numbers and were left out.') : '';
}

/** 'biomaterial', 'steel', or 'concrete' when the material name says so; null for anything else. */
export function materialKey(name: string | null | undefined): 'biomaterial' | 'steel' | 'concrete' | null {
  const s = String(name || '').toLowerCase();
  return /skin|bio|tissue/.test(s) ? 'biomaterial' : /steel/.test(s) ? 'steel' : /concrete/.test(s) ? 'concrete' : null;
}

export interface FromCsvOptions {
  /** Example parameters for a test and material, used when the file gives no dimensions. Must return a fresh object. */
  defaults: (test: TestType, material: string) => TestParams;
  /** The website turns the 0.2% yield on for every file whose material is not skin or tissue, including files with no
      material at all. By default this reader turns it on only for steel. Set true to get the website's rule. */
  websiteYieldRule?: boolean;
}

/** Builds a record from a CSV file's text. Throws an Error with a plain-language message. */
export function recordFromCsv(name: string, text: string, test: TestType, opts: FromCsvOptions): TestRecord {
  const isRelax = test === 'relaxation';
  const d = parseCsv(text, isRelax), meta = d.meta, mk = materialKey(meta.material);
  const p = opts.defaults(test, mk || 'biomaterial');
  if (d.dims) p.specimen = d.dims;
  p.yield = !isRelax && (opts.websiteYieldRule ? mk !== 'biomaterial' : mk === 'steel');
  p.rate_per_s = ''; p.preload_N = '';
  p.temperature_C = meta.temp || ''; p.environment = meta.env || '';
  const off = numMeta(meta.offsetPct);
  if (!isRelax && off !== null) p.offsetPct = off;   /* the optional offset yield line a test page writes when it was used */
  const simulated = /simul/i.test(meta.source || '');
  const bits = ['Loaded from "' + name + '" in this browser tab only (not uploaded or saved)'];
  if (meta.material) bits.push('material: ' + meta.material);
  if (meta.id) bits.push('specimen ID: ' + meta.id);
  if (meta.date) bits.push('recorded: ' + meta.date);
  if (meta.source) bits.push('source: ' + meta.source);
  if (meta.notes) bits.push('notes: ' + meta.notes);
  p.model = bits.join('; ');
  const r: TestRecord = {
    id: 'loaded', test, material: 'loaded', mk, label: 'Your data: ' + name, fileName: name, source: 'loaded', simulated,
    units: { x: isRelax ? 's' : '-', y: 'MPa' }, params: p, direct: d.mode === 'direct', x: [], y: [],
    dimsFromFile: !!d.dims, baseLabel: d.dims ? 'Dimensions in file' : 'Example dimensions',
    specimenId: meta.id || '', materialText: meta.material || '', fileDate: meta.date || '', fileMeta: meta.all || [],
  };
  if (isRelax) {
    const h = d.hold.filter((v) => Number.isFinite(v));
    p.hold_s = numMeta(meta.hold_s) || Math.round(maxOf(d.a));
    const holdMm = numMeta(meta.hold_mm);
    if (holdMm) { p.hold_mm = holdMm; p.hold_strain = p.hold_mm / p.specimen.L0_mm; p.holdSource = 'header'; }
    else if (d.holdQ === 'strain' && h.length) { p.hold_strain = median(h); p.hold_mm = p.hold_strain * p.specimen.L0_mm; p.holdSource = 'median-strain'; }
    else if (d.holdQ === 'disp' && h.length) { p.hold_mm = median(h); p.hold_strain = p.hold_mm / p.specimen.L0_mm; p.holdSource = 'median'; }
    if (d.mode === 'direct') { r.x = d.a; r.y = d.b; }
    else {
      r.raw = { t: d.a, F: d.b };
      if (d.holdQ === 'disp' && h.length === d.a.length) r.raw.d = d.hold;
    }
  } else if (d.mode === 'direct') { r.x = d.a; r.y = d.b; }
  else r.raw = { d: d.a, F: d.b };
  if (d.t.length && d.t.length === d.a.length) r.checkT = d.t;
  if (d.skipped > 0) r.skippedRows = d.skipped;
  r.dimSource = r.direct ? 'not-needed' : !d.dims ? 'assumed' : /example/i.test(meta.dimsrc || '') ? 'file-example' : 'file';
  r.dimSourceBase = r.dimSource;
  r.base = clone(p);
  recompute(r, isRelax);
  return r;
}
