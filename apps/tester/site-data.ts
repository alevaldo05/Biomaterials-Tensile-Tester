/* Content shared with the website. The website keeps its definitions and materials in plain script files
   (data/terms.js, data/materials.js). This reads them when the app is built and hands them to the app as
   "virtual:site-data", so a change to one of those files reaches the website and the app together.
   Both files are on the list of shared website files (scripts/shared-files.js), which refuses any file not listed. */
import path from 'node:path';
import vm from 'node:vm';
import type { Plugin } from 'vite';
import { sharedFiles } from './build-info';

/** The website files read here. Each must also be in scripts/shared-files.js (a test checks this). */
export const SITE_DATA_FILES = ['data/terms.js', 'data/materials.js'];

export interface SiteTerm { name: string; def: string; eq: string; unit: string }
export interface SiteMaterial { id: string; name: string; family: string }
export interface SiteData { terms: Record<string, SiteTerm>; materials: SiteMaterial[] }

/** Runs the website's data files in a sandbox and returns plain data. Throws if a file is missing or malformed. */
export function loadSiteData(root: string): SiteData {
  const sandbox: Record<string, unknown> = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  const shared = sharedFiles(root);
  for (const f of SITE_DATA_FILES) vm.runInContext(shared.readShared(f, root), sandbox, { filename: f });
  const terms = sandbox.TERMS as Record<string, SiteTerm> | undefined, mats = sandbox.MATERIALS as { id: string; name: string; family: string }[] | undefined;
  if (!terms || !Array.isArray(mats)) throw new Error('data/terms.js or data/materials.js did not define TERMS and MATERIALS.');
  const plain = (s: string) => String(s ?? '').replace(/<[^>]*>/g, '');
  const outTerms: Record<string, SiteTerm> = {};
  for (const [k, t] of Object.entries(terms)) outTerms[k] = { name: plain(t.name), def: plain(t.def), eq: plain(t.eq), unit: plain(t.unit) };
  return { terms: outTerms, materials: mats.map((m) => ({ id: m.id, name: plain(m.name), family: m.family })) };
}

export function siteData(root: string): Plugin {
  const id = 'virtual:site-data', resolved = '\0' + id;
  return {
    name: 'site-data',
    resolveId: (s) => (s === id ? resolved : null),
    load(s) {
      if (s !== resolved) return null;
      for (const f of SITE_DATA_FILES) this.addWatchFile(path.join(root, f));
      return 'export default ' + JSON.stringify(loadSiteData(root)) + ';';
    },
  };
}
