/* The Windows app's link to the lab server (lab-proxy.cjs), against the real API and a throwaway PostgreSQL. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../api/src/app';
import { hashPassword, LoginLimiter } from '../../api/src/auth';
import { connect, migrate } from '../../api/src/db';
import type { Db } from '../../api/src/db';
import { PG_BIN, startTestDb } from '../../api/test/test-db';
import type { TestDb } from '../../api/test/test-db';

type Proxy = { handle: (r: Request) => Promise<Response>; forget: () => void; signedIn: () => boolean };
const lp = createRequire(import.meta.url)('../lab-proxy.cjs') as {
  checkLabUrl: (s: unknown) => { url?: string; error?: string };
  createLabProxy: (o: { fetch: typeof fetch; labUrl: () => string; timeoutMs?: number }) => Proxy;
};
const APP = { 'x-tensile-client': 'app', 'content-type': 'application/json' };
const req = (path: string, init: RequestInit = {}) => new Request('app://tester' + path, init);

describe('lab server address', () => {
  it('accepts http and https addresses and normalises them', () => {
    expect(lp.checkLabUrl('http://lab-pc:8080')).toEqual({ url: 'http://lab-pc:8080/' });
    expect(lp.checkLabUrl('  https://lab.example.org/tester  ')).toEqual({ url: 'https://lab.example.org/tester/' });
    expect(lp.checkLabUrl('')).toEqual({ url: '' });
  });
  it('refuses anything else', () => {
    for (const bad of ['lab-pc', 'ftp://lab', 'file:///C:/x', 'javascript:alert(1)', 'http://user:pw@lab', 'http://lab/?a=1', 'http://lab/#x', 'http://lab/a b%00']) {
      expect(lp.checkLabUrl(bad).error, bad).toEqual(expect.any(String));
    }
  });
});

describe('forwarding without a lab server', () => {
  it('says the lab server is not set up, and refuses paths outside /api/v1/', async () => {
    const p = lp.createLabProxy({ fetch, labUrl: () => '' });
    const r = await p.handle(req('/api/v1/health'));
    expect(r.status).toBe(503);
    expect((await r.json()).error.code).toBe('not_set_up');
    const q = lp.createLabProxy({ fetch, labUrl: () => 'http://127.0.0.1:9/' });
    for (const path of ['/index.html', '/api/v2/x', '/apiv1/x']) expect((await q.handle(req(path))).status, path).toBe(404);
  });
  it('says the lab server is unreachable when nothing answers', async () => {
    const p = lp.createLabProxy({ fetch, labUrl: () => 'http://127.0.0.1:9/', timeoutMs: 3000 });
    const r = await p.handle(req('/api/v1/health'));
    expect(r.status).toBe(503);
    expect((await r.json()).error.code).toBe('unreachable');
  });
});

describe.skipIf(!PG_BIN)('forwarding to the real lab server', () => {
  let tdb: TestDb, db: Db, app: FastifyInstance, base = '';
  const PW = 'correct horse battery';
  beforeAll(async () => {
    tdb = await startTestDb();
    db = connect(tdb.url);
    await migrate(db);
    await db.query("insert into users (username, role, password_hash) values ('desk-admin', 'admin', $1)", [await hashPassword(PW)]);
    app = buildApp({ db, config: { databaseUrl: '', host: '127.0.0.1', port: 0, cookieSecure: false, sessionHours: 1, trustProxy: false, bodyLimitBytes: 1024 * 1024 }, limiter: new LoginLimiter(1000) });
    await app.listen({ host: '127.0.0.1', port: 0 });
    base = 'http://127.0.0.1:' + (app.server.address() as AddressInfo).port + '/';
  }, 60_000);
  afterAll(async () => { await app?.close(); await db?.end(); tdb?.stop(); });

  it('signs in through the Windows app; the screens never see the sign-in cookie', async () => {
    const p = lp.createLabProxy({ fetch, labUrl: () => base });
    expect((await p.handle(req('/api/v1/health'))).status).toBe(200);
    const login = await p.handle(req('/api/v1/auth/login', { method: 'POST', headers: APP, body: JSON.stringify({ username: 'desk-admin', password: PW }) }));
    expect(login.status).toBe(200);
    expect(login.headers.get('set-cookie')).toBeNull();
    expect(p.signedIn()).toBe(true);
    const me = await p.handle(req('/api/v1/auth/me'));
    expect((await me.json()).user.username).toBe('desk-admin');
    expect(me.headers.get('cache-control')).toBe('no-store');
    /* changes still need the app header, which the proxy passes on but never adds */
    expect((await p.handle(req('/api/v1/methods', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }))).status).toBe(403);
    const saved = await p.handle(req('/api/v1/methods', { method: 'POST', headers: APP, body: JSON.stringify({ name: 'From Windows', test: 'uniaxial', fields: { speed: '30' } }) }));
    expect(saved.status).toBe(201);
    const out = await p.handle(req('/api/v1/auth/logout', { method: 'POST', headers: APP, body: '{}' }));
    expect(out.status).toBe(200);
    expect(p.signedIn()).toBe(false);
    expect((await p.handle(req('/api/v1/auth/me'))).status).toBe(401);
  });

  it('ignores a cookie sent by the screens', async () => {
    const direct = await fetch(base + 'api/v1/auth/login', { method: 'POST', headers: APP, body: JSON.stringify({ username: 'desk-admin', password: PW }) });
    const token = String(direct.headers.get('set-cookie')).split(';')[0] as string;
    expect(token).toMatch(/^tt_session=/);
    const p = lp.createLabProxy({ fetch, labUrl: () => base });
    expect((await p.handle(req('/api/v1/auth/me', { headers: { cookie: token } }))).status).toBe(401);
  });

  it('a sign-in belongs to one lab server address', async () => {
    let at = base;
    const p = lp.createLabProxy({ fetch, labUrl: () => at });
    await p.handle(req('/api/v1/auth/login', { method: 'POST', headers: APP, body: JSON.stringify({ username: 'desk-admin', password: PW }) }));
    expect(p.signedIn()).toBe(true);
    at = base.replace('127.0.0.1', 'localhost');   /* the same server under another name counts as another address */
    expect((await p.handle(req('/api/v1/auth/me'))).status).toBe(401);
    expect(p.signedIn()).toBe(false);
  });
});
