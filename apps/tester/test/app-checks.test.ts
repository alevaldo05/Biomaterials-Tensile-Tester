/* Checks on the app's pieces that are not the recording itself: help text, recent tests and recovery,
   method stores, and the exports. */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HELP, helpFor, searchHelp } from '../src/help-text';
import { recentRows } from '../src/pages/Home';
import { sessionFileFromJournal } from '../src/controller';
import { openTestFile } from '../src/load';
import { testCsv, xlsxForRecord } from '../src/exports';
import { MemoryJournal } from '../src/storage/journal';
import type { JournalMeta } from '../src/storage/journal';
import { LabMethods, MemoryMethods, methodFromSetup, setupFromMethod } from '../src/storage/methods';
import type { TestMethod } from '../src/storage/methods';
import type { SessionRow } from '../src/lab-api';
import { EMPTY_SETUP } from '../src/setup';
import { measuredSetup, move, ready, rig } from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(here, '../../..');

describe('help text', () => {
  const PAGES = ['home', 'load', 'methods', 'device', 'history', 'help', 'settings', 'admin'];
  const STEPS = [...new Set([...readFileSync(path.join(here, '../src/App.tsx'), 'utf8').matchAll(/id: '([a-z]+)'/g)].map((m) => m[1] as string))];
  it('has help for every screen and every setup step, recording, and after a test', () => {
    for (const p of PAGES) expect(HELP[p], p).toBeTruthy();
    expect(STEPS.length).toBeGreaterThanOrEqual(5);
    for (const s of [...STEPS, 'recording', 'done']) expect(HELP['test.' + s], 'test.' + s).toBeTruthy();
    expect(helpFor('test', 'dimensions')).toBe(HELP['test.dimensions']);
    expect(helpFor('nowhere')).toBe(HELP.home);
  });
  it('every entry says what the screen is for and what to do next', () => {
    for (const [k, t] of Object.entries(HELP)) {
      expect(t.title.trim(), k).not.toBe('');
      expect(t.what.length, k).toBeGreaterThan(20);
      expect(t.next.length, k).toBeGreaterThan(0);
    }
  });
  it('every website link points to a page that exists', () => {
    const links = Object.values(HELP).flatMap((t) => t.links ?? []);
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(existsSync(path.join(ROOT, l.page.split('#')[0] as string)), l.page).toBe(true);
  });
  it('never calls anything an emergency stop, and never says the app moves the machine', () => {
    const text = JSON.stringify(HELP).toLowerCase();
    /* Only ever as a denial ("not an emergency stop"). */
    expect(text.replace(/not an emergency stop/g, '')).not.toContain('emergency stop');
    expect(text).not.toMatch(/app (moves|stops|starts) the (machine|tester|crosshead)/);
  });
  it('search finds entries by words in them', () => {
    expect(searchHelp('baseline').length).toBeGreaterThan(0);
    expect(searchHelp('zzzz-nothing')).toEqual([]);
  });
});

describe('recent tests and recovery', () => {
  const meta = (id: string, o: Partial<JournalMeta> = {}): JournalMeta => ({
    id, status: 'complete', test: 'uniaxial', setup: { ...EMPTY_SETUP, specimenId: 'S-' + id }, profile: null, calibrations: [], appVersion: 'x', deviceId: 'd',
    startedAt: '2026-01-0' + id + 'T10:00:00Z', lastCommitAt: '', endedAt: '2026-01-0' + id + 'T10:05:00Z', endReason: '', sampleCount: 10, ...o });
  const lab = (id: string, savedAt: string): SessionRow => ({ id, owner: 'a', testType: 'relaxation', recordedFrom: 'real', data: 'Measured', material: '', specimenId: 'L-' + id,
    deviceId: '', deviceType: '', deviceSoftware: '', appVersion: '', calibrationIds: [], sampleCount: 5, startedAt: null, savedAt, summary: {}, notes: '' });
  it('merges this computer and the lab server, newest first, at most 8, and leaves out unfinished recordings', () => {
    const opened: string[] = [];
    const rows = recentRows([meta('1'), meta('3', { status: 'interrupted' }), meta('5', { status: 'recording' })], [lab('9', '2026-01-02T00:00:00Z')], (id) => opened.push('l' + id), (id) => opened.push('r' + id));
    expect(rows.map((r) => r.specimen)).toEqual(['S-3', 'L-9', 'S-1']);
    expect(rows[0]!.saved).toContain('(interrupted)');
    expect(rows.map((r) => r.stored)).toEqual(['This computer', 'Lab server', 'This computer']);
    rows[1]!.open(); rows[0]!.open();
    expect(opened).toEqual(['r9', 'l3']);
    const many = recentRows(Array.from({ length: 12 }, (_, i) => meta(String(i % 9 + 1))), [], () => undefined, () => undefined);
    expect(many).toHaveLength(8);
  });
  it('a removed recording cannot be rebuilt, and says so', async () => {
    const j = new MemoryJournal();
    await j.begin({ id: 'gone', test: 'uniaxial', setup: EMPTY_SETUP, profile: null, calibrations: [], appVersion: 'x', deviceId: 'd', startedAt: '2026-01-01T00:00:00Z' }, { lines: [], receivedAt_ms: [] });
    await j.remove('gone');
    expect(await j.list()).toEqual([]);
    await expect(sessionFileFromJournal(j, 'gone')).rejects.toThrow('no longer on this computer');
  });
  it('a recording with no samples yet still rebuilds to a file that says it has no data', async () => {
    const j = new MemoryJournal();
    const { c } = rig({ journal: j });
    ready(c);
    await c.connect();
    c.useSetup(measuredSetup(c));
    await c.startRecording();
    await c.flushed();
    const [m] = await j.list();
    const f = await sessionFileFromJournal(j, m!.id);
    expect(f.lines.some((l) => l.includes('"type":"hello"'))).toBe(true);
    expect(f.lines.some((l) => l.includes('"type":"sample"'))).toBe(false);
    const loaded = await openTestFile('empty.session.json', JSON.stringify(f));
    expect(loaded.record).toBeNull();
  });
});

