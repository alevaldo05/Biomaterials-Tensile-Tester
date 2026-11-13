/* The TypeScript port must give the same results as the website's own scripts on the same inputs.
   The website's results are saved in ../reference/fixtures/reference.json. */
import { describe, expect, it } from 'vitest';
import saved from '../reference/fixtures/reference.json';
import { csvVariants, SPEC, STARTED, syntheticRelaxation, syntheticUniaxial } from '../reference/cases.mjs';
import { loadLegacy } from '../reference/legacy.mjs';
import {
  buildTestCsv, clone, csvFileBase, csvMetaRows, dataChecks, dimSourceText, holdStartText, initSample, keyNumbers, keyPoints,
  loadingFit, modulusFitText, niceTicks, offsetYield, recompute, recordFromCsv, regionsFor, skippedRowsText, sig, sourceTag,
} from '../src/index';
import type { CsvContext, DimSource, TestParams, TestRecord, TestType } from '../src/index';

const plain = <T>(v: T): unknown => JSON.parse(JSON.stringify(v));
const samples = plain(loadLegacy().SAMPLE_DATA) as TestRecord[];

/* Example parameters taken from the sample records, as the website does. */
function defaults(test: TestType, material: string): TestParams {
  const all = samples.filter((r) => r.test === test);
  const r = all.find((q) => q.material === material) || all[0];
  const p = clone((r as TestRecord).params);
  if (test === 'relaxation') p.hold_mm = (p.hold_strain as number) * p.specimen.L0_mm;
  return p;
}
function pick(r: TestRecord) {
  const p = r.params;
  return plain({
    mk: r.mk, direct: r.direct, simulated: r.simulated, dimSource: r.dimSource, dimsFromFile: r.dimsFromFile, baseLabel: r.baseLabel,
    specimenId: r.specimenId, materialText: r.materialText, fileDate: r.fileDate, fileMeta: r.fileMeta, model: p.model,
    specimen: p.specimen, yield: p.yield, offsetPct: p.offsetPct ?? null, hold_mm: p.hold_mm ?? null, hold_s: p.hold_s ?? null,
    hold_strain: p.hold_strain ?? null, holdSource: p.holdSource ?? null, temperature_C: p.temperature_C, environment: p.environment,
    n: r.x.length, x: r.x, y: r.y, hasRawD: !!(r.raw && r.raw.d), checkT: r.checkT ? r.checkT.length : 0,
  });
}

describe('sample curves', () => {
  for (const s of samples) {
    it(`${s.id}: key results, key points, and regions match the website`, () => {
      const want = (saved.samples as Record<string, Record<string, unknown>>)[s.id as string] as Record<string, unknown>;
      const r = clone(s), isRelax = r.test === 'relaxation';
      initSample(r, isRelax);
      recompute(r, isRelax);
      expect(plain(r.x)).toEqual(want.x);
      expect(plain(r.y)).toEqual(want.y);
      expect(plain(keyNumbers(r, isRelax))).toEqual(want.numbers);
      const k = keyPoints(r, isRelax);
      expect(plain(k)).toEqual(want.keyPoints);
      expect(plain(regionsFor(r, k, isRelax))).toEqual(want.regions);
      if (isRelax) expect(holdStartText(r)).toEqual(want.holdStartText);
      else {
        const fit = loadingFit(r.x, r.y);
        expect(plain(fit)).toEqual(want.fit);
        for (const pct of [0.2, 1, 2]) expect(plain(offsetYield(r.x, r.y, fit, pct))).toEqual((want.offsetYield as Record<string, unknown>)[String(pct)]);
      }
    });
  }
});

describe('synthetic recordings', () => {
  const cases: [TestType, TestRecord, { slug: string; name: string }][] = [
    ['uniaxial', syntheticUniaxial() as TestRecord, { slug: 'uniaxial-tension', name: 'Uniaxial tension' }],
    ['relaxation', syntheticRelaxation() as TestRecord, { slug: 'stress-relaxation', name: 'Stress relaxation' }],
  ];
  for (const [test, rec, kind] of cases) {
    const want = saved.synthetic[test], isRelax = test === 'relaxation';
    const started = new Date(STARTED[0], STARTED[1], STARTED[2], STARTED[3], STARTED[4], STARTED[5]);
    const ctx: CsvContext = { spec: SPEC, kind, isRelax, startedAt: started, endReason: 'Stopped by the user.' };
    recompute(rec, isRelax);

    it(`${test}: results and data checks match the website`, () => {
      expect(plain(keyNumbers(rec, isRelax))).toEqual(want.numbers);
      const k = keyPoints(rec, isRelax);
      expect(plain(k)).toEqual(want.keyPoints);
      expect(plain(regionsFor(rec, k, isRelax))).toEqual(want.regions);
      expect(plain(dataChecks(rec, isRelax))).toEqual(want.dataChecks);
      expect(isRelax ? holdStartText(rec) : '').toEqual(want.holdStartText);
      expect(isRelax ? '' : modulusFitText(rec)).toEqual(want.modulusFitText);
    });
    it(`${test}: the CSV file is identical, character for character`, () => {
      expect(csvFileBase(rec, ctx)).toEqual(want.fileBase);
      expect(buildTestCsv(rec, ctx)).toEqual(want.csv);
      const measured: TestRecord = { ...rec, source: 'measured', skippedLines: 0 };
      expect(plain(csvMetaRows(measured, { ...ctx, endReason: 'Force dropped below 50% of the peak.' }))).toEqual(want.measuredMeta);
      expect(csvFileBase(measured, { ...ctx, startedAt: null })).toEqual(want.measuredFileBase);
    });
    it(`${test}: the saved CSV reads back the same way`, () => {
      const loaded = recordFromCsv('saved.csv', want.csv, test, { defaults, websiteYieldRule: true });
      expect(pick(loaded)).toEqual(want.loaded);
      expect(plain(keyNumbers(loaded, isRelax))).toEqual(want.loadedNumbers);
      expect(plain(dataChecks(loaded, isRelax))).toEqual(want.loadedChecks);
      expect(sourceTag(loaded)).toEqual(want.loadedTag);
    });
  }
});

