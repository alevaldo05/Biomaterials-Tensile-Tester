import { describe, expect, it } from 'vitest';
import { sampleStats } from '@tensile/core';
import type { TestRecord } from '@tensile/core';
import { openTestFile } from '../src/load';
import { compareCsv, compareItemFromLoaded, compareSummary, MAX_COMPARE } from '../src/compare';
import type { CompareItem } from '../src/compare';
import { measuredSetup, move, ready, rig } from './helpers';

async function loaded(name: string, o: { steps?: number; width?: string; relax?: boolean; id?: string; material?: string } = {}) {
  const { dev, c } = rig();
  ready(c);
  if (o.relax) { c.test = 'relaxation'; c.setup = { ...c.setup, holdMm: '1', holdS: '30' }; }
  c.setup = { ...c.setup, width: o.width ?? c.setup.width, specimenId: o.id ?? '', material: o.material ?? c.setup.material };
  await c.connect();
  c.useSetup(measuredSetup(c));
  await c.startRecording();
  move(dev, c);
  dev.step(o.steps ?? 2400);
  c.stopRecording();
  return openTestFile(name, JSON.stringify(c.sessionFile()));
}

const item = (over: Partial<CompareItem> = {}): CompareItem => ({ name: 'a', test: 'uniaxial', record: null, material: 'Skin', specimenId: 'S1', kind: 'session', ...over });

describe('compare', () => {
  it('lists the key results for each test type', async () => {
    const u = compareSummary([item()]);
    expect(u.metrics.map((m) => m.id)).toEqual(['E', 'yield', 'uts', 'utsStrain', 'failStrain', 'tough']);
    expect(u.metrics.find((m) => m.id === 'tough')!.unit).toBe('MJ/m3');
    const r = compareSummary([item({ test: 'relaxation' })]);
    expect(r.metrics.map((m) => m.id)).toEqual(['s0', 'hs', 'send', 'relaxed', 'E0', 'tau']);
    expect(r.metrics.find((m) => m.id === 'tau')!.unit).toBe('s');
  });

  it('computes values and statistics from real records, skipping nulls', async () => {
    const a = compareItemFromLoaded(await loaded('a.json', { id: 'A', width: '5' }));
    const b = compareItemFromLoaded(await loaded('b.json', { id: 'B', width: '6', steps: 2000 }));
    expect(a.specimenId).toBe('A');
    const s = compareSummary([a, b]);
    expect(s.rows.map((r) => r.name)).toEqual(['a.json', 'b.json']);
    const uts = s.rows.map((r) => r.values.uts!);
    expect(uts[0]).toBeGreaterThan(0);
    expect(uts[0]).not.toBe(uts[1]);
    expect(s.stats.uts).toEqual(sampleStats(uts));
    for (const m of s.metrics) {
      const vals = s.rows.map((r) => r.values[m.id]).filter((v): v is number => v !== null);
      expect(s.stats[m.id]).toEqual(sampleStats(vals));
    }
    expect(s.warnings.some((w) => w.includes('different materials'))).toBe(false);
    expect(s.warnings.some((w) => w.includes('no specimen ID'))).toBe(false);
  });

  it('handles relaxation records', async () => {
    const a = compareItemFromLoaded(await loaded('r1.json', { relax: true, id: 'R1' }));
    const s = compareSummary([a]);
    expect(s.test).toBe('relaxation');
    expect(s.rows[0]!.values.s0).toBeGreaterThan(0);
    expect(s.stats.s0!.n).toBe(1);
    expect(s.stats.s0!.sd).toBeNull();
  });

  it('throws for empty, too many, or mixed test types', () => {
    expect(() => compareSummary([])).toThrow();
    expect(() => compareSummary(Array.from({ length: MAX_COMPARE + 1 }, () => item()))).toThrow(/At most 12/);
    expect(() => compareSummary([item(), item({ test: 'relaxation' })])).toThrow('All tests in a comparison must be the same test type.');
    expect(() => compareSummary(Array.from({ length: MAX_COMPARE }, () => item()))).not.toThrow();
  });

  it('warns only when a warning applies', async () => {
    const l = await loaded('a.json', { id: 'A' });
    const clean = compareSummary([compareItemFromLoaded(l), compareItemFromLoaded(await loaded('b.json', { id: 'B' }))]);
    expect(clean.warnings.filter((x) => !x.includes('standard deviation'))).toEqual([]);

    const rec = l.record as TestRecord;
    const w = (items: CompareItem[]) => compareSummary(items).warnings.join('\n');
    const base = compareItemFromLoaded(l);
    expect(w([base, { ...base, name: 'b', material: 'Steel' }])).toContain('different materials');
    expect(w([base, { ...base, name: 'b', material: 'Steel' }])).toContain('Steel');
    expect(w([base, { ...base, name: 'b', specimenId: '' }])).toContain('no specimen ID');
    expect(w([base, { ...base, name: 'b', kind: 'csv' }])).toContain('cannot be verified');
    const ex = { ...base, name: 'b', record: { ...rec, dimSource: 'example' as const } };
    expect(w([base, ex])).toContain('example dimensions');
    expect(w([base, { ...base, name: 'b', record: null }])).toContain('no data');
    const fewW = compareSummary([base]).warnings;
    expect(fewW.filter((x) => x.includes('standard deviation'))).toHaveLength(1);
  });

  it('keeps an item without a record as an all-null row', () => {
    const s = compareSummary([item({ problem: 'Could not read it.' }), item({ name: 'b' })]);
    expect(s.rows[0]!.note).toBe('Could not read it.');
    expect(Object.values(s.rows[0]!.values).every((v) => v === null)).toBe(true);
    expect(s.rows[1]!.note).toBe('No data');
    expect(s.stats.E).toEqual({ n: 0, mean: null, sd: null });
  });

  it('writes the summary CSV', async () => {
    const a = compareItemFromLoaded(await loaded('a.json', { id: 'A', material: 'Skin, rabbit' }));
    const b = compareItemFromLoaded(await loaded('b.json', { id: 'B', width: '6', material: 'Skin, rabbit' }));
    const s = compareSummary([a, b, item({ name: 'c "x"', material: 'Skin, rabbit' })]);
    const csv = compareCsv(s);
    expect(csv.endsWith('\n')).toBe(true);
    expect(csv).not.toContain('\r');
    const lines = csv.split('\n');
    expect(lines.slice(0, 4)).toEqual(['# Comparison summary', '# Test,Uniaxial tension', '# Data,Measured; files opened in the tester app (origin of CSV imports not verified)', '# Draft']);
    const hi = lines.findIndex((l) => l.startsWith('Test,'));
    expect(hi).toBe(4 + s.warnings.length);
    expect(lines.slice(4, hi).every((l) => l.startsWith('# Warning,'))).toBe(true);
    expect(lines[hi]).toBe('Test,Specimen ID,Material,' + s.metrics.map((m) => `${m.label} (${m.unit})`).join(',') + ',Note');
    expect(lines[hi + 1]).toContain('"Skin, rabbit"');
    expect(lines[hi + 3]).toContain('"c ""x"""');
    const rest = lines.slice(hi + 1).filter((l) => l !== '');
    expect(rest.length).toBe(3 + 2);
    expect(rest[3]!.startsWith('Mean,,,')).toBe(true);
    expect(rest[4]!.startsWith('SD (sample),,,')).toBe(true);
    expect(rest[3]).toContain(String(s.stats.uts!.mean));
    expect(rest[2]).toMatch(/,No data$/);
    expect(compareCsv(compareSummary([item({ test: 'relaxation' })])).split('\n')[1]).toBe('# Test,Stress relaxation');
  });
});
