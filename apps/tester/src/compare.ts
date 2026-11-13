/* Summary of several recorded tests of one test type, for the Compare tests screen.
   Pure functions: no React, no DOM. A missing value stays null and is never replaced by a number. */
import { dimIsExample, keyNumbers, sampleStats } from '@tensile/core';
import type { TestRecord, TestType } from '@tensile/core';
import type { LoadedTest } from './load';

export const MAX_COMPARE = 12;

export interface CompareItem {
  name: string;
  test: TestType;
  record: TestRecord | null;
  problem?: string;
  material: string;
  specimenId: string;
  kind: 'session' | 'csv';
}
export interface CompareMetric { id: string; label: string; unit: string }
export interface CompareRow { name: string; specimenId: string; material: string; values: Record<string, number | null>; note: string }
export interface CompareSummary {
  test: TestType;
  metrics: CompareMetric[];
  rows: CompareRow[];
  stats: Record<string, { n: number; mean: number | null; sd: number | null }>;
  warnings: string[];
}

/* Units follow keyNumbers in packages/core/src/analysis.ts: stress and modulus in MPa, strain in mm/mm,
   energy density in MJ/m3, times in s, relaxed amount in %. */
const METRICS: Record<TestType, CompareMetric[]> = {
  uniaxial: [
    { id: 'E', label: 'Automatic modulus estimate (E)', unit: 'MPa' },
    { id: 'yield', label: 'Offset yield (estimate; only when set)', unit: 'MPa' },
    { id: 'uts', label: 'Ultimate tensile strength', unit: 'MPa' },
    { id: 'utsStrain', label: 'Strain at ultimate tensile strength', unit: 'mm/mm' },
    { id: 'failStrain', label: 'Estimated failure strain', unit: 'mm/mm' },
    { id: 'tough', label: 'Energy density to recorded endpoint', unit: 'MJ/m3' },
  ],
  relaxation: [
    { id: 's0', label: 'Ramp-peak stress (s0)', unit: 'MPa' },
    { id: 'hs', label: 'Hold-start stress', unit: 'MPa' },
    { id: 'send', label: 'Final recorded stress', unit: 'MPa' },
    { id: 'relaxed', label: 'Relaxed', unit: '%' },
    { id: 'E0', label: 'Apparent stress/strain ratio after ramp (E0)', unit: 'MPa' },
    { id: 'tau', label: 'Endpoint-referenced 1/e decay time (tau)', unit: 's' },
  ],
};

export function compareItemFromLoaded(t: LoadedTest): CompareItem {
  return {
    name: t.name, test: t.test, record: t.record, problem: t.problem || undefined, kind: t.kind,
    material: t.setup ? t.setup.material : '', specimenId: t.setup ? t.setup.specimenId : '',
  };
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function listNames(names: string[]): string {
  return names.join(', ');
}

export function compareSummary(items: CompareItem[]): CompareSummary {
  if (!items.length) throw new Error('Choose at least one test to compare.');
  if (items.length > MAX_COMPARE) throw new Error(`At most ${MAX_COMPARE} tests can be compared at once.`);
  const test = items[0]!.test;
  if (items.some((i) => i.test !== test)) throw new Error('All tests in a comparison must be the same test type.');
  const metrics = METRICS[test];

  const rows: CompareRow[] = items.map((it) => {
    const values: Record<string, number | null> = {};
    for (const m of metrics) values[m.id] = null;
    if (!it.record) return { name: it.name, specimenId: it.specimenId, material: it.material, values, note: it.problem || 'No data' };
    const k = keyNumbers(it.record, test === 'relaxation', { includeOffsetYield: true }) as Record<string, unknown>;
    for (const m of metrics) values[m.id] = num(k[m.id]);
    return { name: it.name, specimenId: it.specimenId, material: it.material, values, note: '' };
  });

  const stats: CompareSummary['stats'] = {};
  for (const m of metrics) stats[m.id] = sampleStats(rows.map((r) => r.values[m.id]).filter((v): v is number => v !== null));

  const warnings: string[] = [];
  const mats = new Map<string, string>();
  for (const it of items) { const m = it.material.trim(); if (m) mats.set(m.toLowerCase(), m); }
  if (mats.size > 1) warnings.push(`These tests are from different materials (${[...mats.values()].join(', ')}). A mean across different materials is rarely meaningful.`);
  const noId = items.filter((i) => !i.specimenId.trim());
  if (noId.length) warnings.push(`${noId.length === 1 ? '1 test has' : noId.length + ' tests have'} no specimen ID (${listNames(noId.map((i) => i.name))}), so the rows are identified by file name only.`);
  const csv = items.filter((i) => i.kind === 'csv');
  if (csv.length) warnings.push(`${csv.length === 1 ? '1 test was' : csv.length + ' tests were'} opened from a CSV file (${listNames(csv.map((i) => i.name))}). The origin of a CSV file cannot be verified.`);
  const ex = items.filter((i) => i.record && dimIsExample(i.record));
  if (ex.length) warnings.push(`${listNames(ex.map((i) => i.name))} ${ex.length === 1 ? 'uses' : 'use'} example dimensions, not measurements, so stress, strain, and the results may be wrong for the specimen.`);
  const noDims = items.filter((i) => i.record && !i.record.dimSource);
  if (noDims.length) warnings.push(`The source of the specimen dimensions is not recorded for ${listNames(noDims.map((i) => i.name))}, so they may not be measurements.`);
  const none = items.filter((i) => !i.record);
  if (none.length) warnings.push(`${none.length === 1 ? '1 test has' : none.length + ' tests have'} no data (${listNames(none.map((i) => i.name))}) and ${none.length === 1 ? 'is' : 'are'} left out of the mean and standard deviation.`);
  const few = metrics.filter((m) => stats[m.id]!.n < 2);
  if (few.length) warnings.push(`The standard deviation needs at least 2 values and is not available for: ${few.map((m) => m.label).join('; ')}.`);

  return { test, metrics, rows, stats, warnings };
}

function cell(v: string): string {
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function numCell(v: number | null): string {
  return v === null ? '' : String(v);
}

export function compareCsv(s: CompareSummary): string {
  const line = (cells: string[]) => cells.map(cell).join(',');
  const out: string[] = [
    '# Comparison summary',
    '# Test,' + (s.test === 'relaxation' ? 'Stress relaxation' : 'Uniaxial tension'),
    '# Data,Measured; files opened in the tester app (origin of CSV imports not verified)',
    '# Draft',
  ];
  for (const w of s.warnings) out.push(line(['# Warning', w]));
  out.push(line(['Test', 'Specimen ID', 'Material', ...s.metrics.map((m) => `${m.label} (${m.unit})`), 'Note']));
  for (const r of s.rows) out.push(line([r.name, r.specimenId, r.material, ...s.metrics.map((m) => numCell(r.values[m.id] ?? null)), r.note]));
  out.push(line(['Mean', '', '', ...s.metrics.map((m) => numCell(s.stats[m.id]!.mean)), '']));
  out.push(line(['SD (sample)', '', '', ...s.metrics.map((m) => numCell(s.stats[m.id]!.sd)), '']));
  return out.join('\n') + '\n';
}
