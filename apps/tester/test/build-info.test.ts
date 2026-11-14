/* The app's version and build stamp: one version (apps/desktop/package.json) everywhere the app shows or saves it,
   and the Help line "Version <v> · built from <commit> · shared website files <hash>". */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import info from 'virtual:build-info';
import { appVersion, commitId, sharedFiles } from '../build-info';
import { APP_VERSION } from '../src/controller';
import { HelpPage } from '../src/pages/HelpPage';
import { versionLine } from '../src/version';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const desktop = JSON.parse(readFileSync(path.join(ROOT, 'apps/desktop/package.json'), 'utf8')) as { version: string };

describe('app version', () => {
  it('is the version in apps/desktop/package.json, in the app, the build stamp, and the Help line', () => {
    expect(desktop.version).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/);
    expect(appVersion(ROOT)).toBe(desktop.version);
    expect(APP_VERSION).toBe(desktop.version);
    expect(info.appVersion).toBe(desktop.version);
    expect(versionLine()).toBe('Version ' + desktop.version + ' · built from ' + info.commit + ' · shared website files ' + info.sharedFilesHash.slice(0, 12));
  });
  it('is not written in controller.ts', () => {
    const src = readFileSync(path.join(ROOT, 'apps/tester/src/controller.ts'), 'utf8');
    expect(src).toContain('export const APP_VERSION: string = __APP_VERSION__;');
    expect(src).not.toMatch(/['"`]v?\d+\.\d+\.\d+/);
  });
  it('is the one the desktop lockfile carries at its top', () => {
    const lock = JSON.parse(readFileSync(path.join(ROOT, 'apps/desktop/package-lock.json'), 'utf8')) as { version: string; packages: Record<string, { version: string }> };
    expect(lock.version).toBe(desktop.version);
    expect(lock.packages['']?.version).toBe(desktop.version);
  });
});

describe('build stamp', () => {
  it('hashes the shared website files and names a commit', () => {
    expect(info.sharedFilesHash).toBe(sharedFiles(ROOT).sharedFilesHash(ROOT));
    expect(info.sharedFilesHash).toMatch(/^[0-9a-f]{64}$/);
    expect(info.commit).toMatch(/^([0-9a-f]{7,12}|unknown)$/);
  });
  it('takes the commit from GITHUB_SHA (12 characters), else Git, else "unknown", and never fails', () => {
    expect(commitId(ROOT, { GITHUB_SHA: '0123456789ABCDEF0123456789abcdef01234567' })).toBe('0123456789ab');
    expect(commitId(ROOT, { GITHUB_SHA: 'not a sha' })).toMatch(/^([0-9a-f]{7,12}|unknown)$/);
    expect(commitId(path.join(ROOT, '..', 'no-such-folder-' + Date.now()), {})).toBe('unknown');
  });
  it('is shown on the Help screen', () => {
    const html = renderToStaticMarkup(createElement(HelpPage));
    expect(html).toContain('class="hint version-line"');
    expect(html).toContain(versionLine().replace(/&/g, '&amp;'));
  });
});
