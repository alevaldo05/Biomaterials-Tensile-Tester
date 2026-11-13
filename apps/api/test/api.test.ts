/* The API against a real throwaway PostgreSQL: signing in, roles, users, profiles and calibrations, saved tests,
   the audit record, a database restart, and migrations. */
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseSetupFile } from '../../tester/src/controller';
import { measuredSetup, move, ready, rig } from '../../tester/test/helpers';
import { buildApp } from '../src/app';
import { hashPassword, LoginLimiter } from '../src/auth';
import type { Config } from '../src/config';
import { connect, migrate } from '../src/db';
import type { Db } from '../src/db';
import { PG_BIN, startTestDb } from './test-db';
import type { TestDb } from './test-db';

const config: Config = { databaseUrl: '', host: '127.0.0.1', port: 0, cookieSecure: false, sessionHours: 12, trustProxy: false, bodyLimitBytes: 64 * 1024 * 1024 };
const PW = 'correct horse battery';
const APP = { 'x-tensile-client': 'app' };

type Method = 'GET' | 'POST' | 'PATCH';
const sha = (b: Buffer | string) => crypto.createHash('sha256').update(b).digest('hex');

describe.skipIf(!PG_BIN)('API against a real PostgreSQL', () => {
  let tdb: TestDb, db: Db, app: FastifyInstance, migratedFirst: string[];
  const apps: FastifyInstance[] = [];
  let admin: { id: string; username: string }, adminCookie: string;
  let n = 0;
  const uname = (p: string) => p + '-' + ++n;

  const make = (o: { config?: Config; limiter?: LoginLimiter } = {}) => {
    const a = buildApp({ db, config: o.config ?? config, limiter: o.limiter ?? new LoginLimiter(100_000) });
    apps.push(a);
    return a;
  };
  const call = (a: FastifyInstance, method: Method, url: string, cookie?: string | null, payload?: object) =>
    a.inject({ method, url: '/api/v1' + url, headers: { ...APP, ...(cookie ? { cookie } : {}) }, payload });
  const cookieOf = (r: { headers: Record<string, unknown> }) => String(r.headers['set-cookie']).split(';')[0] as string;
  const login = async (a: FastifyInstance, username: string, password = PW) => {
    const r = await call(a, 'POST', '/auth/login', null, { username, password });
    expect(r.statusCode).toBe(200);
    return cookieOf(r);
  };
  const mkUser = async (username: string, role: 'admin' | 'user' = 'user', o: { password?: string; disabled?: boolean; must?: boolean } = {}) => {
    const r = await db.query('insert into users (username, role, password_hash, disabled, must_change_password) values ($1, $2, $3, $4, $5) returning id',
      [username, role, await hashPassword(o.password ?? PW), o.disabled ?? false, o.must ?? false]);
    return { id: String(r.rows[0].id), username };
  };
  const mkSignedIn = async (role: 'admin' | 'user' = 'user') => {
    const u = await mkUser(uname(role), role);
    return { ...u, cookie: await login(app, u.username) };
  };

  beforeAll(async () => {
    tdb = await startTestDb();
    db = connect(tdb.url);
    migratedFirst = await migrate(db);
    app = make();
    admin = await mkUser('root-admin', 'admin');
    adminCookie = await login(app, admin.username);
  }, 60_000);
  afterAll(async () => {
    for (const a of apps) await a.close().catch(() => undefined);
    await db?.end().catch(() => undefined);
    tdb?.stop();
  });

  /* ---------- 1. signing in ---------- */
  describe('sign-in', () => {
    it('gives the same 401 for a wrong password and an unknown username', async () => {
      const u = await mkUser(uname('same'));
      const wrong = await call(app, 'POST', '/auth/login', null, { username: u.username, password: 'not the password' });
      const unknown = await call(app, 'POST', '/auth/login', null, { username: 'nobody-here', password: PW });
      expect(wrong.statusCode).toBe(401);
      expect(unknown.statusCode).toBe(401);
      expect(wrong.json()).toEqual(unknown.json());
      expect(wrong.json()).toEqual({ error: { code: 'wrong_login', message: 'Wrong username or password.' } });
      expect(wrong.headers['set-cookie']).toBeUndefined();
    });

    it('does not let a disabled user sign in, and stops a signed-in user who is disabled', async () => {
      const off = await mkUser(uname('off'), 'user', { disabled: true });
      const r = await call(app, 'POST', '/auth/login', null, { username: off.username, password: PW });
      expect(r.statusCode).toBe(401);
      expect(r.json().error.code).toBe('wrong_login');
      const on = await mkSignedIn();
      expect((await call(app, 'GET', '/auth/me', on.cookie)).statusCode).toBe(200);
      await db.query('update users set disabled = true where id = $1', [on.id]);
      expect((await call(app, 'GET', '/auth/me', on.cookie)).statusCode).toBe(401);
    });

    it('accepts the username in any letter case with spaces around it', async () => {
      const u = await mkUser(uname('mixed'));
      const r = await call(app, 'POST', '/auth/login', null, { username: '  ' + u.username.toUpperCase() + ' ', password: PW });
      expect(r.statusCode).toBe(200);
      expect(r.json().user).toMatchObject({ username: u.username, role: 'user', mustChangePassword: false });
      expect(JSON.stringify(r.json())).not.toMatch(/password_hash|argon2/i);
    });

    it('blocks the 6th attempt after 5 failures, even with the right password', async () => {
      const a = make({ limiter: new LoginLimiter() });
      const u = await mkUser(uname('lock'));
      for (let i = 0; i < 5; i++) expect((await call(a, 'POST', '/auth/login', null, { username: u.username, password: 'wrong-' + i })).statusCode).toBe(401);
      const r = await call(a, 'POST', '/auth/login', null, { username: u.username, password: PW });
      expect(r.statusCode).toBe(429);
      expect(r.json().error.code).toBe('too_many_attempts');
      expect(r.headers['set-cookie']).toBeUndefined();
    });

    it('lets the person try again after the 15 minute window', async () => {
      let t = 1_000_000;
      const a = make({ limiter: new LoginLimiter(5, 15 * 60_000, () => t) });
      const u = await mkUser(uname('window'));
      for (let i = 0; i < 5; i++) await call(a, 'POST', '/auth/login', null, { username: u.username, password: 'wrong' });
      expect((await call(a, 'POST', '/auth/login', null, { username: u.username, password: PW })).statusCode).toBe(429);
      t += 15 * 60_000 + 1;
      expect((await call(a, 'POST', '/auth/login', null, { username: u.username, password: PW })).statusCode).toBe(200);
    });

    it('a success clears only that name\'s own count', async () => {
      const a = make({ limiter: new LoginLimiter() });
      const x = await mkUser(uname('count-a')), y = await mkUser(uname('count-b'));
      for (let i = 0; i < 4; i++) await call(a, 'POST', '/auth/login', null, { username: x.username, password: 'wrong' });
      expect((await call(a, 'POST', '/auth/login', null, { username: y.username, password: PW })).statusCode).toBe(200);
      await call(a, 'POST', '/auth/login', null, { username: x.username, password: 'wrong' });   /* x: 5th failure */
      expect((await call(a, 'POST', '/auth/login', null, { username: x.username, password: PW })).statusCode).toBe(429);
    });

    it('a success clears the failures of that name', async () => {
      const a = make({ limiter: new LoginLimiter() });
      const x = await mkUser(uname('clear'));
      for (let i = 0; i < 4; i++) await call(a, 'POST', '/auth/login', null, { username: x.username, password: 'wrong' });
      expect((await call(a, 'POST', '/auth/login', null, { username: x.username, password: PW })).statusCode).toBe(200);
      for (let i = 0; i < 4; i++) expect((await call(a, 'POST', '/auth/login', null, { username: x.username, password: 'wrong' })).statusCode).toBe(401);
    });

    it('logout ends the session and clears the cookie', async () => {
      const u = await mkSignedIn();
      const out = await call(app, 'POST', '/auth/logout', u.cookie);
      expect(out.statusCode).toBe(200);
      expect(String(out.headers['set-cookie'])).toMatch(/^tt_session=;.*Max-Age=0/);
      expect((await call(app, 'GET', '/auth/me', u.cookie)).statusCode).toBe(401);
      expect((await db.query('select count(*)::int as n from login_sessions where user_id = $1', [u.id])).rows[0].n).toBe(0);
    });

    it('rejects an expired session', async () => {
      const u = await mkSignedIn();
      expect((await call(app, 'GET', '/auth/me', u.cookie)).statusCode).toBe(200);
      await db.query("update login_sessions set expires_at = now() - interval '1 minute' where user_id = $1", [u.id]);
      const r = await call(app, 'GET', '/auth/me', u.cookie);
      expect(r.statusCode).toBe(401);
      expect(r.json().error.code).toBe('not_signed_in');
    });

    it('rejects a made-up cookie', async () => {
      expect((await call(app, 'GET', '/auth/me', 'tt_session=not-a-real-token')).statusCode).toBe(401);
    });

    it('stores only a hash of the login token', async () => {
      const u = await mkUser(uname('hash'));
      const cookie = await login(app, u.username);
      const token = cookie.slice('tt_session='.length);
      const rows = (await db.query('select token_hash from login_sessions where user_id = $1', [u.id])).rows;
      expect(rows).toHaveLength(1);
      expect(Buffer.from(rows[0].token_hash).equals(crypto.createHash('sha256').update(token).digest())).toBe(true);
      expect(Buffer.from(rows[0].token_hash).toString('base64url')).not.toBe(token);
    });

    it('sets an HttpOnly, SameSite=Strict cookie on /api, Secure only when configured', async () => {
      const u = await mkUser(uname('flags'));
      const plain = String((await call(app, 'POST', '/auth/login', null, { username: u.username, password: PW })).headers['set-cookie']);
      expect(plain).toMatch(/^tt_session=[A-Za-z0-9_-]{40,}; /);
      expect(plain).toContain('Path=/api');
      expect(plain).toContain('HttpOnly');
      expect(plain).toContain('SameSite=Strict');
      expect(plain).toContain('Max-Age=' + 12 * 3600);
      expect(plain).not.toContain('Secure');
      const secure = make({ config: { ...config, cookieSecure: true } });
      const s = String((await call(secure, 'POST', '/auth/login', null, { username: u.username, password: PW })).headers['set-cookie']);
      expect(s).toContain('; Secure');
      expect(s).toContain('HttpOnly');
      expect(s).toContain('SameSite=Strict');
    });
  });

  /* ---------- 2. the app header ---------- */
  describe('the app header', () => {
    it('refuses a change without x-tensile-client: app, even with a valid cookie', async () => {
      const u = await mkSignedIn();
      const noHeader = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { cookie: u.cookie } });
      expect(noHeader.statusCode).toBe(403);
      expect(noHeader.json().error.code).toBe('forbidden');
      const other = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { cookie: u.cookie, 'x-tensile-client': 'web' } });
      expect(other.statusCode).toBe(403);
      const patch = await app.inject({ method: 'PATCH', url: '/api/v1/users/1', headers: { cookie: adminCookie }, payload: { displayName: 'x' } });
      expect(patch.statusCode).toBe(403);
      expect((await call(app, 'GET', '/auth/me', u.cookie)).statusCode).toBe(200);   /* nothing was done */
    });

    it('refuses a sign-in without the header', async () => {
      const r = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username: 'root-admin', password: PW } });
      expect(r.statusCode).toBe(403);
    });

    it('lets a GET through without it', async () => {
      const u = await mkSignedIn();
      const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: u.cookie } });
      expect(me.statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/api/v1/health' })).statusCode).toBe(200);
    });

    it('sends no-store and nosniff headers', async () => {
      const r = await app.inject({ method: 'GET', url: '/api/v1/health' });
      expect(r.headers['cache-control']).toBe('no-store');
      expect(r.headers['x-content-type-options']).toBe('nosniff');
      expect(r.headers['referrer-policy']).toBe('no-referrer');
    });

    it('sends the same headers on refusals and errors', async () => {
      for (const r of [await app.inject({ method: 'GET', url: '/api/v1/auth/me' }), await app.inject({ method: 'GET', url: '/api/v1/test-sessions/1', headers: { cookie: adminCookie } }),
        await app.inject({ method: 'POST', url: '/api/v1/methods', headers: { cookie: adminCookie }, payload: {} })]) {
        expect(r.statusCode).toBeGreaterThanOrEqual(400);
        expect(r.headers['cache-control']).toBe('no-store');
        expect(r.headers['x-content-type-options']).toBe('nosniff');
        expect(r.json().error.message).toEqual(expect.any(String));
      }
    });

    it('needs the header for every kind of change: tests, methods, calibrations', async () => {
      const u = await mkSignedIn();
      for (const [url, cookie] of [['/api/v1/test-sessions', u.cookie], ['/api/v1/methods', adminCookie], ['/api/v1/methods/lm-1/archive', adminCookie], ['/api/v1/calibrations', adminCookie], ['/api/v1/device-profiles', adminCookie]] as const) {
        const r = await app.inject({ method: 'POST', url, headers: { cookie }, payload: {} });
        expect(r.statusCode, url).toBe(403);
        expect(r.json().error.code).toBe('forbidden');
      }
    });
  });

  /* ---------- 3. password change ---------- */
  describe('password change', () => {
    it('refuses a wrong current password and a short new one', async () => {
      const u = await mkSignedIn();
      const wrong = await call(app, 'POST', '/auth/password', u.cookie, { current: 'not mine at all', next: 'a brand new password' });
      expect(wrong.statusCode).toBe(400);
      expect(wrong.json().error.code).toBe('wrong_password');
      const short = await call(app, 'POST', '/auth/password', u.cookie, { current: PW, next: 'too short' });   /* 9 characters */
      expect(short.statusCode).toBe(400);
      expect(short.json().error.code).toBe('weak_password');
      expect((await call(app, 'POST', '/auth/login', null, { username: u.username, password: PW })).statusCode).toBe(200);   /* unchanged */
    });

    it('accepts exactly 10 characters', async () => {
      const u = await mkSignedIn();
      expect((await call(app, 'POST', '/auth/password', u.cookie, { current: PW, next: '1234567890' })).statusCode).toBe(200);
    });

    it('clears must_change_password and signs out the other sessions but keeps this one', async () => {
      const u = await mkUser(uname('chg'), 'user', { must: true });
      const here = await login(app, u.username), other = await login(app, u.username), third = await login(app, u.username);
      expect((await call(app, 'GET', '/auth/me', here)).json().user.mustChangePassword).toBe(true);
      const r = await call(app, 'POST', '/auth/password', here, { current: PW, next: 'a brand new password' });
      expect(r.statusCode).toBe(200);
      const me = await call(app, 'GET', '/auth/me', here);
      expect(me.statusCode).toBe(200);
      expect(me.json().user.mustChangePassword).toBe(false);
      expect((await call(app, 'GET', '/auth/me', other)).statusCode).toBe(401);
      expect((await call(app, 'GET', '/auth/me', third)).statusCode).toBe(401);
      expect((await call(app, 'POST', '/auth/login', null, { username: u.username, password: PW })).statusCode).toBe(401);
      expect((await call(app, 'POST', '/auth/login', null, { username: u.username, password: 'a brand new password' })).statusCode).toBe(200);
    });

    it('does not sign out other people', async () => {
      const a = await mkSignedIn(), b = await mkSignedIn();
      await call(app, 'POST', '/auth/password', a.cookie, { current: PW, next: 'another new password' });
      expect((await call(app, 'GET', '/auth/me', b.cookie)).statusCode).toBe(200);
    });
  });

  /* ---------- 4. roles ---------- */
  describe('roles', () => {
    const adminOnly: [Method, string, object?][] = [
      ['GET', '/users'],
      ['POST', '/users', { username: 'zz-nope', role: 'user', password: 'long enough pw' }],
      ['PATCH', '/users/1', { displayName: 'x' }],
      ['POST', '/device-profiles', { id: 'zz-nope', name: 'x', channels: {} }],
      ['POST', '/calibrations', {}],
      ['POST', '/calibrations/some-cal/approve'],
      ['POST', '/calibrations/some-cal/retire'],
      ['GET', '/audit'],
    ];
    it.each(adminOnly)('a plain user gets 403 on %s %s', async (method, url, payload) => {
      const u = await mkSignedIn('user');
      const r = await call(app, method, url, u.cookie, payload);
      expect(r.statusCode).toBe(403);
      expect(r.json().error.code).toBe('admin_only');
    });
    it.each(adminOnly)('nobody signed in gets 401 on %s %s', async (method, url, payload) => {
      const r = await call(app, method, url, null, payload);
      expect(r.statusCode).toBe(401);
      expect(r.json().error.code).toBe('not_signed_in');
    });
    it.each([
      ['GET', '/auth/me'], ['POST', '/auth/password'], ['GET', '/device-profiles'], ['GET', '/calibrations'], ['GET', '/setup-files/prof-x'],
      ['GET', '/test-sessions'], ['POST', '/test-sessions'], ['GET', '/test-sessions/1'], ['GET', '/test-sessions/1/file'],
    ] as [Method, string][])('nobody signed in gets 401 on %s %s', async (method, url) => {
      expect((await call(app, method, url, null, method === 'POST' ? {} : undefined)).statusCode).toBe(401);
    });
    it('an admin can list users and read the audit', async () => {
      const users = await call(app, 'GET', '/users', adminCookie);
      expect(users.statusCode).toBe(200);
      expect(users.json().users.some((x: { username: string }) => x.username === 'root-admin')).toBe(true);
      expect(JSON.stringify(users.json())).not.toMatch(/argon2|password_hash|passwordHash/);
      expect((await call(app, 'GET', '/audit', adminCookie)).statusCode).toBe(200);
    });
    it('a plain user can still read profiles and calibrations', async () => {
      const u = await mkSignedIn('user');
      expect((await call(app, 'GET', '/device-profiles', u.cookie)).statusCode).toBe(200);
      expect((await call(app, 'GET', '/calibrations', u.cookie)).statusCode).toBe(200);
    });
  });

  /* ---------- 5. users admin ---------- */
  describe('users admin', () => {
    const body = (username: string, over: object = {}) => ({ username, displayName: 'Test Person', role: 'user', password: 'a-long-password-1', ...over });

    it('creates a user who must change the password, and rejects bad input', async () => {
      const name = uname('new');
      const r = await call(app, 'POST', '/users', adminCookie, body(name));
      expect(r.statusCode).toBe(201);
      expect(r.json().user).toMatchObject({ username: name, displayName: 'Test Person', role: 'user', disabled: false, mustChangePassword: true });
      expect(JSON.stringify(r.json())).not.toContain('a-long-password-1');
      const me = await call(app, 'POST', '/auth/login', null, { username: name, password: 'a-long-password-1' });
      expect(me.statusCode).toBe(200);
      expect(me.json().user.mustChangePassword).toBe(true);

      const dup = await call(app, 'POST', '/users', adminCookie, body(name, { password: 'another-long-pw-2' }));
      expect(dup.statusCode).toBe(409);
      expect(dup.json().error.code).toBe('exists');
      expect((await call(app, 'POST', '/auth/login', null, { username: name, password: 'another-long-pw-2' })).statusCode).toBe(401);   /* not overwritten */

      for (const bad of ['Bad Name', 'UPPER', 'a', '-lead', '']) expect((await call(app, 'POST', '/users', adminCookie, body(bad))).statusCode).toBe(400);
      const weak = await call(app, 'POST', '/users', adminCookie, body(uname('weak'), { password: 'short' }));
      expect(weak.statusCode).toBe(400);
      expect(weak.json().error.code).toBe('weak_password');
      expect((await call(app, 'POST', '/users', adminCookie, body(uname('role'), { role: 'owner' }))).statusCode).toBe(400);
      expect((await call(app, 'POST', '/users', adminCookie, body(uname('extra'), { disabled: true }))).statusCode).toBe(400);   /* unknown field */
    });

    it('changes display name, role, disabled and password', async () => {
      const u = await mkUser(uname('edit'));
      const name = await call(app, 'PATCH', '/users/' + u.id, adminCookie, { displayName: 'New Name' });
      expect(name.statusCode).toBe(200);
      expect(name.json().user).toMatchObject({ id: u.id, displayName: 'New Name', role: 'user' });
      const role = await call(app, 'PATCH', '/users/' + u.id, adminCookie, { role: 'admin' });
      expect(role.json().user.role).toBe('admin');
      expect((await call(app, 'PATCH', '/users/' + u.id, adminCookie, { role: 'user' })).json().user.role).toBe('user');

      const off = await call(app, 'PATCH', '/users/' + u.id, adminCookie, { disabled: true });
      expect(off.json().user.disabled).toBe(true);
      expect((await call(app, 'POST', '/auth/login', null, { username: u.username, password: PW })).statusCode).toBe(401);
      expect((await call(app, 'PATCH', '/users/' + u.id, adminCookie, { disabled: false })).json().user.disabled).toBe(false);
      expect((await call(app, 'POST', '/auth/login', null, { username: u.username, password: PW })).statusCode).toBe(200);

      const pw = await call(app, 'PATCH', '/users/' + u.id, adminCookie, { password: 'reset-by-admin-1' });
      expect(pw.statusCode).toBe(200);
      expect(pw.json().user.mustChangePassword).toBe(true);
      expect((await call(app, 'POST', '/auth/login', null, { username: u.username, password: PW })).statusCode).toBe(401);
      expect((await call(app, 'POST', '/auth/login', null, { username: u.username, password: 'reset-by-admin-1' })).statusCode).toBe(200);
      const weak = await call(app, 'PATCH', '/users/' + u.id, adminCookie, { password: 'short' });
      expect(weak.statusCode).toBe(400);
      expect(weak.json().error.code).toBe('weak_password');
    });

    it('removes the sessions of a user who is disabled, or whose password is reset', async () => {
      const a = await mkSignedIn(), b = await mkSignedIn();
      expect((await call(app, 'GET', '/auth/me', a.cookie)).statusCode).toBe(200);
      await call(app, 'PATCH', '/users/' + a.id, adminCookie, { disabled: true });
      expect((await call(app, 'GET', '/auth/me', a.cookie)).statusCode).toBe(401);
      expect((await db.query('select count(*)::int as n from login_sessions where user_id = $1', [a.id])).rows[0].n).toBe(0);
      await call(app, 'PATCH', '/users/' + b.id, adminCookie, { password: 'reset-by-admin-2' });
      expect((await call(app, 'GET', '/auth/me', b.cookie)).statusCode).toBe(401);
    });

    it('keeps the sessions of a user whose display name changes', async () => {
      const a = await mkSignedIn();
      await call(app, 'PATCH', '/users/' + a.id, adminCookie, { displayName: 'Renamed' });
      expect((await call(app, 'GET', '/auth/me', a.cookie)).statusCode).toBe(200);
    });

    it('does not let the last active admin demote or disable themself, but does once another admin exists', async () => {
      const solo = await mkUser(uname('solo'), 'admin');
      const others = (await db.query("select id from users where role = 'admin' and not disabled and id <> $1", [solo.id])).rows.map((r) => String(r.id));
      await db.query('update users set disabled = true where id = any($1::bigint[])', [others]);
      try {
        const cookie = await login(app, solo.username);
        const demote = await call(app, 'PATCH', '/users/' + solo.id, cookie, { role: 'user' });
        expect(demote.statusCode).toBe(400);
        expect(demote.json().error.code).toBe('last_admin');
        const disable = await call(app, 'PATCH', '/users/' + solo.id, cookie, { disabled: true });
        expect(disable.statusCode).toBe(400);
        expect(disable.json().error.code).toBe('last_admin');
        expect((await call(app, 'GET', '/auth/me', cookie)).json().user.role).toBe('admin');   /* nothing changed, still signed in */
        /* changing the name of the last admin is fine */
        expect((await call(app, 'PATCH', '/users/' + solo.id, cookie, { displayName: 'Solo' })).statusCode).toBe(200);

        const second = await call(app, 'POST', '/users', cookie, body(uname('second'), { role: 'admin' }));
        expect(second.statusCode).toBe(201);
        const ok = await call(app, 'PATCH', '/users/' + solo.id, cookie, { role: 'user' });
        expect(ok.statusCode).toBe(200);
        expect(ok.json().user.role).toBe('user');
      } finally {
        await db.query("update users set role = 'admin', disabled = false where id = $1", [solo.id]);
        await db.query('update users set disabled = false where id = any($1::bigint[])', [others]);
      }
    });

    it('answers 400 for an empty change and 404 for a bad or unknown id', async () => {
      const u = await mkUser(uname('nochange'));
      const none = await call(app, 'PATCH', '/users/' + u.id, adminCookie, {});
      expect(none.statusCode).toBe(400);
      expect(none.json().error.code).toBe('invalid');
      expect((await call(app, 'PATCH', '/users/abc', adminCookie, { displayName: 'x' })).statusCode).toBe(404);
      expect((await call(app, 'PATCH', '/users/1;drop', adminCookie, { displayName: 'x' })).statusCode).toBe(404);
      expect((await call(app, 'PATCH', '/users/999999999', adminCookie, { displayName: 'x' })).statusCode).toBe(404);
      expect((await call(app, 'PATCH', '/users/' + u.id, adminCookie, { colour: 'red' })).statusCode).toBe(400);   /* unknown field */
    });
  });

  /* ---------- 6. profiles and calibrations ---------- */
  describe('profiles and calibrations', () => {
    const channels = {
      force: { conditioning: { id: 'amp-f1', gain: 2, offset_V: 0.1 } },
      displacement: { conditioning: { id: 'amp-d1', gain: 1, offset_V: 0 } },
    };
    const profile = (id: string, over: object = {}) => ({ id, name: 'Bench profile ' + id, channels, notes: 'draft', ...over });
    const path = { deviceType: 'esp32', adc: 'ads1115', bits: 16, fullScale_mV: 4096, mode: 'single-ended', input: 'A0', conditioningId: 'amp-f1', conditioningGain: 2, conditioningOffset_V: 0.1 };
    const cal = (id: string, profileId: string, over: object = {}) =>
      ({ id, profileId, quantity: 'force', unit: 'N', slope: 12.5, offset: -0.3, signalPath: path, note: 'bench check', ...over });

    it('creates a profile and never overwrites one', async () => {
      const r = await call(app, 'POST', '/device-profiles', adminCookie, profile('prof-dup'));
      expect(r.statusCode).toBe(201);
      expect(r.json().profile).toMatchObject({ id: 'prof-dup', name: 'Bench profile prof-dup', channels, notes: 'draft' });
      const dup = await call(app, 'POST', '/device-profiles', adminCookie, profile('prof-dup', { name: 'Changed circuit' }));
      expect(dup.statusCode).toBe(409);
      expect(dup.json().error.code).toBe('exists');
      const list = (await call(app, 'GET', '/device-profiles', adminCookie)).json().profiles as { id: string; name: string }[];
      expect(list.filter((p) => p.id === 'prof-dup')).toEqual([expect.objectContaining({ name: 'Bench profile prof-dup' })]);
    });

    it('rejects a bad profile', async () => {
      for (const bad of [profile('Bad ID'), profile('x'), profile('prof-empty', { channels: {} }), profile('prof-gain0', { channels: { force: { conditioning: { id: 'a', gain: 0, offset_V: 0 } } } }), profile('prof-noname', { name: '' })]) {
        expect((await call(app, 'POST', '/device-profiles', adminCookie, bad)).statusCode).toBe(400);
      }
    });

    it('rejects calibrations that are wrong, and keeps a good one as a draft', async () => {
      await call(app, 'POST', '/device-profiles', adminCookie, profile('prof-cal'));
      const post = (b: object) => call(app, 'POST', '/calibrations', adminCookie, b);
      expect((await post(cal('cal-x1', 'prof-cal', { signalPath: { ...path, conditioningId: 'amp-other' } }))).statusCode).toBe(400);
      expect((await post(cal('cal-x2', 'prof-cal', { signalPath: { ...path, conditioningGain: 3 } }))).statusCode).toBe(400);
      expect((await post(cal('cal-x3', 'prof-cal', { signalPath: { ...path, conditioningOffset_V: 0.2 } }))).statusCode).toBe(400);
      expect((await post(cal('cal-x4', 'prof-cal', { unit: 'mm' }))).statusCode).toBe(400);   /* force in mm */
      expect((await post(cal('cal-x5', 'prof-cal', { quantity: 'displacement' }))).statusCode).toBe(400);   /* displacement in N */
      expect((await post(cal('cal-x6', 'prof-cal', { slope: 0 }))).statusCode).toBe(400);
      expect((await post(cal('cal-x7', 'prof-missing'))).statusCode).toBe(400);
      expect((await post(cal('cal-x8', 'prof-cal', { origin: 'simulated' }))).statusCode).toBe(400);   /* unknown field */
      expect((await call(app, 'GET', '/calibrations?profile=prof-cal', adminCookie)).json().calibrations).toEqual([]);

      const r = await post(cal('cal-ok', 'prof-cal'));
      expect(r.statusCode).toBe(201);
      expect(r.json().calibration).toMatchObject({ id: 'cal-ok', profileId: 'prof-cal', quantity: 'force', unit: 'N', slope: 12.5, offset: -0.3, origin: 'measured', status: 'draft', approvedAt: null });
      expect((await call(app, 'GET', '/calibrations?profile=prof-cal', adminCookie)).json().calibrations[0].createdBy).toBe('root-admin');
      const dup = await post(cal('cal-ok', 'prof-cal', { slope: 99 }));
      expect(dup.statusCode).toBe(409);
      expect((await call(app, 'GET', '/calibrations?profile=prof-cal', adminCookie)).json().calibrations[0].slope).toBe(12.5);
    });

    it('lists only approved calibrations in the setup file, in the shape the app accepts', async () => {
      await call(app, 'POST', '/device-profiles', adminCookie, profile('prof-setup'));
      for (const id of ['cal-draft', 'cal-approved', 'cal-retired']) expect((await call(app, 'POST', '/calibrations', adminCookie, cal(id, 'prof-setup', { slope: id === 'cal-approved' ? 20 : 5 }))).statusCode).toBe(201);
      const setup = async () => call(app, 'GET', '/setup-files/prof-setup', adminCookie);

      /* a profile with nothing approved still makes a loadable file */
      const none = await setup();
      expect(none.statusCode).toBe(200);
      expect(none.json().calibrations).toEqual([]);
      expect(() => parseSetupFile(none.body)).not.toThrow();

      expect((await call(app, 'POST', '/calibrations/cal-approved/approve', adminCookie)).statusCode).toBe(200);
      expect((await call(app, 'POST', '/calibrations/cal-retired/approve', adminCookie)).statusCode).toBe(200);
      expect((await call(app, 'POST', '/calibrations/cal-retired/retire', adminCookie)).statusCode).toBe(200);

      const r = await setup();
      expect(r.statusCode).toBe(200);
      const body = r.json();
      expect(body.profile).toEqual({ id: 'prof-setup', name: 'Bench profile prof-setup', channels });
      expect(body.calibrations.map((c: { id: string }) => c.id)).toEqual(['cal-approved']);
      const parsed = parseSetupFile(r.body);
      expect(parsed.profile.id).toBe('prof-setup');
      expect(parsed.calibrations).toHaveLength(1);
      expect(parsed.calibrations[0]).toMatchObject({ id: 'cal-approved', quantity: 'force', unit: 'N', slope: 20, offset: -0.3, origin: 'measured', signalPath: path });
      expect(Number.isNaN(Date.parse(parsed.calibrations[0]?.createdAt ?? ''))).toBe(false);
    });

    it('approves a draft once; a second approval is 409; an unknown id is 404', async () => {
      await call(app, 'POST', '/device-profiles', adminCookie, profile('prof-appr'));
      await call(app, 'POST', '/calibrations', adminCookie, cal('cal-appr', 'prof-appr'));
      const first = await call(app, 'POST', '/calibrations/cal-appr/approve', adminCookie);
      expect(first.statusCode).toBe(200);
      expect(first.json().calibration.status).toBe('approved');
      expect(first.json().calibration.approvedAt).toBeTruthy();
      const listed = (await call(app, 'GET', '/calibrations?profile=prof-appr', adminCookie)).json().calibrations[0];
      expect(listed).toMatchObject({ status: 'approved', approvedBy: 'root-admin', createdBy: 'root-admin' });
      const second = await call(app, 'POST', '/calibrations/cal-appr/approve', adminCookie);
      expect(second.statusCode).toBe(409);
      expect(second.json().error.code).toBe('wrong_state');
      expect((await call(app, 'POST', '/calibrations/cal-nope/approve', adminCookie)).statusCode).toBe(404);
    });

    it('does not approve a retired calibration again', async () => {
      await call(app, 'POST', '/device-profiles', adminCookie, profile('prof-ret'));
      await call(app, 'POST', '/calibrations', adminCookie, cal('cal-ret', 'prof-ret'));
      expect((await call(app, 'POST', '/calibrations/cal-ret/retire', adminCookie)).json().calibration.status).toBe('retired');   /* a draft can be retired */
      expect((await call(app, 'POST', '/calibrations/cal-ret/approve', adminCookie)).statusCode).toBe(409);
      expect((await call(app, 'POST', '/calibrations/cal-ret/retire', adminCookie)).statusCode).toBe(409);
    });

    it('answers 404 for the setup file of an unknown profile', async () => {
      const r = await call(app, 'GET', '/setup-files/no-such-profile', adminCookie);
      expect(r.statusCode).toBe(404);
      expect(r.json().error.code).toBe('not_found');
    });

    it('names who approved in the approve answer', async () => {
      await call(app, 'POST', '/device-profiles', adminCookie, profile('prof-who'));
      await call(app, 'POST', '/calibrations', adminCookie, cal('cal-who', 'prof-who'));
      const r = await call(app, 'POST', '/calibrations/cal-who/approve', adminCookie);
      expect(r.json().calibration).toMatchObject({ approvedBy: 'root-admin', createdBy: 'root-admin' });
    });

    it('answers 404 when retiring a calibration that does not exist', async () => {
      const r = await call(app, 'POST', '/calibrations/cal-never-made/retire', adminCookie);
      expect(r.statusCode).toBe(404);
    });
  });

  /* ---------- 7. test sessions ---------- */
  describe('test sessions', () => {
    const T0 = 1_700_000_000_000;
    type FileOpts = { recordedFrom?: 'real' | 'simulated'; test?: 'uniaxial' | 'relaxation'; deviceId?: string; sw?: string; hello?: boolean; material?: string; samples?: number; calibrations?: object[] };
    function sessionFile(o: FileOpts = {}) {
      const lines: string[] = [], at: number[] = [];
      let t = T0;
      const push = (x: object) => { lines.push(JSON.stringify(x)); at.push(t); t += 10; };
      const boot = 'boot-' + (o.deviceId ?? 'sim-01');
      if (o.hello !== false) push({ v: 1, type: 'hello', device_id: o.deviceId ?? 'sim-01', device_type: 'esp32', sw_version: o.sw ?? 'sim-1.0.0', boot_id: boot, time_unit: 'us' });
      push({ v: 1, type: 'channels', channels: [{ ch: 'force', ref: 'f1' }, { ch: 'displacement', ref: 'd1' }] });
      push({ v: 1, type: 'settings', rate_hz: 100, bits: 16, fullScale_mV: 4096 });
      const count = o.samples ?? 5;
      for (let i = 0; i < count; i++) for (const ch of ['force', 'displacement']) push({ v: 1, type: 'sample', boot_id: boot, seq: i, t: i * 10000, ch, raw: 1000 + i * 7, ref: ch === 'force' ? 'f1' : 'd1' });
      return {
        format: 'tensile-tester-session', version: 1, savedAt: new Date(t).toISOString(), appVersion: '0.1.0',
        recordedFrom: o.recordedFrom ?? 'real', test: o.test ?? 'uniaxial',
        setup: { material: o.material ?? 'Rabbit tissue', specimenId: 'S-01', speed: '1', preload: true },
        profile: null, calibrations: o.calibrations ?? [], lines, receivedAt_ms: at,
      };
    }
    const upload = (cookie: string, file: object, extra: object = {}) => call(app, 'POST', '/test-sessions', cookie, { file, summary: { peakForce_N: 12.5, uts_MPa: null }, notes: 'first run', ...extra });
    it('saves a recorded session, counts the sample lines, and labels it', async () => {
      const u = await mkSignedIn();
      const file = sessionFile({ samples: 5 });
      const r = await upload(u.cookie, file);
      expect(r.statusCode).toBe(201);
      expect(r.json()).toMatchObject({ sampleCount: 10, id: expect.stringMatching(/^\d+$/) });
      expect(r.json().sha256).toMatch(/^[0-9a-f]{64}$/);

      const list = (await call(app, 'GET', '/test-sessions', u.cookie)).json().sessions as Record<string, unknown>[];
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({
        id: r.json().id, owner: u.username, testType: 'uniaxial', recordedFrom: 'real', data: 'Measured', material: 'Rabbit tissue', specimenId: 'S-01',
        calibrationSource: 'none', calibrationLabel: 'No calibration (voltages only)',
        deviceId: 'sim-01', deviceType: 'esp32', deviceSoftware: 'sim-1.0.0', appVersion: '0.1.0', sampleCount: 10, notes: 'first run', summary: { peakForce_N: 12.5, uts_MPa: null },
      });
      expect(Math.abs(Date.parse(list[0]?.startedAt as string) - (T0 + 30))).toBeLessThan(2);   /* arrival time of the first sample line */
    });

    it('saves a session file made by the app\'s own controller, unchanged', async () => {
      /* the recording is a test stand-in from the test simulator, not data from a real tester */
      const { dev, c } = rig();
      ready(c);
      await c.connect();
      c.useSetup(measuredSetup(c));
      await c.startRecording();
      move(dev, c);
      dev.step(2400);
      c.stopRecording();
      const file = c.sessionFile()!;
      const u = await mkSignedIn();
      const r = await upload(u.cookie, file);
      expect(r.statusCode).toBe(201);
      const back = await call(app, 'GET', '/test-sessions/' + r.json().id + '/file', u.cookie);
      expect(back.statusCode).toBe(200);
      expect(sha(back.rawPayload)).toBe(r.json().sha256);
      expect(JSON.parse(back.body).lines).toEqual(file.lines);
    });

    it('treats a cookie that cannot be decoded as signed out, not as a server error', async () => {
      const r = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { ...APP, cookie: 'tt_session=%E0%A4%A' } });
      expect(r.statusCode).toBe(401);
    });

    it('refuses arrival times outside the years 2000 to 2100', async () => {
      const u = await mkSignedIn();
      for (const bad of [-5, 1e300, 9_999_999_999_999_999]) {
        const f = sessionFile({ samples: 2 }) as { receivedAt_ms: number[] };
        f.receivedAt_ms[0] = bad;
        expect((await upload(u.cookie, f)).statusCode).toBe(400);
      }
      expect((await call(app, 'GET', '/test-sessions', u.cookie)).json().sessions).toEqual([]);
    });

    it('answers 409 when the same person saves the same file twice, and lets another person save it', async () => {
      const a = await mkSignedIn(), b = await mkSignedIn();
      const f = sessionFile({ samples: 3, material: 'Duplicate check' });
      const first = await upload(a.cookie, f);
      expect(first.statusCode).toBe(201);
      const again = await upload(a.cookie, f);
      expect(again.statusCode).toBe(409);
      expect(again.json().error.code).toBe('duplicate');
      expect(again.json().error.message).toContain(first.json().id);
      expect((await call(app, 'GET', '/test-sessions', a.cookie)).json().sessions).toHaveLength(1);
      expect((await upload(b.cookie, f)).statusCode).toBe(201);
    });

    it('limits saves to 30 a minute for each person', async () => {
      const a = await mkSignedIn(), other = await mkSignedIn();
      let last = 0;
      for (let i = 0; i < 31; i++) last = (await upload(a.cookie, sessionFile({ samples: 1, material: 'Rate ' + i }))).statusCode;
      expect(last).toBe(429);
      expect((await upload(other.cookie, sessionFile({ samples: 1, material: 'Rate other' }))).statusCode).toBe(201);
    }, 60_000);

    it('clears sign-ins that ran out when someone signs in', async () => {
      const u = await mkUser(uname('purge'));
      await db.query("insert into login_sessions (token_hash, user_id, expires_at) values ($1, $2, now() - interval '1 hour')", [Buffer.from('expired-' + u.id), u.id]);
      const before = (await db.query('select count(*)::int as n from login_sessions where expires_at < now()')).rows[0].n;
      expect(before).toBeGreaterThan(0);
      await login(app, u.username);
      expect((await db.query('select count(*)::int as n from login_sessions where expires_at < now()')).rows[0].n).toBe(0);
    });

    it('refuses simulated data and keeps nothing', async () => {
      const u = await mkSignedIn();
      const r = await upload(u.cookie, sessionFile({ recordedFrom: 'simulated' }));
      expect(r.statusCode).toBe(400);
      expect(r.json().error.code).toBe('simulated');
      expect((await call(app, 'GET', '/test-sessions', u.cookie)).json().sessions).toEqual([]);
    });

    it('refuses a line that is not a device message, and arrival times that do not match the lines', async () => {
      const u = await mkSignedIn();
      const f = sessionFile();
      const bad = (lines: string[], why: RegExp) => async () => {
        const r = await upload(u.cookie, { ...f, lines: [...f.lines, ...lines], receivedAt_ms: [...f.receivedAt_ms, ...lines.map(() => T0)] });
        expect(r.statusCode).toBe(400);
        expect(r.json().error.message).toMatch(why);
      };
      await bad(['not json'], /Line 14 .* not a message from the device/)();
      await bad([JSON.stringify({ v: 1, type: 'start_stream', id: 1 })], /not a message from the device/)();   /* a request, which only the app sends */
      await bad([JSON.stringify({ v: 2, type: 'sample' })], /not a message from the device/)();
      await bad(['[1,2]'], /not a message from the device/)();
      await bad(['null'], /not a message from the device/)();
      const short = await upload(u.cookie, { ...f, receivedAt_ms: f.receivedAt_ms.slice(1) });
      expect(short.statusCode).toBe(400);
      expect(short.json().error.message).toContain('one arrival time for each line');
      expect((await upload(u.cookie, { ...f, receivedAt_ms: f.receivedAt_ms.map((x, i) => (i === 3 ? null : x)) })).statusCode).toBe(400);
      expect((await call(app, 'GET', '/test-sessions', u.cookie)).json().sessions).toEqual([]);
    });

    it('labels where the calibration came from, and saves the test either way', async () => {
      const channels = { force: { conditioning: { id: 'amp-lab', gain: 2, offset_V: 0 } } };
      await call(app, 'POST', '/device-profiles', adminCookie, { id: 'prof-labcal', name: 'Lab cal', channels });
      const signalPath = { deviceType: 'esp32', adc: 'ads1115', bits: 16, fullScale_mV: 4096, mode: 'single-ended', input: 'A0', conditioningId: 'amp-lab', conditioningGain: 2, conditioningOffset_V: 0 };
      const mkCal = (id: string) => call(app, 'POST', '/calibrations', adminCookie, { id, profileId: 'prof-labcal', quantity: 'force', unit: 'N', slope: 12.5, offset: -0.25, signalPath });
      await mkCal('cal-lab-ok'); await call(app, 'POST', '/calibrations/cal-lab-ok/approve', adminCookie);
      await mkCal('cal-lab-draft');
      const u = await mkSignedIn();
      const source = async (calibrations: object[]) => {
        const r = await upload(u.cookie, sessionFile({ calibrations }));
        expect(r.statusCode).toBe(201);
        const s = (await call(app, 'GET', '/test-sessions/' + r.json().id, u.cookie)).json().session;
        expect(s.calibrationSource).toBe(r.json().calibrationSource);
        return [s.calibrationSource, s.calibrationLabel];
      };
      const ok = { id: 'cal-lab-ok', quantity: 'force', slope: 12.5, offset: -0.25 };
      expect(await source([ok])).toEqual(['lab', 'Lab-approved calibration']);
      expect(await source([{ ...ok, slope: 12.6 }])).toEqual(['not-from-lab', 'Calibration not from the lab']);   /* same id, other numbers */
      expect((await source([{ ...ok, quantity: 'displacement' }]))[0]).toBe('not-from-lab');
      expect((await source([{ ...ok, id: 'cal-lab-draft' }]))[0]).toBe('not-from-lab');   /* not approved */
      expect((await source([{ id: 'cal-made-elsewhere', slope: 1, offset: 0 }]))[0]).toBe('not-from-lab');
      expect((await source([ok, { id: 'cal-made-elsewhere', slope: 1 }]))[0]).toBe('not-from-lab');   /* one unknown is enough */
      expect(await source([])).toEqual(['none', 'No calibration (voltages only)']);
    });

    it('records the ids of the calibrations in the file', async () => {
      const u = await mkSignedIn();
      const file = sessionFile({ recordedFrom: 'real', deviceId: 'bench-cal-01', calibrations: [{ id: 'cal-a', slope: 1 }, { id: 'cal-b', slope: 2 }] });
      const r = await upload(u.cookie, file);
      expect(r.statusCode).toBe(201);
      expect((await call(app, 'GET', '/test-sessions/' + r.json().id, u.cookie)).json().session.calibrationIds).toEqual(['cal-a', 'cal-b']);
    });

    it('shows a test only to its owner (another user gets 404, not 403) and to admins', async () => {
      const owner = await mkSignedIn(), other = await mkSignedIn();
      const r = await upload(owner.cookie, sessionFile());
      const id = r.json().id as string;
      expect((await call(app, 'GET', '/test-sessions', other.cookie)).json().sessions).toEqual([]);
      for (const url of ['/test-sessions/' + id, '/test-sessions/' + id + '/file']) {
        const x = await call(app, 'GET', url, other.cookie);
        expect(x.statusCode).toBe(404);
        expect(x.json().error.code).toBe('not_found');
      }
      expect((await call(app, 'GET', '/test-sessions/' + id, owner.cookie)).statusCode).toBe(200);
      expect((await call(app, 'GET', '/test-sessions/' + id, adminCookie)).statusCode).toBe(200);
      expect((await call(app, 'GET', '/test-sessions/abc', owner.cookie)).statusCode).toBe(404);
      expect((await call(app, 'GET', '/test-sessions/999999999', owner.cookie)).statusCode).toBe(404);
      /* a user cannot widen the list with ?owner= */
      const sneaky = await call(app, 'GET', '/test-sessions?owner=' + owner.id, other.cookie);
      expect(sneaky.json().sessions).toEqual([]);
    });

    it('lets an admin see everything and filter by owner', async () => {
      const a = await mkSignedIn(), b = await mkSignedIn();
      const ra = await upload(a.cookie, sessionFile({ material: 'Skin A' })), rb = await upload(b.cookie, sessionFile({ material: 'Skin B' }));
      const ids = (r: { json: () => { sessions: { id: string }[] } }) => r.json().sessions.map((s) => s.id);
      const all = ids(await call(app, 'GET', '/test-sessions', adminCookie));
      expect(all).toEqual(expect.arrayContaining([ra.json().id, rb.json().id]));
      expect(ids(await call(app, 'GET', '/test-sessions?owner=' + a.id, adminCookie))).toEqual([ra.json().id]);
      expect(ids(await call(app, 'GET', '/test-sessions?owner=' + b.id, adminCookie))).toEqual([rb.json().id]);
      expect(ids(await call(app, 'GET', '/test-sessions?owner=' + a.id + '&limit=1', adminCookie))).toHaveLength(1);
    });

    it('rejects a non-numeric ?owner= from an admin', async () => {
      expect((await call(app, 'GET', '/test-sessions?owner=abc', adminCookie)).statusCode).toBe(400);
    });

    it('returns the saved file exactly as uploaded, and the sha256 matches the body', async () => {
      const u = await mkSignedIn();
      const file = sessionFile({ samples: 8, calibrations: [{ id: 'cal-a', quantity: 'force', slope: 1.5, signalPath: { adc: 'ads1115' } }] });
      const r = await upload(u.cookie, file);
      const f = await call(app, 'GET', '/test-sessions/' + r.json().id + '/file', u.cookie);
      expect(f.statusCode).toBe(200);
      expect(String(f.headers['content-type'])).toContain('application/json');
      expect(String(f.headers['content-disposition'])).toContain('attachment; filename="test-' + r.json().id + '.session.json"');
      expect(JSON.parse(f.body)).toEqual(file);
      expect(f.body).toBe(JSON.stringify(file));
      expect(sha(f.rawPayload)).toBe(r.json().sha256);
      const row = (await db.query('select sha256, bytes_raw from session_files where session_id = $1', [r.json().id])).rows[0];
      expect(row.sha256).toBe(r.json().sha256);
      expect(row.bytes_raw).toBe(Buffer.byteLength(JSON.stringify(file)));
    });

    it('lets the admin download another person\'s file', async () => {
      const u = await mkSignedIn();
      const file = sessionFile();
      const r = await upload(u.cookie, file);
      expect((await call(app, 'GET', '/test-sessions/' + r.json().id + '/file', adminCookie)).body).toBe(JSON.stringify(file));
    });

    it('refuses a file with no hello line, and one that is not a session file', async () => {
      const u = await mkSignedIn();
      const noHello = await upload(u.cookie, sessionFile({ hello: false }));
      expect(noHello.statusCode).toBe(400);
      expect(noHello.json().error.code).toBe('invalid');
      const f = sessionFile();
      expect((await upload(u.cookie, { ...f, format: 'something-else' })).statusCode).toBe(400);
      expect((await upload(u.cookie, { ...f, version: 2 })).statusCode).toBe(400);
      expect((await upload(u.cookie, { ...f, recordedFrom: 'replayed' })).statusCode).toBe(400);
      expect((await upload(u.cookie, { ...f, test: 'fatigue' })).statusCode).toBe(400);
      expect((await upload(u.cookie, { ...f, lines: [] })).statusCode).toBe(400);
      expect((await upload(u.cookie, { ...f, lines: [1, 2] })).statusCode).toBe(400);
      expect((await call(app, 'POST', '/test-sessions', u.cookie, { summary: {} })).statusCode).toBe(400);   /* no file */
      expect((await call(app, 'POST', '/test-sessions', u.cookie, { file: f, extra: 1 })).statusCode).toBe(400);   /* unknown field */
      expect((await call(app, 'GET', '/test-sessions', u.cookie)).json().sessions).toEqual([]);   /* nothing was kept */
    });

    it('refuses a summary with a value that is not a number', async () => {
      const u = await mkSignedIn();
      const file = sessionFile();
      for (const summary of [{ peak: 'big' }, { peak: true }, { peak: '1e999' }, { peak: { n: 1 } }]) {
        expect((await upload(u.cookie, file, { summary })).statusCode).toBe(400);
      }
      expect((await upload(u.cookie, file, { summary: { peak: 1, none: null } })).statusCode).toBe(201);
    });

    it('records a real device in devices and updates it on the next upload', async () => {
      const u = await mkSignedIn();
      const id = uname('bench-esp');
      expect((await upload(u.cookie, sessionFile({ recordedFrom: 'real', deviceId: id, sw: 'fw-1.0.0' }))).statusCode).toBe(201);
      let rows = (await db.query('select * from devices where device_id = $1', [id])).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ device_type: 'esp32', last_software: 'fw-1.0.0' });
      expect((await upload(u.cookie, sessionFile({ recordedFrom: 'real', deviceId: id, sw: 'fw-1.1.0' }))).statusCode).toBe(201);
      rows = (await db.query('select * from devices where device_id = $1', [id])).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].last_software).toBe('fw-1.1.0');
      expect(rows[0].last_seen.getTime()).toBeGreaterThanOrEqual(rows[0].first_seen.getTime());


      const real = (await call(app, 'GET', '/test-sessions', u.cookie)).json().sessions.find((s: { deviceId: string }) => s.deviceId === id);
      expect(real).toMatchObject({ recordedFrom: 'real', data: 'Measured' });
    });

    it('answers 413 for a body over the limit', async () => {
      const small = make({ config: { ...config, bodyLimitBytes: 1000 } });
      const u = await mkSignedIn();
      const r = await call(small, 'POST', '/test-sessions', u.cookie, { file: sessionFile({ samples: 20 }), summary: {}, notes: '' });
      expect(r.statusCode).toBe(413);
      expect(r.json().error.code).toBe('too_large');
      expect((await call(small, 'GET', '/auth/me', u.cookie)).statusCode).toBe(200);   /* still serving */
      expect((await call(app, 'GET', '/test-sessions', u.cookie)).json().sessions).toEqual([]);
    });
  });

  /* ---------- 8. audit ---------- */
  describe('audit record', () => {
    type Entry = { id: string; action: string; username: string | null; detail: Record<string, unknown> };
    const entries = async () => (await call(app, 'GET', '/audit', adminCookie)).json().entries as Entry[];

    it('records sign-in, user creation, calibration approval and session upload, newest first, without passwords', async () => {
      const secret = 'unique-secret-pw-1', patched = 'patched-secret-xyz-2', guess = 'wrong-guess-pw-9';
      const name = uname('aud');
      const created = await call(app, 'POST', '/users', adminCookie, { username: name, displayName: 'Audit Person', role: 'user', password: secret });
      expect(created.statusCode).toBe(201);
      expect((await call(app, 'POST', '/auth/login', null, { username: name, password: guess })).statusCode).toBe(401);
      await login(app, name, secret);
      const chg = await call(app, 'PATCH', '/users/' + created.json().user.id, adminCookie, { password: patched });
      expect(chg.statusCode).toBe(200);

      const channels = { force: { conditioning: { id: 'amp-a', gain: 1, offset_V: 0 } } };
      await call(app, 'POST', '/device-profiles', adminCookie, { id: 'prof-audit', name: 'Audit', channels });
      const signalPath = { deviceType: 'esp32', adc: 'ads1115', bits: 16, fullScale_mV: 4096, mode: 'single-ended', input: 'A0', conditioningId: 'amp-a', conditioningGain: 1, conditioningOffset_V: 0 };
      await call(app, 'POST', '/calibrations', adminCookie, { id: 'cal-audit', profileId: 'prof-audit', quantity: 'force', unit: 'N', slope: 1, offset: 0, signalPath });
      expect((await call(app, 'POST', '/calibrations/cal-audit/approve', adminCookie)).statusCode).toBe(200);

      const T = 1_700_000_000_000;
      const lines = [JSON.stringify({ v: 1, type: 'hello', device_id: 'aud-dev', device_type: 'esp32', sw_version: '1' }), JSON.stringify({ v: 1, type: 'sample', ch: 'force', raw: 1 })];
      const file = { format: 'tensile-tester-session', version: 1, savedAt: 'x', appVersion: '0.1.0', recordedFrom: 'real', test: 'uniaxial', setup: {}, profile: null, calibrations: [], lines, receivedAt_ms: [T, T + 1] };
      const own = await login(app, name, patched);
      expect((await call(app, 'POST', '/test-sessions', own, { file })).statusCode).toBe(403);   /* a temporary password must be changed first */
      expect((await call(app, 'POST', '/auth/password', own, { current: patched, next: 'own-chosen-pw-77' })).statusCode).toBe(200);
      const saved = await call(app, 'POST', '/test-sessions', own, { file });
      expect(saved.statusCode).toBe(201);

      const list = await entries();
      const find = (action: string, pred: (e: Entry) => boolean = () => true) => list.find((e) => e.action === action && pred(e));
      expect(find('user_created', (e) => e.detail.username === name)).toMatchObject({ username: 'root-admin', detail: { role: 'user' } });
      expect(find('login', (e) => e.username === name)).toBeTruthy();
      expect(find('login_failed', (e) => e.username === name)).toBeTruthy();   /* tied to the known user; the typed name is not stored */
      expect(find('user_changed', (e) => e.detail.id === created.json().user.id)?.detail.password).toBe('reset');
      expect(find('profile_created', (e) => e.detail.id === 'prof-audit')).toBeTruthy();
      expect(find('calibration_created', (e) => e.detail.id === 'cal-audit')).toBeTruthy();
      expect(find('calibration_approved', (e) => e.detail.id === 'cal-audit')).toMatchObject({ username: 'root-admin' });
      expect(find('session_saved', (e) => e.detail.id === saved.json().id)).toMatchObject({ username: name, detail: { samples: 1, calibration: 'none' } });

      const ids = list.map((e) => BigInt(e.id));
      for (let i = 1; i < ids.length; i++) expect(ids[i - 1]).toBeGreaterThan(ids[i] as bigint);
      expect(list.length).toBeLessThanOrEqual(200);

      const text = JSON.stringify(list);
      for (const pw of [secret, patched, guess, PW, 'own-chosen-pw-77']) expect(text).not.toContain(pw);
      expect(text).not.toMatch(/argon2/);
    });
  });

  /* ---------- 11. test methods ---------- */
  describe('test methods', () => {
    const body = (name: string, extra: object = {}) => ({ name, test: 'uniaxial', fields: { material: 'Skin', L0: '25', width: '5', thickness: '1.2', speed: '30', offsetOn: false }, instructions: 'Clamp gently.', ...extra });
    it('admins save methods and new revisions; signed-in users list the current revision only', async () => {
      const r1 = await call(app, 'POST', '/methods', adminCookie, body('Skin strip'));
      expect(r1.statusCode).toBe(201);
      const m1 = r1.json().method;
      expect(m1).toMatchObject({ name: 'Skin strip', revision: 1, test: 'uniaxial', archived: false, createdBy: 'root-admin' });
      expect(m1.id).toMatch(/^lm-\d+$/);
      const r2 = await call(app, 'POST', '/methods', adminCookie, body('Skin strip', { fields: { speed: '10' }, replaces: { key: m1.id, revision: 1 } }));
      expect(r2.statusCode).toBe(201);
      expect(r2.json().method).toMatchObject({ id: m1.id, revision: 2 });
      const u = await mkSignedIn();
      const list = (await call(app, 'GET', '/methods', u.cookie)).json().methods.filter((m: { id: string }) => m.id === m1.id);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ revision: 2, fields: { speed: '10' } });
      /* both revisions are kept */
      expect((await db.query('select revision from test_methods where method_key = $1 order by revision', [m1.id])).rows.map((r) => r.revision)).toEqual([1, 2]);
    });
    it('refuses a change made from an old revision, users changing methods, and a specimen ID in a method', async () => {
      const m = (await call(app, 'POST', '/methods', adminCookie, body('Relax hold'))).json().method;
      await call(app, 'POST', '/methods', adminCookie, body('Relax hold', { replaces: { key: m.id, revision: 1 } }));
      const stale = await call(app, 'POST', '/methods', adminCookie, body('Relax hold', { replaces: { key: m.id, revision: 1 } }));
      expect(stale.statusCode).toBe(409);
      expect(stale.json().error.code).toBe('changed');
      const u = await mkSignedIn();
      expect((await call(app, 'POST', '/methods', u.cookie, body('Mine'))).statusCode).toBe(403);
      expect((await call(app, 'POST', `/methods/${m.id}/archive`, u.cookie, {})).statusCode).toBe(403);
      expect((await call(app, 'GET', '/methods', null)).statusCode).toBe(401);
      for (const fields of [{ specimenId: 'S-1' }, { notes: 'n' }, { colour: 'red' }, { speed: 30 }, { offsetOn: 'yes' }, { material: 'x'.repeat(201) }]) {
        expect((await call(app, 'POST', '/methods', adminCookie, body('Bad', { fields }))).statusCode, JSON.stringify(fields).slice(0, 40)).toBe(400);
      }
      expect((await call(app, 'POST', '/methods', adminCookie, body('Bad', { test: 'fatigue' }))).statusCode).toBe(400);
      expect((await call(app, 'POST', '/methods', adminCookie, body('Bad', { replaces: { key: 'nope', revision: 1 } }))).statusCode).toBe(400);
      expect((await call(app, 'POST', '/methods', adminCookie, body('Bad', { replaces: { key: 'lm-999999', revision: 1 } }))).statusCode).toBe(404);
      expect((await call(app, 'POST', '/methods', adminCookie, body('  '))).statusCode).toBe(400);
    });
    it('archiving hides a method without changing earlier rows', async () => {
      const m = (await call(app, 'POST', '/methods', adminCookie, body('Old method'))).json().method;
      expect((await call(app, 'POST', `/methods/${m.id}/archive`, adminCookie, {})).statusCode).toBe(200);
      expect((await call(app, 'POST', `/methods/${m.id}/archive`, adminCookie, {})).statusCode).toBe(404);
      expect((await call(app, 'GET', '/methods', adminCookie)).json().methods.some((x: { id: string }) => x.id === m.id)).toBe(false);
      const rows = (await db.query('select revision, archived from test_methods where method_key = $1 order by revision', [m.id])).rows;
      expect(rows).toEqual([{ revision: 1, archived: false }, { revision: 2, archived: true }]);
      const again = await call(app, 'POST', '/methods', adminCookie, body('Old method', { replaces: { key: m.id, revision: 2 } }));
      expect(again.json().error.code).toBe('archived');
    });
  });

  /* ---------- 10. migrations ---------- */
  describe('migrations', () => {
    it('applied 001_initial.sql the first time, and applies nothing the second time', async () => {
      expect(migratedFirst).toEqual(['001_initial.sql', '002_test_methods.sql', '003_calibration_source.sql']);
      expect(await migrate(db)).toEqual([]);
      const rows = (await db.query('select version, applied_at from schema_migrations order by version')).rows;
      expect(rows.map((r) => r.version)).toContain('001_initial.sql');
      expect(rows.filter((r) => r.version === '001_initial.sql')).toHaveLength(1);
      expect(rows[0].applied_at).toBeInstanceOf(Date);
    });
    it('is safe to run twice at the same time', async () => {
      expect(await Promise.all([migrate(db), migrate(db)])).toEqual([[], []]);
    });
  });

  /* ---------- 9. database restart (keep last: it stops the server) ---------- */
  describe('database restart', () => {
    it('answers 503 while the database is down, does not crash, and recovers with the same pool', async () => {
      const a = make();
      const u = await mkSignedIn();
      expect((await call(a, 'GET', '/test-sessions', u.cookie)).statusCode).toBe(200);

      tdb.pause();
      const health = await a.inject({ method: 'GET', url: '/api/v1/health' });
      expect(health.statusCode).toBe(503);
      expect(health.json()).toMatchObject({ ok: false, database: 'down' });
      const list = await call(a, 'GET', '/test-sessions', u.cookie);
      expect(list.statusCode).toBe(503);
      expect(list.json().error.code).toBe('database_unavailable');
      const anon = await call(a, 'POST', '/auth/login', null, { username: u.username, password: PW });
      expect(anon.statusCode).toBe(503);
      expect(anon.json().error.code).toBe('database_unavailable');

      tdb.resume();
      let ok = false;
      for (let i = 0; i < 25 && !ok; i++) {
        ok = (await a.inject({ method: 'GET', url: '/api/v1/health' })).statusCode === 200;
        if (!ok) await new Promise((r) => setTimeout(r, 200));
      }
      expect(ok).toBe(true);
      expect((await a.inject({ method: 'GET', url: '/api/v1/health' })).json()).toMatchObject({ ok: true, database: 'up' });
      const again = await call(a, 'GET', '/test-sessions', u.cookie);   /* the same cookie: the login rows survived */
      expect(again.statusCode).toBe(200);
      expect((await call(a, 'POST', '/auth/login', null, { username: u.username, password: PW })).statusCode).toBe(200);
    }, 60_000);
  });
});
