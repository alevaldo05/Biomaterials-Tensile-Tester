/* The Windows app's update check, against stand-in GitHub answers (no network): which release is newer, which pages
   may be opened, that nothing is asked while the setting is off, and that any failure means "no update". */
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

interface Own { version: string; run: number }
interface Answer { available: boolean; version?: string; pageUrl?: string }
type Fetch = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<unknown>;
const u = createRequire(import.meta.url)('../update-check.cjs') as {
  RELEASES_API: string; USER_AGENT: string;
  compareVersions(a: string, b: string): number;
  parseTag(t: unknown): { version: string; run: number } | null;
  isNewer(r: { version: string; run: number }, own: Own): boolean;
  pickRelease(list: unknown): { version: string; run: number; tag: string } | null;
  isReleasePage(url: unknown): boolean;
  checkForUpdate(fetch: Fetch, own: Own, timeoutMs?: number): Promise<Answer>;
  createUpdateOnce(fetch: Fetch, own: () => Own, enabled: () => boolean): () => Promise<Answer>;
};

const own: Own = { version: '1.0.0-beta.1', run: 20 };
const reply = (body: unknown, ok = true) => vi.fn<Fetch>(async () => ({ ok, json: async () => body }));
const rel = (tag: string, draft = false) => ({ tag_name: tag, draft, html_url: 'https://evil.example/' + tag });

describe('version and run comparison', () => {
  it('orders versions as semver, aware of -beta.N', () => {
    const order = ['0.9.9', '1.0.0-alpha', '1.0.0-beta', '1.0.0-beta.1', '1.0.0-beta.2', '1.0.0-beta.10', '1.0.0-rc.1', '1.0.0', '1.0.1', '1.1.0', '2.0.0'];
    for (let i = 0; i < order.length - 1; i++) {
      expect(u.compareVersions(order[i]!, order[i + 1]!), order[i] + ' < ' + order[i + 1]).toBe(-1);
      expect(u.compareVersions(order[i + 1]!, order[i]!)).toBe(1);
    }
    expect(u.compareVersions('1.0.0-beta.1', '1.0.0-beta.1')).toBe(0);
  });
  it('reads release tags with and without a run number, and refuses unusual ones', () => {
    expect(u.parseTag('app-v1.0.0-beta.2-run.17')).toEqual({ version: '1.0.0-beta.2', run: 17 });
    expect(u.parseTag('app-v1.0.0-run.3')).toEqual({ version: '1.0.0', run: 3 });
    expect(u.parseTag('app-v1.0.0-beta.2')).toEqual({ version: '1.0.0-beta.2', run: 0 });
    for (const bad of ['v1.0.0', 'app-v1.0', 'app-v1.0.0-run.0', 'app-v1.0.0-run.x', 'app-v1.0.0-beta.1-run.01', 'app-v01.0.0', 'app-v1.0.0+build.5', 'app-v1.0.0-beta..1', 'app-vlatest', '', null, 42, 'app-v1.0.0 ']) expect(u.parseTag(bad), String(bad)).toBeNull();
  });
  it('is newer only for a higher version, or the same version from a later run', () => {
    expect(u.isNewer({ version: '1.0.0-beta.1', run: 20 }, own)).toBe(false);   /* same */
    expect(u.isNewer({ version: '1.0.0-beta.1', run: 21 }, own)).toBe(true);    /* same version, later run */
    expect(u.isNewer({ version: '1.0.0-beta.1', run: 19 }, own)).toBe(false);   /* earlier run */
    expect(u.isNewer({ version: '1.0.0-beta.2', run: 1 }, own)).toBe(true);     /* higher version, any run */
    expect(u.isNewer({ version: '1.0.0', run: 0 }, own)).toBe(true);
    expect(u.isNewer({ version: '0.9.0', run: 99 }, own)).toBe(false);          /* older */
  });
  it('skips published releases that are not the app, such as a backup', () => {
    expect(u.pickRelease([rel('backup-2026-11-20'), rel('app-v1.0.0-beta.2-run.30')])).toEqual({ version: '1.0.0-beta.2', run: 30, tag: 'app-v1.0.0-beta.2-run.30' });
    expect(u.pickRelease([rel('backup-2026-11-08')])).toBeNull();
  });
  it('takes the first release that is not a draft', () => {
    expect(u.pickRelease([rel('app-v9.0.0-run.1', true), rel('app-v1.0.0-beta.2-run.30'), rel('app-v1.0.0-run.40')])).toEqual({ version: '1.0.0-beta.2', run: 30, tag: 'app-v1.0.0-beta.2-run.30' });
    expect(u.pickRelease([rel('app-v1.0.0', true)])).toBeNull();
    for (const bad of [null, {}, 'x', [null], [{ draft: false, tag_name: 'nightly' }], [{ tag_name: 'app-v2.0.0' }]]) expect(u.pickRelease(bad)).toBeNull();
  });
});

