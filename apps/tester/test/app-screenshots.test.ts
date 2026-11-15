/* The pull-request pictures (scripts/app-screenshots.mjs) cover every screen that opens without a lab-server sign-in,
   by the app's own page ids, so a renamed or new screen is noticed here. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error plain JavaScript module without types
import { SCREENS, SIZES, SCHEMES } from '../../../scripts/app-screenshots.mjs';

/* The page ids, read from Shell.tsx's Page type (importing Shell needs the app build's virtual modules). */
const shell = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/Shell.tsx'), 'utf8');
const PAGES = [...(/^type Page = (.+);$/m.exec(shell)?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map((m) => m[1]!);

describe('pull-request screenshots', () => {
  it('picture every screen except those that need a lab-server sign-in', () => {
    const ids = (SCREENS as { id: string }[]).map((s) => s.id);
    const signInOnly = ['history', 'admin'];
    expect(PAGES.length).toBeGreaterThan(5);
    expect([...ids].sort()).toEqual(PAGES.filter((p) => !signInOnly.includes(p)).sort());
  });
  it('at laptop and phone widths, light and dark', () => {
    expect((SIZES as { width: number }[]).map((s) => s.width)).toEqual([1366, 390]);
    expect(SCHEMES).toEqual(['light', 'dark']);
  });
});

describe('spacing check on pull requests', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const wf = readFileSync(path.join(root, '.github/workflows/spacing.yml'), 'utf8');
  const script = readFileSync(path.join(root, 'scripts/check-spacing.mjs'), 'utf8');
  it('runs strictly on every pull request that changes the website or the app, at the five widths, light and dark', () => {
    expect(wf).toMatch(/^ {2}pull_request:\s*\n {4}branches: \[main\]/m);
    expect(wf).toContain('node scripts/check-spacing.mjs spacing-out --strict');
    expect(wf).toContain('npm run app:build');
    for (const p of ["'*.html'", "'*.js'", "'*.css'", "'css/**'", "'data/**'", "'apps/tester/**'", "'scripts/check-spacing.mjs'", "'scripts/app-screenshots.mjs'"]) expect(wf).toContain('      - ' + p);
    expect(script).toMatch(/\[1366, 1280, 1024, 768, 390\]/);
    expect(script).toMatch(/'light', 'dark'/);
  });
  it('covers every website page (read from the folder) and every pictured app screen (the same list and stand-in as the screenshots)', () => {
    expect(script).toContain("fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))");
    expect(script).toContain("import { SCREENS, standIn } from './app-screenshots.mjs';");
    expect(readFileSync(path.join(root, '.gitignore'), 'utf8')).toMatch(/^spacing-out\/$/m);
  });
});
