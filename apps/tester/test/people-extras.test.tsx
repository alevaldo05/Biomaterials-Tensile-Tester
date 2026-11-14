/* More for the sign-in: a student's limits stop a recording from starting (never the machine), the class list and the
   usage report, and the check that tells whether a saved test file changed since the app saved it. */
import { describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimulatedDevice } from '@tensile/acquisition';
import { TestController } from '../src/controller';
import { MachineAccess, People, limitProblem } from '../src/people';
import type { Me, PeopleBridge } from '../src/people';
import { parseClassList, usageReportCsv } from '../src/pages/PeopleExtras';
import { LoadTest } from '../src/pages/LoadTest';
import { openTestFile } from '../src/load';
import { sealState, sealed, sealedText, sha256Hex } from '../src/seal';
import { measuredSetup, move, ready } from './helpers';

vi.mock('virtual:site-data', async () => {
  const { loadSiteData } = await import('../site-data');
  return { default: loadSiteData(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')) };
});

const student: Me = { name: 'Sam Student', username: 'sam', kind: 'student', kindName: 'Student', mustChange: false, endDate: '2026-12-20', daysLeft: 36,
  responsible: { name: 'Olga Operator', username: 'olga', by: 'gave access' }, canRunMachine: true, why: '', limits: { maxSpeed: 20, methods: [] } };
const bridge = new Proxy({} as PeopleBridge, { get: () => async () => ({ error: 'not in this test' }) });

async function recorded() {
  const a = new MachineAccess(new People(bridge));
  a.set({ ...student, limits: null });
  const dev = new SimulatedDevice({ manualMotion: true, auto: false });
  const c = new TestController({ openReal: () => dev, journal: null, commitEvery_ms: 0, machine: () => a.check() });
  ready(c);
  await c.connect();
  c.useSetup(measuredSetup(c));
  await c.startRecording();
  move(dev, c);
  dev.step(600);
  c.stopRecording();
  return c;
}

describe('a student’s limits', () => {
  it('refuse Start recording outside the limits and say why; the app sends nothing to slow the machine', async () => {
    expect(limitProblem(null, '30', null)).toBe('');
    expect(limitProblem({ maxSpeed: 20, methods: [] }, '30', null)).toBe('Your operator set a maximum crosshead speed of 20 mm/min.');
    expect(limitProblem({ maxSpeed: 20, methods: [] }, '', null)).toContain('maximum crosshead speed');
    expect(limitProblem({ maxSpeed: 20, methods: [] }, '20', null)).toBe('');
    const m = { maxSpeed: null, methods: [{ id: 'm-1', name: 'Skin, slow' }] };
    expect(limitProblem(m, '30', null)).toBe('Your operator limited you to these test methods: Skin, slow. Choose one under Test methods.');
    expect(limitProblem(m, '30', 'Skin, slow')).toBe('');
    const a = new MachineAccess(new People(bridge));
    a.set(student);
    const dev = new SimulatedDevice({ manualMotion: true, auto: false });
    const c = new TestController({ openReal: () => dev, journal: null, commitEvery_ms: 0, machine: () => a.check() });
    ready(c);
    await c.connect();
    c.useSetup(measuredSetup(c));
    expect(c.startProblem).toBe('Your operator set a maximum crosshead speed of 20 mm/min.');
    await c.startRecording();
    expect(c.phase).toBe('setup');
    c.setup = { ...c.setup, speed: '15' };
    expect(c.startProblem).toBe('');
    await c.startRecording();
    expect(c.phase).toBe('recording');
    expect(c.sessionFile()!.operator).toMatchObject({ limits: { maxSpeed: 20, methods: [] } });
  });
});

describe('the class list and the usage report', () => {
  it('reads a pasted class list, skips a heading row, and names the lines it cannot use', () => {
    const r = parseClassList('Name,Username,Password,End\nAna One,Ana.One,first-pass1,2027-01-31\n"Ben Two";ben2;short\nCy Three\tcy3\tfirst-pass3\t', '2027-02-28');
    expect(r.rows).toEqual([{ name: 'Ana One', username: 'ana.one', password: 'first-pass1', kind: 'student', endDate: '2027-01-31' },
      { name: 'Cy Three', username: 'cy3', password: 'first-pass3', kind: 'student', endDate: '2027-02-28' }]);
    expect(r.problems).toEqual(['Line 3: the first password is shorter than 8 characters.']);
    expect(parseClassList('Dee,dee4,first-pass4', '').problems).toEqual(['Line 1: no end date.']);
  });
  it('downloads the usage report as CSV, safe from spreadsheet formulas', () => {
    const csv = usageReportCsv([{ username: 'sam', name: '=cmd', kind: 'student', kindName: 'Student', tests: 3, recordingMinutes: 12.5, lastUse: '2026-11-14T10:00:00.000Z', asResponsible: 0 }]);
    expect(csv.split('\r\n')[0]).toBe('Name,Username,Access,Tests run,Recording time (min),Responsible operator for (tests),Last use');
    expect(csv.split('\r\n')[1]).toBe("'=cmd,sam,Student,3,12.5,0,2026-11-14T10:00:00.000Z");
  });
});

describe('the check on a saved test file', () => {
  it('works SHA-256 out the same as Node’s own', () => {
    for (const t of ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'µ σ ε — Δx/L₀ ✓'.repeat(40)]) {
      expect(sha256Hex(t)).toBe(crypto.createHash('sha256').update(t, 'utf8').digest('hex'));
    }
  });
  it('says unchanged, changed (one reading edited), or not checked (an older file), and Load test shows it', async () => {
    const c = await recorded();
    const f = c.sessionFile()!;
    const text = sealedText(f);
    expect(sealState(JSON.parse(text))).toBe('unchanged');
    /* the same contents written another way (indented) are still the same contents */
    expect(sealState(JSON.parse(JSON.stringify(JSON.parse(text), null, 2)))).toBe('unchanged');
    const edited = JSON.parse(text);
    edited.lines[edited.lines.length - 2] = edited.lines[edited.lines.length - 2].replace(/"raw":(\d)/, '"raw":9$1');
    expect(sealState(edited)).toBe('changed');
    expect(sealState(f)).toBe('none');
    expect(sealed(sealed(f)).check).toEqual(sealed(f).check);
    const page = async (t: string) => renderToStaticMarkup(createElement(LoadTest, { loaded: await openTestFile('t.session.json', t), error: '', theme: 'light', recent: [], openFile: () => undefined, clear: () => undefined }));
    expect(await page(text)).toContain('<dt>Changes</dt><dd>Unchanged since it was saved</dd>');
    expect(await page(JSON.stringify(edited))).toContain('Changed since it was saved');
    expect(await page(JSON.stringify(f))).toContain('Not checked (saved by an older version)');
  });
});
