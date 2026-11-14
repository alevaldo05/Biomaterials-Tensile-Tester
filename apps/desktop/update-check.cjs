'use strict';
/* The update check of the Windows app: once per start it asks GitHub for this repository's latest releases and says
   whether a newer published one exists. It downloads and installs nothing; the person opens the release page and
   installs by their own click. Any failure (offline, timeout, unexpected answer) means "no update", silently.
   Release tags are app-v<version> or app-v<version>-run.<N> (the Windows app workflow's run number). */

const REPO = 'alevaldo05/Biomaterials-Tensile-Tester';
const RELEASES_API = 'https://api.github.com/repos/' + REPO + '/releases?per_page=10';
const RELEASES_PAGE = 'https://github.com/' + REPO + '/releases';
const USER_AGENT = 'tensile-tester-app';
const TIMEOUT_MS = 10000;

/* "1.0.0-beta.2" -> { core: [1, 0, 0], pre: ['beta', 2] }, or null. Build metadata (+...) is not accepted. */
function parseVersion(v) {
  const m = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})(?:-([0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*))?$/.exec(typeof v === 'string' ? v : '');
  if (!m) return null;
  const pre = m[4] ? m[4].split('.').map((p) => (/^(0|[1-9]\d{0,8})$/.test(p) ? Number(p) : p)) : [];
  return { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre };
}

/* Semver order: core numbers, then a release is above any pre-release of it, then pre-release parts one by one
   (numbers below words, numbers by value, words alphabetically, fewer parts first). Returns -1, 0 or 1. */
function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] < y.core[i] ? -1 : 1;
  if (!x.pre.length || !y.pre.length) return x.pre.length === y.pre.length ? 0 : (x.pre.length ? -1 : 1);
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    if (typeof p === 'number' && typeof q === 'number') return p < q ? -1 : 1;
    if (typeof p === 'number') return -1;
    if (typeof q === 'number') return 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

/* "app-v1.0.0-beta.2-run.17" -> { version: '1.0.0-beta.2', run: 17 }; "app-v1.0.0" -> run 0; anything else -> null. */
function parseTag(tag) {
  const m = /^app-v(.+?)(?:-run\.([1-9]\d{0,8}))?$/.exec(typeof tag === 'string' ? tag : '');
  const v = m && parseVersion(m[1]);
  if (!v || v.pre.includes('run')) return null;   /* a malformed run part (run.0, run.x) is not a pre-release name */
  return { version: m[1], run: m[2] ? Number(m[2]) : 0 };
}

/* Newer when the version is higher, or the version is the same and the run number is higher. */
function isNewer(release, own) {
  const c = compareVersions(release.version, own.version);
  return c > 0 || (c === 0 && release.run > (Number.isInteger(own.run) ? own.run : 0));
}

/* The first release that is not a draft and has a tag this app understands. */
function pickRelease(list) {
  if (!Array.isArray(list)) return null;
  const r = list.find((x) => x && typeof x === 'object' && x.draft === false);
  if (!r) return null;
  const t = parseTag(r.tag_name);
  return t ? { ...t, tag: r.tag_name } : null;
}

/* Only this repository's release pages may be opened in the computer's browser. */
function isReleasePage(url) {
  let u;
  try { u = new URL(String(url)); } catch { return false; }
  if (u.protocol !== 'https:' || u.hostname !== 'github.com' || u.port || u.username || u.password) return false;
  return u.pathname === '/' + REPO + '/releases' || u.pathname.startsWith('/' + REPO + '/releases/');
}

function pageFor(tag) {
  return RELEASES_PAGE + '/tag/' + encodeURIComponent(tag);
}

const NONE = Object.freeze({ available: false });

/* Asks GitHub once. fetch is Electron's net.fetch (or a stand-in in tests). own = { version, run }. Never throws. */
async function checkForUpdate(fetch, own, timeoutMs = TIMEOUT_MS) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(RELEASES_API, { method: 'GET', signal: ctl.signal, headers: { 'User-Agent': USER_AGENT, Accept: 'application/vnd.github+json' } });
    if (!res || !res.ok) return NONE;
    const r = pickRelease(await res.json());
    if (!r || !isNewer(r, own)) return NONE;
    const pageUrl = pageFor(r.tag);
    return isReleasePage(pageUrl) ? { available: true, version: r.version, pageUrl } : NONE;
  } catch {
    return NONE;
  } finally {
    clearTimeout(timer);
  }
}

/* At most one request per start, and none while enabled() is false. own() gives { version, run }. */
function createUpdateOnce(fetch, own, enabled) {
  let answer = null;
  return () => {
    if (!enabled()) return Promise.resolve(NONE);
    if (!answer) answer = checkForUpdate(fetch, own());
    return answer;
  };
}

module.exports = { REPO, RELEASES_API, RELEASES_PAGE, USER_AGENT, TIMEOUT_MS, parseVersion, compareVersions, parseTag, isNewer, pickRelease, isReleasePage, pageFor, checkForUpdate, createUpdateOnce };