describe('CSV files in other shapes', () => {
  const variants = csvVariants() as Record<string, { test: TestType; text: string }>;
  for (const [name, v] of Object.entries(variants)) {
    it(name, () => {
      const want = (saved.csvVariants as Record<string, { error?: string; loaded?: unknown; numbers?: unknown; checks?: unknown }>)[name]!;
      const isRelax = v.test === 'relaxation';
      if (want.error) {
        expect(() => recordFromCsv(name + '.csv', v.text, v.test, { defaults, websiteYieldRule: true })).toThrow(want.error);
        return;
      }
      const r = recordFromCsv(name + '.csv', v.text, v.test, { defaults, websiteYieldRule: true });
      expect(pick(r)).toEqual(want.loaded);
      expect(plain(keyNumbers(r, isRelax))).toEqual(want.numbers);
      expect(plain(dataChecks(r, isRelax))).toEqual(want.checks);
    });
  }
});

describe('rows the CSV reader leaves out', () => {
  const head = '# Material,Rabbit tissue\n# L0 (mm),20\n# Width (mm),5\n# Thickness (mm),1\nDisplacement (mm),Force (N)\n';
  const rows = (n: number) => Array.from({ length: n }, (_, i) => (i / 10) + ',' + (i * 0.2)).join('\n');
  it('counts rows that are empty, text, or hex-style, and says nothing for a clean file', () => {
    const clean = recordFromCsv('c.csv', head + rows(20) + '\n', 'uniaxial', { defaults });
    expect(clean.skippedRows).toBeUndefined();
    expect(skippedRowsText(clean)).toBe('');
    const messy = recordFromCsv('m.csv', head + rows(20) + '\n5,abc\n6,\n0x10,3\n7,0b11\n', 'uniaxial', { defaults });
    expect(messy.skippedRows).toBe(4);
    expect(messy.x.length).toBe(clean.x.length);
    expect(skippedRowsText(messy)).toBe('4 rows of the file could not be read as numbers and were left out.');
    expect(dataChecks(messy, false).items.join(' ')).not.toContain('could not be read');   /* the website-matching checks are unchanged */
  });
  it('says "row" for exactly one', () => {
    const one = recordFromCsv('o.csv', head + rows(20) + '\n9,xyz\n', 'uniaxial', { defaults });
    expect(skippedRowsText(one)).toBe('1 row of the file could not be read as numbers and was left out.');
  });
});

describe('helpers', () => {
  it('niceTicks, sig, and the fixed labels match the website', () => {
    const ticks: [number, number, number][] = [[0, 1, 5], [0, 0.37, 6], [-3.2, 18.4, 5], [0, 123456, 4], [0.001, 0.0023, 5]];
    expect(plain(ticks.map((a) => niceTicks(...a)))).toEqual(saved.helpers.niceTicks);
    const sigs: [unknown, number][] = [[0, 3], [1234.567, 3], [0.000123456, 4], [NaN, 3], [null, 3], [-45.678, 2], [1e21, 3]];
    expect(sigs.map((a) => sig(...a))).toEqual(saved.helpers.sig);
    expect((['sample', 'simulated', 'measured'] as const).map((s) => sourceTag({ source: s }))).toEqual(saved.helpers.sourceTag);
    const dims: DimSource[] = ['typed', 'example', 'file', 'file-example', 'assumed', 'edited', 'not-needed'];
    expect(dims.map((d) => dimSourceText({ dimSource: d }))).toEqual(saved.helpers.dimText);
  });
});

describe('two things the port does differently on purpose', () => {
  it('reports the opt-in offset yield in the comparison numbers when asked', () => {
    const rec = syntheticUniaxial() as TestRecord;
    recompute(rec, false);
    const website = keyNumbers(rec, false) as { yield: number | null };
    const fixed = keyNumbers(rec, false, { includeOffsetYield: true }) as { yield: number | null };
    expect(website.yield).toBeNull();
    expect(fixed.yield).toBeCloseTo(saved.synthetic.uniaxial.keyPoints.yield.y, 12);
  });
  it('does not turn the 0.2% yield on for a file with no known material', () => {
    const text = (csvVariants() as Record<string, { text: string }>)['direct-percent-kpa']!.text;
    expect(recordFromCsv('f.csv', text, 'uniaxial', { defaults, websiteYieldRule: true }).params.yield).toBe(true);
    expect(recordFromCsv('f.csv', text, 'uniaxial', { defaults }).params.yield).toBe(false);
    const steel = '# Material,Mild steel\n' + text;
    expect(recordFromCsv('f.csv', steel, 'uniaxial', { defaults }).params.yield).toBe(true);
  });
});
