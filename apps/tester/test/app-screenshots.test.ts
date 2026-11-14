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
