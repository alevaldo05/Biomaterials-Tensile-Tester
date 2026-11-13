/* The reference cases: fixed inputs run through the website's current calculation code.
   buildReference() returns plain JSON. fixtures/reference.json is a saved copy of it:
   - legacy.test.mjs checks the website code still gives the saved numbers;
   - the TypeScript port in src/ is checked against the same saved numbers.
   All inputs here are made up (sample curves and synthetic records). None of it is measured data. */
import { loadLegacy } from './legacy.mjs';

/* Small seeded random generator, so the synthetic noise is the same on every run. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r6 = (v) => Number(v.toPrecision(6));

/* Synthetic uniaxial recording: toe-shaped loading curve, then a force drop. */
export function syntheticUniaxial() {
  const rnd = seeded(11), L0 = 25, W = 5, T = 1.2, speed = 10, n = 600;
  const t = [], d = [], F = [];
  for (let i = 0; i < n; i++) {
    const ti = i * 0.1, di = (speed / 60) * ti, e = di / L0;
    let s = 0.4 * (Math.exp(9 * e) - 1);
    if (e > 0.33) s = 0.4 * (Math.exp(9 * 0.33) - 1) * 0.03;
    t.push(r6(ti)); d.push(r6(di)); F.push(r6(s * W * T + (rnd() - 0.5) * 0.02));
  }
  return {
    test: 'uniaxial', source: 'simulated', skippedLines: 2, dimSource: 'typed',
    params: { specimen: { L0_mm: L0, width_mm: W, thickness_mm: T }, speed_mm_min: speed, offsetPct: 1, yield: false },
    raw: { t, d, F }, x: [], y: [],
  };
}
/* Synthetic stress-relaxation recording: a ramp to the hold displacement, then a decaying hold. */
export function syntheticRelaxation() {
  const rnd = seeded(23), L0 = 20, W = 6, T = 1.5, hold_mm = 2.5, hold_s = 300;
  const t = [], d = [], F = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    t.push(r6(u * 15)); d.push(r6(u * hold_mm)); F.push(r6(1.8 * u * u * W * T + (rnd() - 0.5) * 0.01));
  }
  for (let i = 1; i <= 480; i++) {
    const th = hold_s * (i / 480) * (i / 480);
    const s = 1.8 * (0.6 + 0.25 * Math.exp(-th / 8) + 0.15 * Math.exp(-th / 90));
    t.push(r6(15 + th)); d.push(hold_mm); F.push(r6(s * W * T + (rnd() - 0.5) * 0.01));
  }
  return {
    test: 'relaxation', source: 'simulated', dimSource: 'typed',
    params: { specimen: { L0_mm: L0, width_mm: W, thickness_mm: T }, speed_mm_min: 10, hold_mm, hold_s, holdSource: 'typed', yield: false },
    raw: { t, d, F }, x: [], y: [],
  };
}

export const SPEC = { mat: 'Rabbit tissue', matLabel: 'Rabbit tissue', id: 'RT-01', temp: '22', env: 'Hydrated (saline)', notes: 'Synthetic record, "not measured"; =check' };
export const STARTED = [2026, 0, 15, 9, 30, 5];   /* local time, so the text is the same in every time zone */