describe('method stores', () => {
  const setup = { ...EMPTY_SETUP, material: 'Skin', specimenId: 'S-1', notes: 'n', speed: '30' };
  it('a method never keeps the specimen ID or notes, and a setup from it starts them blank', () => {
    const m = methodFromSetup('  Skin  ', 'uniaxial', setup);
    expect(m.name).toBe('Skin');
    expect(m.fields).not.toHaveProperty('specimenId');
    expect(m.fields).not.toHaveProperty('notes');
    const s = setupFromMethod({ ...m, id: 'x', revision: 1, archived: false, createdAt: '' });
    expect(s).toMatchObject({ material: 'Skin', speed: '30', specimenId: '', notes: '' });
  });
  it('archiving hides a method; an empty name is refused', async () => {
    const store = new MemoryMethods();
    const m = await store.save(methodFromSetup('A', 'uniaxial', setup));
    await store.archive(m.id);
    expect(await store.list()).toEqual([]);
    await expect(store.save(methodFromSetup(' ', 'uniaxial', setup))).rejects.toThrow('name');
  });
  it('lab methods go through the lab server, which decides who may change them', async () => {
    const calls: string[] = [];
    const lab = new LabMethods({
      methods: async () => { calls.push('list'); return []; },
      saveMethod: async (m, r) => { calls.push('save ' + m.name + (r ? ' after ' + r.revision : '')); return { ...m, id: 'lm-1', revision: r ? r.revision + 1 : 1, archived: false, createdAt: '' } as TestMethod; },
      archiveMethod: async (k) => { calls.push('archive ' + k); },
    });
    await lab.list();
    const m = await lab.save(methodFromSetup('Lab A', 'uniaxial', setup));
    await lab.save(methodFromSetup('Lab A', 'uniaxial', setup), m);
    await lab.archive('lm-1');
    await expect(lab.save(methodFromSetup('', 'uniaxial', setup))).rejects.toThrow('name');
    expect(calls).toEqual(['list', 'save Lab A', 'save Lab A after 1', 'archive lm-1']);
  });
});

describe('exports', () => {
  it('the CSV and the Excel file carry the recorded test, labeled measured', async () => {
    const { dev, c } = rig();
    ready(c);
    c.setup.specimenId = 'S-7';
    await c.connect();
    c.useSetup(measuredSetup(c));
    await c.startRecording();
    move(dev, c);
    dev.step(1200);
    c.stopRecording();
    const csv = testCsv(c)!;
    expect(csv).toMatch(/# Source,measured/i);
    expect(csv).toContain('S-7');
    const back = await openTestFile('t.csv', csv);
    expect(back.record!.x.length).toBe(c.record!.x.length);
    const x = c.record!.x, b = back.record!.x;
    for (const i of [0, Math.floor(x.length / 2), x.length - 1]) expect(b[i]).toBeCloseTo(x[i] as number, 5);
    const xlsx = xlsxForRecord(c.record!, 'uniaxial', 't', 'Recorded by this app');
    const text = Buffer.from(xlsx).toString('latin1');
    expect(text.startsWith('PK')).toBe(true);
    expect(text).toContain('xl/worksheets/');
  });
});

describe('keyboard and focus (source checks; the Tab walk-through was done in Chromium)', () => {
  const src = (f: string) => readFileSync(path.join(here, '../src', f), 'utf8');
  it('has a skip link that goes to the main part, and moves focus there when the screen changes', () => {
    const shell = src('Shell.tsx');
    expect(shell).toContain('className="skip-link" href="#main-content"');
    expect(shell).toContain('export function focusMain');
    expect(shell).toMatch(/PAGE_TITLES\[page\] \+ ' · Biomaterials Tensile Tester'/);
  });
  it('keeps a closed Setup drawer out of the Tab order and closes it with Esc, sending nothing to any device', () => {
    const app = src('App.tsx');
    expect(app).toContain('inert={narrow && !drawer}');
    expect(app).toMatch(/e\.key === 'Escape'\) setDrawer\(false\)/);
    expect(app).not.toMatch(/Escape[^\n]*(stopRecording|STOP|sendStop)/);
  });
  it('turns animation and smooth scrolling off for everyone who asks for reduced motion', () => {
    const css = src('app.css');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{[^}]*animation-duration: 0\.01ms !important[^}]*transition-duration: 0\.01ms !important/);
  });
});

