/* Sign-in on the lab computer, as the screens and the controller use it: nobody runs the machine without signing in,
   a student needs a responsible operator, a browser does not connect to the tester, the person running the test is
   kept in its file, the device makers are for the admin, and the usage log downloads safe from spreadsheet formulas.
   The rules themselves are checked in the Windows app (apps/desktop/test/people.test.ts). */
import { describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from '../src/App';
import { Device } from '../src/pages/Device';
import { BROWSER_WHY, MachineAccess, People, operatorBlockOf, responsibleText, runByText, usageCsv } from '../src/people';
import type { Me, PeopleBridge } from '../src/people';
import { TestController, sessionFileFromJournal } from '../src/controller';
import { MemoryJournal } from '../src/storage/journal';
import { SimulatedDevice } from '@tensile/acquisition';
import { measuredSetup, move, ready } from './helpers';

/* The shared website definitions the Test screen reads, loaded the same way as the app build does (site-data.ts). */
vi.mock('virtual:site-data', async () => {
  const { loadSiteData } = await import('../site-data');
  return { default: loadSiteData(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')) };
});

const operator: Me = { name: 'Olga Operator', username: 'olga', kind: 'operator', kindName: 'Operator', mustChange: false, endDate: null, daysLeft: null, responsible: null, canRunMachine: true, why: '' };
const student: Me = { name: 'Sam Student', username: 'sam', kind: 'student', kindName: 'Student', mustChange: false, endDate: '2026-12-20', daysLeft: 36, responsible: null, canRunMachine: false, why: 'Choose your responsible operator first.' };
const studentReady: Me = { ...student, responsible: { name: 'Olga Operator', username: 'olga', by: 'gave access' }, canRunMachine: true, why: '' };
/* Enough of the bridge for these tests; anything else answers with an error. */
const bridge = (over: Partial<PeopleBridge> = {}): PeopleBridge => new Proxy(over as PeopleBridge, { get: (t, k) => (t as unknown as Record<string | symbol, unknown>)[k] ?? (async () => ({ error: 'not in this test' })) });
const access = (me: Me | null, browser = false) => { const a = new MachineAccess(browser ? null : new People(bridge())); a.set(me); return a; };

function rigWith(a: MachineAccess, journal: MemoryJournal | null = null) {
  const dev = new SimulatedDevice({ manualMotion: true, auto: false });
  let opened = 0;
  const c = new TestController({ openReal: () => { opened++; return dev; }, journal, commitEvery_ms: 0, machine: () => a.check() });
  return { dev, c, opened: () => opened };
}

describe('who may run the machine', () => {
  it('says why not: a browser, nobody signed in, a new password, a student without a responsible operator', () => {
    expect(access(null, true).check()).toEqual({ allowed: false, why: BROWSER_WHY, operator: null });
    expect(access(null).check()).toEqual({ allowed: false, why: 'Sign in to run the machine.', operator: null });
    expect(access({ ...operator, mustChange: true, canRunMachine: false, why: 'Choose your own password first.' }).check().why).toBe('Choose your own password first.');
    expect(access(student).check()).toMatchObject({ allowed: false, why: 'Choose your responsible operator first.' });
    expect(access(studentReady).check()).toEqual({ allowed: true, why: '', operator: { name: 'Sam Student', username: 'sam', kind: 'student', responsible: { name: 'Olga Operator', username: 'olga', confirmedBy: 'gave access' } } });
    expect(access(operator).check()).toEqual({ allowed: true, why: '', operator: { name: 'Olga Operator', username: 'olga', kind: 'operator' } });
  });
  it('does not open the USB connection or start a recording when not allowed', async () => {
    const a = access(null);
    const { c, opened } = rigWith(a);
    ready(c);
    await c.connect();
    expect(opened()).toBe(0);
    expect(c.message).toBe('Sign in to run the machine.');
    expect(c.startProblem).toBe('Sign in to run the machine.');
    a.set(student);
    await c.connect();
    expect(opened()).toBe(0);
    expect(c.message).toBe('Choose your responsible operator first.');
  });
  it('keeps who ran the test, and a student’s responsible operator, in the test file and on this computer', async () => {
    const a = access(studentReady), journal = new MemoryJournal();
    const { dev, c, opened } = rigWith(a, journal);
    ready(c);
    await c.connect();
    expect(opened()).toBe(1);
    c.useSetup(measuredSetup(c));
    await c.startRecording();
    /* signing out later does not change who ran this test */
    a.set(null);
    move(dev, c);
    dev.step(600);
    c.stopRecording();
    await c.flushed();
    const block = operatorBlockOf(studentReady);
    expect(c.sessionFile()!.operator).toEqual(block);
    const kept = await sessionFileFromJournal(journal, c.journalId!);
    expect(kept.operator).toEqual(block);
    expect(runByText(kept.operator)).toBe('Sam Student (student, sam)');
    expect(responsibleText(kept.operator)).toBe('Olga Operator (olga; gave access)');
    expect(runByText(undefined)).toBe('Not recorded');
  });
});

describe('the screens', () => {
  const render = (a: MachineAccess) => {
    const { c } = rigWith(a);
    return renderToStaticMarkup(createElement(App, { controller: c, serialAvailable: true, theme: 'light', account: null, onHelpSub: () => undefined, runTests: [],
      machine: { people: a.people, me: a.me, onSignIn: () => undefined, onMe: () => undefined } }));
  };
  it('the browser version says tests are run from the Windows app, and Connect is unavailable', () => {
    const html = render(access(null, true));
    expect(html).toContain(BROWSER_WHY.slice(0, 40));
    expect(html).toMatch(/<button type="button" class="primary" disabled="">Connect…<\/button>/);
  });
  it('signed out: a Sign in button and Connect unavailable; signed in: the name and Connect', () => {
    const out = render(access(null));
    expect(out).toContain('>Sign in</button>');
    expect(out).toMatch(/disabled="">Connect…/);
    const inside = render(access(operator));
    expect(inside).toContain('Running the machine: <strong>Olga Operator</strong> (operator)');
    expect(inside).toMatch(/<button type="button" class="primary">Connect…<\/button>/);
  });
  it('a student sees the Responsible operator choice and cannot connect yet', () => {
    const html = render(access(student));
    expect(html).toContain('Responsible operator');
    expect(html).toMatch(/disabled="">Connect…/);
  });
  it('the setup-file and calibration makers are for the admin only when people sign in, and not in a browser', () => {
    const { c } = rigWith(access(operator));
    const dev = (makers?: 'yes' | 'admin-only' | 'windows-app') => renderToStaticMarkup(createElement(Device, { controller: c, account: null, serialAvailable: true, makers }));
    expect(dev('admin-only')).toContain('Admin only. Sign in as the admin');
    expect(dev('admin-only')).not.toContain('Make a setup file');
    expect(dev('windows-app')).toContain('Made in the Windows app on the lab computer');
    expect(dev()).toContain('Make a setup file');
  });
});

describe('the usage log download', () => {
  it('is CSV with plain event names, and a name typed like a formula stays text', () => {
    const csv = usageCsv([
      { at: '2026-11-14T10:00:00.000Z', event: 'sign_in', by: null, person: 'sam' },
      { at: '2026-11-14T10:05:00.000Z', event: 'person_added', by: 'olga', person: '=HYPERLINK("x")', kind: 'student', endDate: '2026-12-20' },
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('Time,What,Signed in,Person,Details');
    expect(lines[1]).toBe('2026-11-14T10:00:00.000Z,Signed in,,sam,');
    expect(lines[2]).toContain(',"\'=HYPERLINK(""x"")",');
    expect(lines[2]).toContain('kind: student; endDate: 2026-12-20');
  });
  it('a refused call gives its plain-words reason', async () => {
    const p = new People(bridge({ list: async () => ({ error: 'Your access does not allow this.' }) }));
    await expect(p.list()).rejects.toThrow('Your access does not allow this.');
  });
});