/* Small hand-written files that exercise the CSV reader: other separators, units in headers, and errors. */
export function csvVariants() {
  const rows = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('\n');
  return {
    'semicolon-units': { test: 'uniaxial', text: '# Material;Steel bar\n# Gauge length L0 (mm);50\n# Width (mm);12,5\n# Thickness (mm);3\nTime (ms);Extension (cm);Load (kN)\n' + rows(40, (i) => `${i * 100};${String((i * 0.005).toFixed(4)).replace('.', ',')};${String((i < 30 ? i * 0.4 : 12 - (i - 30) * 1.1).toFixed(3)).replace('.', ',')}`) },
    'direct-percent-kpa': { test: 'uniaxial', text: 'strain (%),stress (kPa)\n' + rows(30, (i) => `${(i * 0.5).toFixed(2)},${(i < 24 ? 40 * (Math.exp(i / 8) - 1) : 30).toFixed(3)}`) },
    'no-dimensions': { test: 'uniaxial', text: 'displacement_mm,force_N\n' + rows(25, (i) => `${(i * 0.1).toFixed(2)},${(i * 0.35).toFixed(3)}`) },
    'relax-direct': { test: 'relaxation', text: 'time_s\tstress_MPa\tstrain\n' + rows(40, (i) => `${5 + i * 2}\t${(1 + Math.exp(-i / 10)).toFixed(5)}\t0.15`) },
    'relax-force-disp': { test: 'relaxation', text: '# Hold duration (s),80\ntime (s),force (N),displacement (mm)\n' + rows(40, (i) => `${i * 2},${(8 + 4 * Math.exp(-i / 6)).toFixed(4)},${i < 3 ? i : 3}`) },
    'bad-rows-skipped': { test: 'uniaxial', text: 'strain,stress\n' + rows(20, (i) => (i % 7 === 3 ? 'x,y' : `${(i * 0.01).toFixed(2)},${(i * 1.5).toFixed(2)}`)) },
    'error-too-few': { test: 'uniaxial', text: 'strain,stress\n0,0\n0.1,1\n' },
    'error-wrong-test': { test: 'uniaxial', text: '# Test,Stress relaxation\ntime_s,stress_MPa\n' + rows(12, (i) => `${i},${10 - i * 0.1}`) },
    'error-columns': { test: 'uniaxial', text: 'alpha,beta\n' + rows(12, (i) => `${i},${i}`) },
    'error-relax-columns': { test: 'relaxation', text: 'strain,stress\n' + rows(12, (i) => `${i},${i}`) },
  };
}

export const CAL_CASES = {
  good: { s: { unit: 'g', g: 9.80665, tol: 1 }, rows: [{ m: '0', r: '0.02' }, { m: '100', r: '0.99' }, { m: '200', r: '1.97' }, { m: '500', r: '4.95' }, { m: '1000', r: '9.71' }] },
  'kg-comma-no-tolerance': { s: { unit: 'kg', g: 9.81, tol: null }, rows: [{ m: '0,5', r: '4,9' }, { m: '1', r: '9,85' }, { m: '', r: '3' }, { m: '2', r: '' }] },
  'one-point': { s: { unit: 'g', g: 9.80665, tol: 2 }, rows: [{ m: '100', r: '1' }, { m: '', r: '' }] },
  'same-mass': { s: { unit: 'g', g: 9.80665, tol: 2 }, rows: [{ m: '100', r: '1' }, { m: '100', r: '1.1' }] },
  'no-gravity': { s: { unit: 'g', g: null, tol: 2 }, rows: [{ m: '100', r: '1' }, { m: '200', r: '2' }] },
};
export const STATS_CASES = [[], [3.2], [1, 2, 3, 4], [5.1, 5.1, 5.1], [0.1 + 0.2, 0.3, 0.3], [-2, 0, 2.5]];

function attempt(f) {
  try { return f(); } catch (e) { return { error: e.message }; }
}
function pick(r) {   /* the parts of a loaded record that the port must reproduce */
  const p = r.params;
  return {
    mk: r.mk, direct: r.direct, simulated: r.simulated, dimSource: r.dimSource, dimsFromFile: r.dimsFromFile, baseLabel: r.baseLabel,
    specimenId: r.specimenId, materialText: r.materialText, fileDate: r.fileDate, fileMeta: r.fileMeta, model: p.model,
    specimen: p.specimen, yield: p.yield, offsetPct: p.offsetPct ?? null, hold_mm: p.hold_mm ?? null, hold_s: p.hold_s ?? null,
    hold_strain: p.hold_strain ?? null, holdSource: p.holdSource ?? null, temperature_C: p.temperature_C, environment: p.environment,
    n: r.x.length, x: r.x, y: r.y, hasRawD: !!(r.raw && r.raw.d), checkT: r.checkT ? r.checkT.length : 0,
  };
}

