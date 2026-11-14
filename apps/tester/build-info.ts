/* The build stamp. When the app is built, this gives it:
   - __APP_VERSION__: the version from apps/desktop/package.json (the one place the app's version is written);
   - "virtual:build-info": { appVersion, commit, sharedFilesHash }, shown on the Help screen as
     "Version <v> · built from <commit> · shared website files <first 12 of the hash>".
   The hash covers the website files the app shares (the list and the hash are in scripts/shared-files.js), so an
   installed copy can be compared with the current website files: `node scripts/shared-files.js`.
   Nothing here can fail the build: without Git or GITHUB_SHA the commit is "unknown". */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Plugin } from 'vite';

export interface BuildInfo { appVersion: string; commit: string; sharedFilesHash: string }

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

/** The commit the build came from, 12 characters: GITHUB_SHA on GitHub, else Git, else "unknown". */
export function commitId(root: string, env: Record<string, string | undefined> = process.env): string {
  const hex = (s: string | undefined) => (s && /^[0-9a-f]{7,40}$/i.test(s.trim()) ? s.trim().slice(0, 12).toLowerCase() : null);
  const fromEnv = hex(env.GITHUB_SHA);
  if (fromEnv) return fromEnv;
  try {
    return hex(execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10000 })) ?? 'unknown';
  } catch {
    return 'unknown';
  }
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
      const info: BuildInfo = { appVersion: appVersion(root), commit: commitId(root), sharedFilesHash: shared.sharedFilesHash(root) };
      return 'export default ' + JSON.stringify(info) + ';';
    },
  };
}