describe('release page', () => {
  it('opens only this repository\'s release pages', () => {
    for (const ok of ['https://github.com/alevaldo05/Biomaterials-Tensile-Tester/releases', 'https://github.com/alevaldo05/Biomaterials-Tensile-Tester/releases/latest', 'https://github.com/alevaldo05/Biomaterials-Tensile-Tester/releases/tag/app-v1.0.0-beta.2-run.17']) expect(u.isReleasePage(ok), ok).toBe(true);
    for (const bad of ['http://github.com/alevaldo05/Biomaterials-Tensile-Tester/releases', 'https://github.com.evil.example/alevaldo05/Biomaterials-Tensile-Tester/releases',
      'https://evil.example/alevaldo05/Biomaterials-Tensile-Tester/releases', 'https://github.com/someone/Biomaterials-Tensile-Tester/releases', 'https://github.com/alevaldo05/Biomaterials-Tensile-Tester/releasesx',
      'https://github.com/alevaldo05/Biomaterials-Tensile-Tester/issues', 'https://user@github.com/alevaldo05/Biomaterials-Tensile-Tester/releases', 'https://github.com:8443/alevaldo05/Biomaterials-Tensile-Tester/releases',
      'file:///C:/Windows/system32/calc.exe', 'javascript:alert(1)', '', null, 42]) expect(u.isReleasePage(bad), String(bad)).toBe(false);
  });
});

describe('asking GitHub (stand-in answers, no network)', () => {
  it('asks the releases API once with the app\'s User-Agent and a timeout', async () => {
    const f = reply([rel('app-v1.0.0-beta.2-run.25')]);
    await u.checkForUpdate(f, own);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f.mock.calls[0]![0]).toBe('https://api.github.com/repos/alevaldo05/Biomaterials-Tensile-Tester/releases?per_page=10');
    expect(f.mock.calls[0]![1]!.headers!['User-Agent']).toBe('tensile-tester-app');
    expect(f.mock.calls[0]![1]!.signal).toBeInstanceOf(AbortSignal);
  });
  it('finds an app release listed after a newer backup release', async () => {
    expect(await u.checkForUpdate(reply([rel('backup-2026-11-20'), rel('app-v1.0.0-beta.2-run.25')]), own)).toMatchObject({ available: true, version: '1.0.0-beta.2' });
  });
  it('says a newer release is available and gives its page on github.com, never the answer\'s own link', async () => {
    expect(await u.checkForUpdate(reply([rel('app-v1.0.0-beta.2-run.25')]), own)).toEqual({ available: true, version: '1.0.0-beta.2', pageUrl: 'https://github.com/alevaldo05/Biomaterials-Tensile-Tester/releases/tag/app-v1.0.0-beta.2-run.25' });
    expect(await u.checkForUpdate(reply([rel('app-v1.0.0-beta.1-run.21')]), own)).toMatchObject({ available: true, version: '1.0.0-beta.1' });
  });
  it('says nothing for the same or an older release', async () => {
    expect(await u.checkForUpdate(reply([rel('app-v1.0.0-beta.1-run.20')]), own)).toEqual({ available: false });
    expect(await u.checkForUpdate(reply([rel('app-v1.0.0-beta.1-run.12')]), own)).toEqual({ available: false });
    expect(await u.checkForUpdate(reply([rel('app-v0.9.0-run.99')]), own)).toEqual({ available: false });
    expect(await u.checkForUpdate(reply([rel('app-v5.0.0-run.99', true)]), own)).toEqual({ available: false });   /* drafts are ignored */
    expect(await u.checkForUpdate(reply([rel('backup-2026-11-08')]), own)).toEqual({ available: false });
  });
  it('does nothing when offline, on an error answer, an unexpected format, or a timeout', async () => {
    expect(await u.checkForUpdate(vi.fn<Fetch>(async () => { throw new Error('net::ERR_INTERNET_DISCONNECTED'); }), own)).toEqual({ available: false });
    expect(await u.checkForUpdate(reply({ message: 'API rate limit exceeded' }, false), own)).toEqual({ available: false });
    expect(await u.checkForUpdate(reply({ not: 'a list' }), own)).toEqual({ available: false });
    expect(await u.checkForUpdate(vi.fn<Fetch>(async () => ({ ok: true, json: async () => { throw new SyntaxError('bad JSON'); } })), own)).toEqual({ available: false });
    const hang = vi.fn<Fetch>((_url, init) => new Promise((_res, rej) => init!.signal!.addEventListener('abort', () => rej(new Error('aborted')))));
    expect(await u.checkForUpdate(hang, own, 20)).toEqual({ available: false });
  });
  it('makes no request while the setting is off, and at most one per start', async () => {
    let on = false;
    const f = reply([rel('app-v2.0.0-run.1')]);
    const once = u.createUpdateOnce(f, () => own, () => on);
    expect(await once()).toEqual({ available: false });
    expect(await once()).toEqual({ available: false });
    expect(f).not.toHaveBeenCalled();
    on = true;
    expect((await once()).available).toBe(true);
    await once();
    expect(f).toHaveBeenCalledTimes(1);
  });
});