export function buildReference() {
  const L = loadLegacy(), TG = L.TG, out = {};
  const TGx = Object.assign({}, TG, { modulusFitText: L.modulusFitText });

  out.samples = {};
  L.SAMPLE_DATA.forEach((s) => {
    const r = TG.clone(s), isRelax = r.test === 'relaxation';
    TG.initSample(r, isRelax);
    TG.recompute(r, isRelax);
    const k = TG.keyPoints(r, isRelax), o = { x: r.x, y: r.y, numbers: TG.numbers(r, isRelax), keyPoints: k, regions: TG.regionsFor(r, k, isRelax) };
    if (isRelax) o.holdStartText = TG.holdStartText(r);
    else {
      o.fit = TG.loadingFit(r.x, r.y);
      o.offsetYield = {};
      [0.2, 1, 2].forEach((pct) => { o.offsetYield[pct] = TG.offsetYield(r.x, r.y, o.fit, pct); });
    }
    out.samples[s.id] = o;
  });

  out.synthetic = {};
  [['uniaxial', syntheticUniaxial(), { slug: 'uniaxial-tension', name: 'Uniaxial tension' }], ['relaxation', syntheticRelaxation(), { slug: 'stress-relaxation', name: 'Stress relaxation' }]].forEach(([test, rec, CFG]) => {
    const isRelax = test === 'relaxation';
    TG.recompute(rec, isRelax);
    const csvMaker = L.LiveCsv.create(() => SPEC, CFG, TGx, isRelax), started = new Date(...STARTED);
    const csv = csvMaker.build(rec, started, 'Stopped by the user.');
    const k = TG.keyPoints(rec, isRelax);
    const measured = Object.assign({}, rec, { source: 'measured', skippedLines: 0 });
    const loaded = TG.fromCSV('saved.csv', csv, test);
    out.synthetic[test] = {
      numbers: TG.numbers(rec, isRelax), keyPoints: k, regions: TG.regionsFor(rec, k, isRelax),
      dataChecks: TG.dataChecks(rec, isRelax), holdStartText: isRelax ? TG.holdStartText(rec) : '',
      modulusFitText: isRelax ? '' : L.modulusFitText(rec),
      fileBase: csvMaker.fileBase(rec, started), csv,
      measuredMeta: csvMaker.metaRows(measured, started, 'Force dropped below 50% of the peak.'), measuredFileBase: csvMaker.fileBase(measured, null),
      loaded: pick(loaded), loadedNumbers: TG.numbers(loaded, isRelax), loadedChecks: TG.dataChecks(loaded, isRelax), loadedTag: TG.sourceTag(loaded),
    };
  });

  out.csvVariants = {};
  Object.entries(csvVariants()).forEach(([name, v]) => {
    out.csvVariants[name] = attempt(() => {
      const r = TG.fromCSV(name + '.csv', v.text, v.test), isRelax = v.test === 'relaxation';
      return { loaded: pick(r), numbers: TG.numbers(r, isRelax), checks: TG.dataChecks(r, isRelax) };
    });
  });

  out.calibration = {};
  Object.entries(CAL_CASES).forEach(([name, c]) => {
    L.calibration.setRows(c.rows);
    const pts = L.calibration.points(c.s);
    out.calibration[name] = { points: pts, fit: L.calibration.fit(pts) };
  });
  out.stats = STATS_CASES.map((v) => L.stats(v));

  out.helpers = {
    niceTicks: [[0, 1, 5], [0, 0.37, 6], [-3.2, 18.4, 5], [0, 123456, 4], [0.001, 0.0023, 5]].map((a) => TG.niceTicks(...a)),
    sig: [[0, 3], [1234.567, 3], [0.000123456, 4], [NaN, 3], [null, 3], [-45.678, 2], [1e21, 3]].map((a) => TG.sig(...a)),
    sourceTag: ['sample', 'simulated', 'measured'].map((s) => TG.sourceTag({ source: s })),
    dimText: ['typed', 'example', 'file', 'file-example', 'assumed', 'edited', 'not-needed'].map((d) => TG.dimSourceText({ dimSource: d })),
  };
  /* Through JSON, so the result is plain data (NaN and Infinity become null, as in the saved file). */
  return JSON.parse(JSON.stringify(out));
}
