import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { hashPassword } from '../src/auth';
import type { Config } from '../src/config';
import { connect, migrate } from '../src/db';
import type { Db } from '../src/db';
import { PG_BIN, startTestDb } from './test-db';
import type { TestDb } from './test-db';

const config: Config = { databaseUrl: '', host: '127.0.0.1', port: 0, cookieSecure: false, sessionHours: 12, trustProxy: false, bodyLimitBytes: 64 * 1024 * 1024 };

describe.skipIf(!PG_BIN)('API smoke test against a real PostgreSQL', () => {
  let tdb: TestDb, db: Db;
  beforeAll(async () => { tdb = await startTestDb(); db = connect(tdb.url); expect(await migrate(db)).toEqual(['001_initial.sql', '002_test_methods.sql']); }, 60_000);
  afterAll(async () => { await db?.end(); tdb?.stop(); });

  it('applies migrations once, signs in, and answers who is signed in', async () => {
    expect(await migrate(db)).toEqual([]);
    await db.query("insert into users (username, role, password_hash) values ('ada', 'admin', $1)", [await hashPassword('correct horse battery')]);
    const app = buildApp({ db, config });
    expect((await app.inject({ method: 'GET', url: '/api/v1/health' })).json()).toMatchObject({ ok: true, database: 'up' });
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { 'x-tensile-client': 'app' }, payload: { username: 'ada', password: 'correct horse battery' } });
    expect(login.statusCode).toBe(200);
    const cookie = String(login.headers['set-cookie']).split(';')[0] as string;
    expect(String(login.headers['set-cookie'])).toMatch(/HttpOnly; SameSite=Strict/);
    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie } });
    expect(me.json()).toMatchObject({ user: { username: 'ada', role: 'admin' } });
    await app.close();
  });
});
