/* The build stamp. When the app is built, this gives it:
   - __APP_VERSION__: the version from apps/desktop/package.json (the one place the app's version is written);
   - "virtual:build-info": { appVersion, commit, sharedFilesHash, buildNumber }, shown on the Help screen as
     "Version <v> · built from <commit> · shared website files <first 12 of the hash>". buildNumber is the Windows app
     workflow's run number (GITHUB_RUN_NUMBER, 0 for a local build); release tags are app-v<version>-run.<N>.
   The hash covers the website files the app shares (the list and the hash are in scripts/shared-files.js), so an
   installed copy can be compared with the current website files: `node scripts/shared-files.js`.
   Nothing here can fail the build: without Git or GITHUB_SHA the commit is "unknown". */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Plugin } from 'vite';

export interface BuildInfo { appVersion: string; commit: string; sharedFilesHash: string; buildNumber: number }

/** scripts/shared-files.js (plain Node, CommonJS), loaded with Node's own require. */
export interface SharedFiles {
  ROOT: string;
  SHARED_FILES: string[];
  normalize(text: string): string;
  readShared(rel: string, root?: string): string;
  sharedFilesHash(root?: string): string;
  shortHash(hash: string): string;
}
export function sharedFiles(root: string): SharedFiles {
  return createRequire(path.join(root, 'package.json'))(path.join(root, 'scripts', 'shared-files.js')) as SharedFiles;
}

/** The app's version: apps/desktop/package.json, the version the Windows installer carries. */
export function appVersion(root: string): string {
  const v = (JSON.parse(fs.readFileSync(path.join(root, 'apps/desktop/package.json'), 'utf8')) as { version?: unknown }).version;
  if (typeof v !== 'string' || !v) throw new Error('apps/desktop/package.json has no version.');
  return v;
}

/** The commit the build came from, 12 characters: GITHUB_SHA on GitHub, else Git, else "unknown". A local build from
    files that differ from that commit (changed or not yet committed) ends in "-changed", so it is not mistaken for it. */
/** Runs git in the project folder and returns its output; tests pass a stand-in (the test image has no git). */
export type GitRunner = (args: string[], cwd: string) => string;
const runGit: GitRunner = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 });

export function commitId(root: string, env: Record<string, string | undefined> = process.env, git: GitRunner = runGit): string {
  const hex = (s: string | undefined) => (s && /^[0-9a-f]{7,40}$/i.test(s.trim()) ? s.trim().slice(0, 12).toLowerCase() : null);
  const fromEnv = hex(env.GITHUB_SHA);
  if (fromEnv) return fromEnv;
  try {
    const head = hex(git(['rev-parse', '--short=12', 'HEAD'], root));
    if (!head) return 'unknown';
    const dirty = git(['status', '--porcelain', '--untracked-files=normal'], root).trim() !== '';
    return dirty ? head + '-changed' : head;
  } catch {
    return 'unknown';
  }
}

/** The workflow run number (GITHUB_RUN_NUMBER), or 0 when built anywhere else. */
export function buildNumber(env: Record<string, string | undefined> = process.env): number {
  const s = (env.GITHUB_RUN_NUMBER ?? '').trim();
  return /^[1-9]\d{0,8}$/.test(s) ? Number(s) : 0;
}

export function buildInfo(root: string): Plugin {
  const id = 'virtual:build-info', resolved = '\0' + id;
  return {
    name: 'build-info',
    config: () => ({ define: { __APP_VERSION__: JSON.stringify(appVersion(root)) } }),
    resolveId: (s) => (s === id ? resolved : null),
    load(s) {
      if (s !== resolved) return null;
      const shared = sharedFiles(root);
      this.addWatchFile(path.join(root, 'apps/desktop/package.json'));
      for (const f of shared.SHARED_FILES) this.addWatchFile(path.join(root, f));
      const info: BuildInfo = { appVersion: appVersion(root), commit: commitId(root), sharedFilesHash: shared.sharedFilesHash(root), buildNumber: buildNumber() };
      return 'export default ' + JSON.stringify(info) + ';';
    },
  };
}
