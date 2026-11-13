'use strict';
/* The Windows app's link to the lab server. The screens call /api/v1/... on their own address (app://tester), as
   they do behind the lab gateway; the main process sends only those requests on to the lab server set in Settings.
   The lab server is a data connection only: no screens or scripts are ever loaded from it.
   The sign-in cookie is kept here, in the main process's memory, and is never given to the screens.
   No Electron here, so it can be tested on its own (apps/desktop/test/lab-proxy.test.ts). */

const API_PREFIX = '/api/v1/';
const COOKIE_NAME = 'tt_session';
/* Request headers passed on. Everything else (the screens' own cookies, origin, referer) is dropped. */
const PASS_REQUEST = ['content-type', 'accept', 'x-tensile-client'];
/* Response headers passed back. Set-Cookie is never passed back. */
const PASS_RESPONSE = ['content-type', 'content-disposition', 'cache-control'];

/** Checks an address typed in Settings. Returns { url } (normalised, ending in "/") or { error }. */
function checkLabUrl(input) {
  const text = String(input ?? '').trim();
  if (!text) return { url: '' };   /* empty: no lab server */
  let u;
  try { u = new URL(text); } catch { return { error: 'This is not a web address. Example: http://lab-pc:8080' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: 'The address must start with http:// or https://.' };
  if (u.username || u.password) return { error: 'Do not put a user name or password in the address.' };
  if (u.search || u.hash) return { error: 'The address cannot have ? or # parts.' };
  if (u.pathname !== '/' && !/^\/[A-Za-z0-9._~\-\/]*$/.test(u.pathname)) return { error: 'The address has characters that are not allowed.' };
  const path = u.pathname.endsWith('/') ? u.pathname : u.pathname + '/';
  return { url: u.origin + path };
}

function json(status, code, message) {
  return new Response(JSON.stringify({ error: { code, message } }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

/** The value of our cookie in a Set-Cookie header: a string, '' when the server clears it, or null when absent. */
function readSetCookie(values) {
  for (const v of values) {
    const [pair, ...attrs] = v.split(';');
    const eq = pair.indexOf('=');
    if (eq < 0 || pair.slice(0, eq).trim() !== COOKIE_NAME) continue;
    const value = pair.slice(eq + 1).trim();
    const cleared = attrs.some((a) => /^\s*max-age\s*=\s*(0|-\d+)\s*$/i.test(a)) || value === '';
    return cleared ? '' : value;
  }
  return null;
}

/**
 * o.fetch: the fetch to use (Electron's net.fetch in the app, a stand-in in tests)
 * o.labUrl: () => the lab server address from Settings ('' when none)
 * o.timeoutMs: how long to wait for the lab server
 */
function createLabProxy(o) {
  let cookie = '', cookieFor = '';
  const timeoutMs = o.timeoutMs ?? 20000;
  return {
    /** Forgets the sign-in (for example when the address changes). */
    forget() { cookie = ''; cookieFor = ''; },
    /** Handles a request from the screens for app://tester/api/v1/...; anything else is refused. */
    async handle(req) {
      const u = new URL(req.url);
      if (!u.pathname.startsWith(API_PREFIX) || u.pathname.includes('..')) return json(404, 'not_found', 'Not found.');
      const base = o.labUrl();
      if (!base) return json(503, 'not_set_up', 'No lab server address is set. Add it in Settings. Tests can still be recorded and downloaded.');
      if (cookieFor !== base) { cookie = ''; cookieFor = base; }   /* a sign-in belongs to one lab server */
      const target = new URL(u.pathname.slice(1) + u.search, base);
      const headers = new Headers();
      for (const h of PASS_REQUEST) { const v = req.headers.get(h); if (v !== null) headers.set(h, v); }
      if (cookie) headers.set('cookie', COOKIE_NAME + '=' + cookie);
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      let res;
      try {
        res = await o.fetch(target.toString(), {
          method: req.method, headers, redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
          ...(hasBody ? { body: await req.arrayBuffer() } : {}),
        });
      } catch {
        return json(503, 'unreachable', 'The lab server at ' + base + ' is not reachable from this computer. Tests can still be recorded and downloaded.');
      }
      const set = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
      const next = readSetCookie(set);
      if (next !== null) cookie = next;
      if (res.status === 401) cookie = '';   /* signed out or expired on the server */
      const out = new Headers({ 'x-content-type-options': 'nosniff' });
      for (const h of PASS_RESPONSE) { const v = res.headers.get(h); if (v !== null) out.set(h, v); }
      return new Response(res.body, { status: res.status, headers: out });
    },
    /** For tests: whether a sign-in is held (never its value). */
    signedIn() { return !!cookie; },
  };
}

module.exports = { checkLabUrl, createLabProxy, readSetCookie, API_PREFIX };
