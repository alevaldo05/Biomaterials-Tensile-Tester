/* The website files the app shares are listed once, in scripts/shared-files.js. These checks fail when the app's
   build (apps/tester/site-data.ts, build-info.ts, vite.config.ts) or the reference tests of the website's
   calculations (packages/core/reference) read a website file that is not on that list, so the build stamp on the
   Help screen always covers every website file the app depends on. Two ways, so one catches what the other misses:
   - a scan of their source for text that names a website file or folder (a path that exists at the top of the
     project, outside the app's own folders);
   - a run of the loaders with every file read recorded. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const shared = createRequire(import.meta.url)(path.join(ROOT, 'scripts/shared-files.js'));
const { SHARED_FILES } = shared;

/* Not website files: the app's folders, the scripts and documents, and the workspace files. */
const NOT_WEBSITE = /^(packages|apps|firmware|deploy|scripts|docs|node_modules|\.git|\.github)(\/|$)|^(package(-lock)?\.json|tsconfig(\.[a-z]+)?\.json|vitest\.config\.mjs)$/;

/** Every string in the source that names a website file or folder. One pass from left to right takes comments and
    strings in turn, so a quote inside a comment, or // inside a string, does not throw the reading off. The fixed
    parts of a template (around each ${...}) are read as separate strings, so `data/${name}.js` names the folder data/. */
function websitePathsIn(source) {
  const found = new Set();
  const pieces = [];
  for (const m of source.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
    if (m[1] !== undefined || m[2] !== undefined) pieces.push(m[1] ?? m[2]);
    else if (m[3] !== undefined) pieces.push(...m[3].split(/\$\{[^}]*\}/).map((p) => p.replace(/^\/+/, '')));
  }
  for (const piece of pieces) {
    const text = piece.trim().replace(/^\.\//, '').replace(/\/+$/, '');
    if (!text || /[\s:*?<>|\\]/.test(text) || text.startsWith('/')) continue;
    const abs = path.resolve(ROOT, text), rel = path.relative(ROOT, abs).split(path.sep).join('/');
    if (!rel || rel.startsWith('..') || NOT_WEBSITE.test(rel) || !fs.existsSync(abs)) continue;
    found.add(fs.statSync(abs).isDirectory() ? rel + '/' : rel);
  }
  return [...found];
}

const READERS = [
  'apps/tester/site-data.ts', 'apps/tester/build-info.ts', 'apps/tester/vite.config.ts',
  ...fs.readdirSync(path.join(ROOT, 'packages/core/reference')).filter((f) => /\.(mjs|js|ts)$/.test(f)).map((f) => 'packages/core/reference/' + f),
];

describe('the list of shared website files', () => {
  it('names files that exist, once each, as paths from the top of the project', () => {
    expect(SHARED_FILES.length).toBeGreaterThanOrEqual(9);
    expect(new Set(SHARED_FILES).size).toBe(SHARED_FILES.length);
    for (const f of SHARED_FILES) {
      expect(f, f).toMatch(/^[a-z0-9][\w./-]*$/i);
      expect(NOT_WEBSITE.test(f), f).toBe(false);
      expect(fs.statSync(path.join(ROOT, f)).isFile(), f).toBe(true);
    }
  });

  it('covers every website file or folder the app build and the reference tests name in their source', () => {
    const extra = [];
    for (const r of READERS) for (const p of websitePathsIn(fs.readFileSync(path.join(ROOT, r), 'utf8'))) if (!SHARED_FILES.includes(p)) extra.push(r + ': ' + p);
    expect(extra).toEqual([]);
    /* and every listed file is named by at least one of them (no stale entries) */
    const named = new Set(READERS.flatMap((r) => websitePathsIn(fs.readFileSync(path.join(ROOT, r), 'utf8'))));
    expect(SHARED_FILES.filter((f) => !named.has(f))).toEqual([]);
  });

  it('the scan would catch a new website file (negative check)', () => {
    const site = fs.readFileSync(path.join(ROOT, 'apps/tester/site-data.ts'), 'utf8');
    expect(site).toContain("'data/materials.js'");
    const changed = site.replace("'data/materials.js'", "'data/materials.js', 'data/references.js'");
    expect(websitePathsIn(changed)).toContain('data/references.js');
    expect(websitePathsIn("fs.readFileSync(path.join(ROOT, \"./graph.js\"), 'utf8')")).toEqual(['graph.js']);
    expect(websitePathsIn('const f = `ui.js`;')).toEqual(['ui.js']);
    /* a quote in a comment does not hide the path after it; a path only in a comment is not a read */
    expect(websitePathsIn("// the app's file\nread('data/references.js'); /* 'graph.js' */")).toEqual(['data/references.js']);
    /* a path built from a website folder is caught as the folder */
    expect(websitePathsIn("read('data/' + name + '.js')")).toEqual(['data/']);
    expect(websitePathsIn('read(`${ROOT}/data/${name}.js`)')).toEqual(['data/']);
    /* not website files: the app's own folders, Node modules, and text that is not a path */
    expect(websitePathsIn("'apps/desktop/package.json' 'node:fs' 'scripts/shared-files.js' 'var G0 = 9.80665;' '../../..'")).toEqual([]);
  });
});

