/* The app's version and build stamp: one version (apps/desktop/package.json) everywhere the app shows or saves it,
   and the Help line "Version <v> · built from <commit> · shared website files <hash>". */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import info from 'virtual:build-info';
import { appVersion, buildNumber, commitId, sharedFiles } from '../build-info';
import { APP_VERSION } from '../src/controller';
import { HelpPage } from '../src/pages/HelpPage';
import { homeVersion, shortVersion, versionLine } from '../src/version';
import { Home } from '../src/pages/Home';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const desktop = JSON.parse(readFileSync(path.join(ROOT, 'apps/desktop/package.json'), 'utf8')) as { version: string };
/* The sources of a Dockerfile's COPY lines (every word but the first and the destination). Lines may end in CRLF on a
   Windows checkout; the destination must still be left out. */
const copySources = (build: string) => build.split(/\r?\n/).filter((l) => /^COPY\s/.test(l)).flatMap((l) => l.trim().split(/\s+/).slice(1, -1))
  .map((p) => p.replace(/^\.\//, '').replace(/\/$/, ''));

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
    expect(info.commit).toMatch(/^([0-9a-f]{7,12}(-changed)?|unknown)$/);
  });
  it('takes the commit from GITHUB_SHA (12 characters), else Git, else "unknown", and never fails', () => {
    expect(commitId(ROOT, { GITHUB_SHA: '0123456789ABCDEF0123456789abcdef01234567' })).toBe('0123456789ab');
    expect(commitId(ROOT, { GITHUB_SHA: 'not a sha' })).toMatch(/^([0-9a-f]{7,12}(-changed)?|unknown)$/);
    expect(commitId(path.join(ROOT, '..', 'no-such-folder-' + Date.now()), {})).toBe('unknown');
  });
  it('takes the build number from GITHUB_RUN_NUMBER, else 0', () => {
    expect(Number.isInteger(info.buildNumber) && info.buildNumber >= 0).toBe(true);
    expect(buildNumber({ GITHUB_RUN_NUMBER: '17' })).toBe(17);
    for (const bad of [undefined, '', '0', '-3', '1.5', 'abc', '12345678901']) expect(buildNumber({ GITHUB_RUN_NUMBER: bad }), String(bad)).toBe(0);
  });
  it('marks a local build made from changed files, and not a clean one', () => {
    /* A stand-in for git (the test image has none): the commit, and what `git status --porcelain` prints. */
    const fakeGit = (status: string) => (args: string[]) => (args[0] === 'rev-parse' ? '0123456789abcdef\n' : status);
    expect(commitId('/project', {}, fakeGit(''))).toBe('0123456789ab');
    expect(commitId('/project', {}, fakeGit(' M apps/tester/src/App.tsx\n'))).toBe('0123456789ab-changed');
    expect(commitId('/project', {}, fakeGit('?? notes.txt\n'))).toBe('0123456789ab-changed');
    /* GitHub builds are clean checkouts named by GITHUB_SHA; git is not asked */
    expect(commitId('/project', { GITHUB_SHA: 'fedcba9876543210fedcba9876543210fedcba98' }, () => { throw new Error('git asked'); })).toBe('fedcba987654');
    /* no git, or not a repository: unknown, never a failure */
    expect(commitId('/project', {}, () => { throw new Error('spawnSync git ENOENT'); })).toBe('unknown');
  });
  it('treats an empty GITHUB_SHA (a local image build) as unset', () => {
    expect(commitId(ROOT, { GITHUB_SHA: '' })).toMatch(/^([0-9a-f]{7,12}(-changed)?|unknown)$/);
    expect(commitId(path.join(ROOT, '..', 'no-such-folder-' + Date.now()), { GITHUB_SHA: '' })).toBe('unknown');
  });
  it('is stamped inside the app image: the Dockerfile copies every file the build stamp reads and takes GITHUB_SHA', () => {
    const docker = readFileSync(path.join(ROOT, 'deploy/app/Dockerfile'), 'utf8');
    const build = docker.split(/^FROM /m)[1] ?? '';
    const sources = copySources(build);
    const covered = (file: string) => sources.some((p) => p === file || (p === '*.js' && !file.includes('/')) || file.startsWith(p + '/'));
    expect(covered('scripts/shared-files.js')).toBe(true);
    expect(covered('apps/desktop/package.json')).toBe(true);
    expect(covered('data/terms.js')).toBe(true);
    for (const f of sharedFiles(ROOT).SHARED_FILES) expect(covered(f), f + ' is not copied into the app image build').toBe(true);
    expect(build).toMatch(/^ARG GITHUB_SHA\s*$/m);
    expect(build.indexOf('ARG GITHUB_SHA')).toBeLessThan(build.indexOf('npm run build'));
    expect(readFileSync(path.join(ROOT, 'deploy/compose.yml'), 'utf8')).toContain('GITHUB_SHA: "${GITHUB_SHA:-}"');
    expect(readFileSync(path.join(ROOT, '.dockerignore'), 'utf8')).not.toMatch(/^\*\.js|^scripts|^data/m);
  });
  it('reads the Dockerfile the same with Windows line endings (CRLF), as on the Windows runner', () => {
    const lf = (readFileSync(path.join(ROOT, 'deploy/app/Dockerfile'), 'utf8').split(/^FROM /m)[1] ?? '').replace(/\r\n/g, '\n');
    const crlf = lf.replace(/\n/g, '\r\n');
    expect(copySources(crlf)).toEqual(copySources(lf));
    /* a destination (the last word of a COPY line) is never taken for a source */
    expect(copySources('COPY a b ./dest/\r\nCOPY c ./\r\n')).toEqual(['a', 'b', 'c']);
  });
  it('is a simple 0.x number (0.3, 0.4, …), shown short and marked beta at the very bottom of Home', () => {
    expect(desktop.version).toMatch(/^0\.\d+\.0$/);
    expect(shortVersion('0.3.0')).toBe('0.3');
    expect(shortVersion('0.12.0')).toBe('0.12');
    expect(shortVersion('0.3.1')).toBe('0.3.1');
    expect(shortVersion('1.0.0-beta.2')).toBe('1.0.0-beta.2');
    expect(homeVersion()).toBe('Version ' + shortVersion(desktop.version) + ' (beta)');
    const html = renderToStaticMarkup(createElement(Home, { go: () => undefined, recent: [], interrupted: [], recover: () => undefined, recording: false, device: { state: 'Not connected', detail: '', calibration: 'Not checked' } }));
    expect(html).toMatch(new RegExp('<p class="hint home-version">' + homeVersion().replace(/[.()]/g, '\\$&') + '</p></main>$'));
  });
  it('is shown on the Help screen', () => {
    const html = renderToStaticMarkup(createElement(HelpPage));
    expect(html).toContain('class="hint version-line"');
    expect(html).toContain(versionLine().replace(/&/g, '&amp;'));
  });
});
