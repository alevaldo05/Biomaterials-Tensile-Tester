/* The Test screen in the one-window layout: key results without equations, each with an "i" button, plain axis
   titles, and the Save data menu's keyboard and pointer rules. Rendered with React's server renderer (no browser);
   the layout itself was checked with screenshots in Chromium. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResultsTable } from '../src/components/ResultsTable';
import { viewData } from '../src/components/RecordGraph';
import { resultsFor } from '../src/results';
import { openTestFile } from '../src/load';
import { runTestFrom, upsertRunTest } from '../src/run-tests';
import { measuredSetup, move, ready, rig } from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f: string) => readFileSync(path.join(here, '../src', f), 'utf8');
/** Formula text that must not appear on the Test screen. */
const FORMULA = [/F\s*\/\s*A/, /Δx\s*\/\s*L/, /σ\s*=/, /ε\s*=/, /dσ\s*\/\s*dε/];

async function recorded(o: { relax?: boolean; offset?: boolean } = {}) {
  const { dev, c } = rig();
  ready(c);
  if (o.relax) { c.test = 'relaxation'; c.setup = { ...c.setup, holdMm: '1', holdS: '30' }; }
  if (o.offset) c.setup = { ...c.setup, offsetOn: true, offsetPct: '0.2' };
  await c.connect();
  c.useSetup(measuredSetup(c));
  await c.startRecording();
  move(dev, c);
  dev.step(2400);
  c.stopRecording();
  return c;
}

describe('key results on the Test screen', () => {
  it('show a name, a value, and a unit only, with no formula text, for both test types', async () => {
    for (const o of [{ offset: true }, { relax: true }]) {
      const c = await recorded(o);
      const rows = resultsFor(c.record).screen;
      expect(rows.length).toBeGreaterThan(4);
      for (const r of rows) for (const f of FORMULA) for (const text of [r.label, r.value, r.unit, r.about]) expect(text, r.id + ': ' + text).not.toMatch(f);
      const html = renderToStaticMarkup(<ResultsTable record={c.record} problem="" note="" />);
      for (const f of FORMULA) expect(html).not.toMatch(f);
    }
  });
  it('keep honest short names, and each result has an "i" button that reveals its definition', async () => {
    const c = await recorded({ offset: true });
    const rows = resultsFor(c.record).screen;
    expect(rows.map((r) => r.label)).toEqual(expect.arrayContaining(['Modulus estimate', 'Ultimate tensile strength', 'Strain at failure (estimate)', 'Offset yield (estimate)']));
    expect(rows.find((r) => r.id === 'tough')!.label).toMatch(/^Energy to (failure|recorded end)$/);
    expect(rows.find((r) => r.id === 'E')!.about).toContain('not automatically a validated Young’s modulus');
    expect(rows.find((r) => r.id === 'utsStrain')!.about).toContain('not measured on the specimen');
    const html = renderToStaticMarkup(<ResultsTable record={c.record} problem="" note="" />);
    const buttons = [...html.matchAll(/<button[^>]*aria-label="About ([^"]+)"[^>]*aria-expanded="false"[^>]*aria-controls="about-([a-zA-Z0-9]+)"/g)];
    expect(buttons.map((b) => b[1])).toEqual(rows.map((r) => r.label.toLowerCase()));
    for (const r of rows) expect(html).toMatch(new RegExp('<dd class="kr-about" id="about-' + r.id + '" hidden="">'));
  });
  it('the files keep their full wording (CSV, Excel, and report rows are unchanged)', async () => {
    const c = await recorded();
    expect(resultsFor(c.record).rows.map((r) => r.id)).toEqual(['E', 'uts', 'fail', 'tough']);
    expect(resultsFor(c.record).rows[0]!.name).toBe('Automatic modulus estimate, E');
    const back = await openTestFile('t.session.json', JSON.stringify(c.sessionFile()));
    expect(resultsFor(back.record).screen.map((r) => r.value)).toEqual(resultsFor(c.record).screen.map((r) => r.value));
  });
});

describe('graph and screen source', () => {
  it('uses plain axis titles', () => {
    expect([viewData(null, 'stress', false).xLabel, viewData(null, 'stress', false).yLabel]).toEqual(['Strain (mm/mm)', 'Stress (MPa)']);
    expect([viewData(null, 'force-disp', false).xLabel, viewData(null, 'force-disp', false).yLabel]).toEqual(['Displacement (mm)', 'Force (N)']);
    expect([viewData(null, 'force-time', false).xLabel, viewData(null, 'stress', true).xLabel, viewData(null, 'stress', true).yLabel]).toEqual(['Time (s)', 'Time (s)', 'Stress (MPa)']);
  });
  it('has no formula text in the Test screen source', () => {
    for (const f of ['App.tsx', 'components/RecordGraph.tsx', 'components/ResultsTable.tsx']) {
      const code = src(f);
      for (const p of FORMULA) expect(code, f + ' ' + p).not.toMatch(p);
    }
  });
});

describe('this run\'s specimens', () => {
  it('lists only finished tests, made from their own setup and key results', async () => {
    const { c } = rig();
    expect(runTestFrom(c)).toBeNull();
    const done = await recorded();
    done.setup.specimenId = 'S-9';
    const row = runTestFrom(done)!;
    const screen = resultsFor(done.record).screen;
    expect(row).toMatchObject({ specimenId: 'S-9', material: 'Test', status: 'Done', test: 'uniaxial', saved: 'Not saved yet' });
    expect(row.modulus).toBe(screen.find((r) => r.id === 'E')!.value + ' ' + screen.find((r) => r.id === 'E')!.unit);
    expect(row.peak).toBe(screen.find((r) => r.id === 'uts')!.value + ' ' + screen.find((r) => r.id === 'uts')!.unit);
    const list = upsertRunTest([], row);
    expect(upsertRunTest(list, row)).toBe(list);
    done.update((x) => { x.saved = true; });
    const again = upsertRunTest(list, runTestFrom(done)!);
    expect(again).toHaveLength(1);
    expect(again[0]!.saved).toBe('Downloaded or on the lab server');
  });
  it('shows a dash, not a number, when a test has no stress-strain record', async () => {
    const c = await recorded();
    c.record = null;
    expect(runTestFrom(c)).toMatchObject({ modulus: '—', peak: '—' });
  });
});