describe('menu and required fields (source checks; the required-field name was checked in Chromium)', () => {
  const src = (f: string) => readFileSync(path.join(here, '../src', f), 'utf8');
  it('moves focus into the Save data menu, closes it with Esc, and gives focus back to the button', () => {
    const app = src('App.tsx');
    expect(app).toContain('ref={saveMenu} onKeyDown={onMenuKey}');
    expect(app).toMatch(/e\.key === 'Escape'\) \{[^}]*setSaveOpen\(false\); saveButton\.current\?\.focus\(\)/);
    expect(app).toContain("querySelector<HTMLElement>('[role=\"menuitem\"]')?.focus()");
    expect(app).toContain('aria-haspopup="menu"');
  });
  it('says "(required)" to screen readers while the red asterisk stays hidden from them', () => {
    const parts = readFileSync(path.join(ROOT, 'packages/ui/src/parts.tsx'), 'utf8');
    expect(parts).toContain('<span aria-hidden="true"> *</span><span className="sr-only"> (required)</span>');
    expect(src('app.css')).toMatch(/\.sr-only \{[^}]*clip: rect\(0 0 0 0\)/);
  });
});

describe('control borders', () => {
  const css = readFileSync(path.join(here, '../src/app.css'), 'utf8');
  const channel = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255); };
  const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number]; return (hi + 0.05) / (lo + 0.05); };
  const tokens = (block: string) => Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]])) as Record<string, string>;
  const light = tokens(css.slice(css.indexOf(':root {'), css.indexOf(':root[data-theme="dark"]')));
  const dark = tokens(css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf('* { box-sizing')));
  it('draws the borders of buttons, boxes and dropdowns at least 3:1 against the page, surface, and panel in both themes', () => {
    for (const [name, t] of [['light', light], ['dark', dark]] as const) {
      expect(t['control-line'], name).toBeDefined();
      for (const bg of ['bg', 'surface', 'panel'] as const) expect(ratio(t['control-line'] as string, t[bg] as string), name + ' vs ' + bg).toBeGreaterThanOrEqual(3);
    }
  });
  it('uses that border on buttons, text boxes, selects, and the password box', () => {
    for (const sel of ['button {', 'input[type="text"], select, input[type="file"], textarea {', 'input[type="password"] {']) {
      const line = css.split('\n').find((l) => l.startsWith(sel)) ?? '';
      expect(line, sel).toContain('border: 1px solid var(--control-line)');
    }
  });
});

describe('status page', () => {
  it('names only files and folders that exist', () => {
    const text = readFileSync(path.join(ROOT, 'docs/app/FEATURE-STATUS.md'), 'utf8');
    const named = [...text.matchAll(/`([^`\s]+)`/g)].map((m) => m[1] as string)
      .filter((t) => /\//.test(t) && !/[*<>{}$|]|\.\.\.|^https?:|^npm |^\/api|^api\//.test(t) && /(\.[a-z0-9]{1,5}|\/)$/i.test(t));
    expect(named.length).toBeGreaterThan(5);
    const missing = named.filter((t) => !existsSync(path.join(ROOT, t)) && !existsSync(path.join(ROOT, 'docs/app', t)));
    expect(missing).toEqual([]);
  });
});

describe('no board names in app code', () => {
  /* The app never branches on the board: device_type is free text. Comments may name boards as examples
     (packages/protocol/src/messages.ts and two acquisition files do), so comments are removed before checking. */
  const BOARDS = /esp32|esp-32|rp2040|pico|arduino|atmega|stm32|teensy/i;
  const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(ts|tsx|js|jsx|css|html)$/.test(e.name) ? [p] : [];
  });
  const roots = [path.join(ROOT, 'apps/tester/src'), ...readdirSync(path.join(ROOT, 'packages')).map((n) => path.join(ROOT, 'packages', n, 'src')).filter((d) => existsSync(d))];
  it('has no board name in the code of the app or the shared packages', () => {
    const found: string[] = [];
    for (const f of roots.flatMap(files)) {
      const code = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
      if (BOARDS.test(code)) found.push(path.relative(ROOT, f));
    }
    expect(found).toEqual([]);
  });
  it('finds the source folders it checks', () => {
    expect(roots.length).toBeGreaterThan(3);
    expect(roots.flatMap(files).length).toBeGreaterThan(20);
  });
});