describe('reading shared files', () => {
  afterEach(() => vi.restoreAllMocks());

  it('refuses a website file that is not on the list', () => {
    expect(() => shared.readShared('data/references.js')).toThrow(/scripts\/shared-files\.js/);
    expect(shared.readShared('data/terms.js')).toContain('TERMS');
  });

  it('the app build and the reference tests read only listed website files, and read all of them', async () => {
    const read = new Set();
    const real = fs.readFileSync;
    vi.spyOn(fs, 'readFileSync').mockImplementation(function (file, ...rest) {
      if (typeof file === 'string' || file instanceof URL) {
        const rel = path.relative(ROOT, file instanceof URL ? fileURLToPath(file) : path.resolve(file)).split(path.sep).join('/');
        if (!rel.startsWith('..') && !NOT_WEBSITE.test(rel)) read.add(rel);
      }
      return real.call(fs, file, ...rest);
    });
    const { loadSiteData } = await import('../site-data');
    const { loadLegacy } = await import('../../../packages/core/reference/legacy.mjs');
    const { legacyCalibrationCsv } = await import('../../../packages/core/reference/calibration-csv.mjs');
    const { buildXlsxReference } = await import('../../../packages/core/reference/xlsx-reference.mjs');
    loadSiteData(ROOT);
    loadLegacy();
    legacyCalibrationCsv({ unit: 'g', g: null, tol: null, cell: '', notes: '' }, [{ m: '100', r: '0.98' }, { m: '200', r: '1.96' }], false, [2026, 0, 15, 9, 30, 5]);
    buildXlsxReference();
    expect([...read].filter((f) => !SHARED_FILES.includes(f))).toEqual([]);
    expect(SHARED_FILES.filter((f) => !read.has(f))).toEqual([]);
  });
});

describe('the shared files hash', () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'shared-files-'));
  const copyAll = (dir, eol) => {
    for (const f of SHARED_FILES) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.writeFileSync(path.join(dir, f), shared.normalize(fs.readFileSync(path.join(ROOT, f), 'utf8')).replace(/\n/g, eol));
    }
  };

  it('is the same for a Windows (CRLF) and a Linux (LF) checkout', () => {
    const lf = tmp(), crlf = tmp();
    try {
      copyAll(lf, '\n'); copyAll(crlf, '\r\n');
      expect(fs.readFileSync(path.join(crlf, 'data/terms.js'), 'utf8')).toContain('\r\n');
      expect(shared.sharedFilesHash(crlf)).toBe(shared.sharedFilesHash(lf));
      expect(shared.sharedFilesHash(lf)).toBe(shared.sharedFilesHash(ROOT));
      fs.appendFileSync(path.join(lf, 'compare.js'), ' ');
      expect(shared.sharedFilesHash(lf)).not.toBe(shared.sharedFilesHash(crlf));
    } finally {
      fs.rmSync(lf, { recursive: true, force: true }); fs.rmSync(crlf, { recursive: true, force: true });
    }
  });

  it('frames each file as path, length, and content, in list order', () => {
    const h = crypto.createHash('sha256');
    for (const f of SHARED_FILES) {
      const body = Buffer.from(shared.normalize(fs.readFileSync(path.join(ROOT, f), 'utf8')), 'utf8');
      h.update(f + '\n' + body.length + '\n'); h.update(body);
    }
    expect(shared.sharedFilesHash()).toBe(h.digest('hex'));
  });

  it('is printed by node scripts/shared-files.js (full and short)', () => {
    const full = shared.sharedFilesHash();
    const out = spawnSync(process.execPath, [path.join(ROOT, 'scripts/shared-files.js')], { encoding: 'utf8' });
    expect(out.status).toBe(0);
    expect(out.stdout).toContain('SHA-256: ' + full);
    expect(out.stdout).toContain('Short:   ' + full.slice(0, 12));
    for (const f of SHARED_FILES) expect(out.stdout).toContain('  ' + f + '\n');
    const short = spawnSync(process.execPath, [path.join(ROOT, 'scripts/shared-files.js'), '--short'], { encoding: 'utf8' });
    expect(short.stdout.trim()).toBe(full.slice(0, 12));
  });
});
