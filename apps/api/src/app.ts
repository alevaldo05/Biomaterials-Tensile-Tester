/* The API, under /api/v1. One back end for both front ends: the tester app uses all of it; the website can use the
   public parts later. Every route checks who is asking; admin routes check the role on the server. The app's
   "View as user" only changes what the admin's screen shows, never what the server allows. */
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { COOKIE, dummyHash, hashPassword, LoginLimiter, newToken, passwordProblem, readCookie, sessionCookie, tokenHash, verifyPassword } from './auth';
import type { Config } from './config';
import type { Db } from './db';
import { CalibrationBody, LoginBody, MethodBody, NewUserBody, PasswordBody, problem, ProfileBody, UploadBody, UserPatch } from './schemas';

export const API_VERSION = '0.1.0';

export interface User { id: string; username: string; displayName: string; role: 'admin' | 'user'; mustChangePassword: boolean }
declare module 'fastify' { interface FastifyRequest { user: User | null } }

class HttpError extends Error { constructor(readonly status: number, readonly code: string, message: string) { super(message); } }
const fail = (status: number, code: string, message: string): never => { throw new HttpError(status, code, message); };
function parse<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const r = schema.safeParse(body);
  if (!r.success) return fail(400, 'invalid', problem(r.error));
  return r.data;
}
const toUser = (r: { id: string; username: string; display_name: string; role: 'admin' | 'user'; must_change_password: boolean }): User =>
  ({ id: String(r.id), username: r.username, displayName: r.display_name, role: r.role, mustChangePassword: r.must_change_password });

export function buildApp(o: { db: Db; config: Config; logger?: boolean; limiter?: LoginLimiter }): FastifyInstance {
  const { db, config } = o;
  const limiter = o.limiter ?? new LoginLimiter();
  const app = Fastify({ logger: o.logger ?? false, bodyLimit: config.bodyLimitBytes, trustProxy: config.trustProxy });
  app.decorateRequest('user', null);

  const audit = (userId: string | null, action: string, detail: object = {}) =>
    db.query('insert into audit_log (user_id, action, detail) values ($1, $2, $3)', [userId, action, JSON.stringify(detail)]).catch(() => undefined);

  app.addHook('onSend', async (_req, reply) => {
    reply.header('cache-control', 'no-store');
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
  });

  /* Changes need the app's own header. A page on another site cannot add it without the browser asking first,
     and the API never says yes to that, so another site cannot act with a signed-in person's cookie. */
  app.addHook('onRequest', async (req) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-tensile-client'] !== 'app') fail(403, 'forbidden', 'Missing the app header.');
    const token = readCookie(req.headers.cookie, COOKIE);
    if (!token) return;
    const r = await db.query(
      `update login_sessions s set last_seen_at = now() from users u
        where s.token_hash = $1 and s.expires_at > now() and u.id = s.user_id and not u.disabled
        returning u.id, u.username, u.display_name, u.role, u.must_change_password`, [tokenHash(token)]);
    if (r.rows[0]) req.user = toUser(r.rows[0]);
  });

  app.setErrorHandler((err: Error & { statusCode?: number; code?: string }, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    if (err.statusCode === 413) return reply.status(413).send({ error: { code: 'too_large', message: 'The upload is too large.' } });
    if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: { code: 'bad_request', message: err.message } });
    const dbDown = /ECONNREFUSED|terminating connection|Connection terminated|timeout exceeded when trying to connect/i.test(err.message);
    if (!dbDown) app.log.error(err);
    return reply.status(503).send({ error: { code: dbDown ? 'database_unavailable' : 'internal', message: dbDown ? 'The lab database is not reachable right now. Tests can still be recorded and downloaded.' : 'Something went wrong on the server.' } });
  });

  /* Someone with a temporary password can only change it (or sign out) until they do. */
  const PASSWORD_ONLY = new Set(['/api/v1/auth/me', '/api/v1/auth/password', '/api/v1/auth/logout']);
  const signedIn = (req: FastifyRequest): User => {
    const u = req.user ?? fail(401, 'not_signed_in', 'Sign in first.');
    if (u.mustChangePassword && !PASSWORD_ONLY.has(req.routeOptions.url ?? '')) fail(403, 'must_change_password', 'Change your temporary password first.');
    return u;
  };
  const admin = (req: FastifyRequest): User => { const u = signedIn(req); if (u.role !== 'admin') fail(403, 'admin_only', 'Only an admin can do this.'); return u; };

  app.register(async (api) => {
    /* ---------- health ---------- */
    api.get('/health', async (_req, reply) => {
      const up = await db.query('select 1').then(() => true, () => false);
      return reply.status(up ? 200 : 503).send({ ok: up, api: API_VERSION, database: up ? 'up' : 'down' });
    });

    /* ---------- signing in ---------- */
    api.post('/auth/login', async (req, reply) => {
      const b = parse(LoginBody, req.body), name = b.username.trim().toLowerCase(), keys = ['u:' + name, 'ip:' + req.ip];
      const wait = limiter.blocked(keys);
      if (wait) return fail(429, 'too_many_attempts', 'Too many failed sign-ins. Try again in ' + Math.ceil(wait / 60000) + ' minutes.');
      const r = await db.query('select id, username, display_name, role, must_change_password, password_hash, disabled from users where username = $1', [name]);
      const row = r.rows[0];
      const ok = row ? await verifyPassword(row.password_hash, b.password) : (await verifyPassword(await dummyHash(), b.password), false);
      if (!ok || row.disabled) {
        limiter.failed(keys);
        if (row) await audit(String(row.id), 'login_failed');   /* an unknown name is not stored: it may be a password typed in the wrong box */
        return fail(401, 'wrong_login', 'Wrong username or password.');
      }
      limiter.succeeded(keys);
      const t = newToken();
      await db.query("insert into login_sessions (token_hash, user_id, expires_at) values ($1, $2, now() + make_interval(hours => $3))", [t.hash, row.id, config.sessionHours]);
      await audit(String(row.id), 'login');
      reply.header('set-cookie', sessionCookie(t.token, config.sessionHours * 3600, config.cookieSecure));
      return { user: toUser(row) };
    });
    api.post('/auth/logout', async (req, reply) => {
      const token = readCookie(req.headers.cookie, COOKIE);
      if (token) await db.query('delete from login_sessions where token_hash = $1', [tokenHash(token)]);
      reply.header('set-cookie', sessionCookie('', 0, config.cookieSecure));
      return { ok: true };
    });
    api.get('/auth/me', async (req) => ({ user: req.user ?? fail(401, 'not_signed_in', 'Sign in first.') }));
    api.post('/auth/password', async (req) => {
      const u = req.user ?? fail(401, 'not_signed_in', 'Sign in first.'), b = parse(PasswordBody, req.body);
      const row = (await db.query('select password_hash from users where id = $1', [u.id])).rows[0];
      if (!row || !(await verifyPassword(row.password_hash, b.current))) fail(400, 'wrong_password', 'The current password is not right.');
      const why = passwordProblem(b.next);
      if (why) fail(400, 'weak_password', why);
      await db.query('update users set password_hash = $1, must_change_password = false where id = $2', [await hashPassword(b.next), u.id]);
      const keep = tokenHash(readCookie(req.headers.cookie, COOKIE) ?? '');
      await db.query('delete from login_sessions where user_id = $1 and token_hash <> $2', [u.id, keep]);   /* sign out other browsers */
      await audit(u.id, 'password_changed');
      return { ok: true };
    });

    /* ---------- people (admin) ---------- */
    const userCols = 'id, username, display_name, role, disabled, must_change_password, created_at';
    const userOut = (r: { id: string; username: string; display_name: string; role: string; disabled: boolean; must_change_password: boolean; created_at: Date }) =>
      ({ id: String(r.id), username: r.username, displayName: r.display_name, role: r.role, disabled: r.disabled, mustChangePassword: r.must_change_password, createdAt: r.created_at });
    api.get('/users', async (req) => { admin(req); return { users: (await db.query(`select ${userCols} from users order by username`)).rows.map(userOut) }; });
    api.post('/users', async (req, reply) => {
      const a = admin(req), b = parse(NewUserBody, req.body);
      const why = passwordProblem(b.password);
      if (why) fail(400, 'weak_password', why);
      const r = await db.query(`insert into users (username, display_name, role, password_hash, must_change_password) values ($1, $2, $3, $4, true)
        on conflict (username) do nothing returning ${userCols}`, [b.username, b.displayName, b.role, await hashPassword(b.password)]);
      if (!r.rows[0]) fail(409, 'exists', 'That username is taken.');
      await audit(a.id, 'user_created', { username: b.username, role: b.role });
      return reply.status(201).send({ user: userOut(r.rows[0]) });
    });
    api.patch<{ Params: { id: string } }>('/users/:id', async (req) => {
      const a = admin(req), b = parse(UserPatch, req.body), id = req.params.id;
      if (!/^\d+$/.test(id)) fail(404, 'not_found', 'No such user.');
      const client = await db.connect();
      try {
        await client.query('begin');
        await client.query('lock table users in share row exclusive mode');
        const cur = (await client.query('select role, disabled from users where id = $1', [id])).rows[0];
        if (!cur) fail(404, 'not_found', 'No such user.');
        if (b.password !== undefined) { const why = passwordProblem(b.password); if (why) fail(400, 'weak_password', why); }
        const losesAdmin = cur.role === 'admin' && !cur.disabled && (b.role === 'user' || b.disabled === true);
        if (losesAdmin) {
          const others = (await client.query("select count(*)::int as n from users where role = 'admin' and not disabled and id <> $1", [id])).rows[0].n;
          if (others === 0) fail(400, 'last_admin', 'This is the only active admin. Make another admin first.');
        }
        const sets: string[] = [], vals: unknown[] = [];
        const set = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
        if (b.displayName !== undefined) set('display_name', b.displayName);
        if (b.role !== undefined) set('role', b.role);
        if (b.disabled !== undefined) set('disabled', b.disabled);
        if (b.password !== undefined) { set('password_hash', await hashPassword(b.password)); set('must_change_password', true); }
        if (!sets.length) fail(400, 'invalid', 'Nothing to change.');
        vals.push(id);
        const r = await client.query(`update users set ${sets.join(', ')} where id = $${vals.length} returning ${userCols}`, vals);
        if (b.disabled || b.password !== undefined || (b.role !== undefined && b.role !== cur.role)) await client.query('delete from login_sessions where user_id = $1', [id]);
        await client.query('commit');
        await audit(a.id, 'user_changed', { id, ...b, password: b.password !== undefined ? 'reset' : undefined });
        return { user: userOut(r.rows[0]) };
      } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
    });

    /* ---------- device profiles and calibrations ---------- */
    const profileOut = (r: { id: string; name: string; channels: unknown; notes: string; updated_at: Date }) => ({ id: r.id, name: r.name, channels: r.channels, notes: r.notes, updatedAt: r.updated_at });
    api.get('/device-profiles', async (req) => { signedIn(req); return { profiles: (await db.query('select * from device_profiles order by name')).rows.map(profileOut) }; });
    api.post('/device-profiles', async (req, reply) => {
      const a = admin(req), b = parse(ProfileBody, req.body);
      const r = await db.query('insert into device_profiles (id, name, channels, notes, created_by) values ($1, $2, $3, $4, $5) on conflict (id) do nothing returning *',
        [b.id, b.name, JSON.stringify(b.channels), b.notes, a.id]);
      if (!r.rows[0]) fail(409, 'exists', 'A profile with that id exists. Profiles are not overwritten; give the changed circuit a new id.');
      await audit(a.id, 'profile_created', { id: b.id });
      return reply.status(201).send({ profile: profileOut(r.rows[0]) });
    });

    const calOut = (r: Record<string, unknown>) => ({
      id: r.id, profileId: r.profile_id, quantity: r.quantity, unit: r.unit, slope: r.slope, offset: r.offset_value, signalPath: r.signal_path,
      origin: r.origin, status: r.status, note: r.note, createdAt: r.created_at, approvedAt: r.approved_at, approvedBy: r.approved_by_name ?? null, createdBy: r.created_by_name ?? null,
    });
    const calSelect = `select c.*, cu.username as created_by_name, au.username as approved_by_name from calibrations c
      left join users cu on cu.id = c.created_by left join users au on au.id = c.approved_by`;
    api.get<{ Querystring: { profile?: string } }>('/calibrations', async (req) => {
      signedIn(req);
      const r = req.query.profile ? await db.query(calSelect + ' where c.profile_id = $1 order by c.created_at desc', [req.query.profile]) : await db.query(calSelect + ' order by c.created_at desc');
      return { calibrations: r.rows.map(calOut) };
    });
    api.post('/calibrations', async (req, reply) => {
      const a = admin(req), b = parse(CalibrationBody, req.body);
      const prof = (await db.query('select channels from device_profiles where id = $1', [b.profileId])).rows[0];
      if (!prof) fail(400, 'invalid', 'No device profile has that id.');
      const conds = Object.values(prof.channels as Record<string, { conditioning: { id: string; gain: number; offset_V: number } }>).map((c) => c.conditioning);
      if (!conds.some((c) => c.id === b.signalPath.conditioningId && c.gain === b.signalPath.conditioningGain && c.offset_V === b.signalPath.conditioningOffset_V)) {
        fail(400, 'invalid', 'The signal path names a conditioning circuit that is not in this profile.');
      }
      const r = await db.query(`insert into calibrations (id, profile_id, quantity, unit, slope, offset_value, signal_path, origin, note, created_by)
        values ($1, $2, $3, $4, $5, $6, $7, 'measured', $8, $9) on conflict (id) do nothing returning *`,
        [b.id, b.profileId, b.quantity, b.unit, b.slope, b.offset, JSON.stringify(b.signalPath), b.note, a.id]);
      if (!r.rows[0]) fail(409, 'exists', 'A calibration with that id exists. Calibrations are never overwritten.');
      await audit(a.id, 'calibration_created', { id: b.id });
      return reply.status(201).send({ calibration: calOut((await db.query(calSelect + ' where c.id = $1', [b.id])).rows[0]) });
    });
    for (const [verb, status] of [['approve', 'approved'], ['retire', 'retired']] as const) {
      api.post<{ Params: { id: string } }>(`/calibrations/:id/${verb}`, async (req) => {
        const a = admin(req);
        const exists = (await db.query('select status from calibrations where id = $1', [req.params.id])).rows[0];
        if (!exists) fail(404, 'not_found', 'No such calibration.');
        const r = status === 'approved'
          ? await db.query("update calibrations set status = 'approved', approved_by = $2, approved_at = now() where id = $1 and status = 'draft' returning id", [req.params.id, a.id])
          : await db.query("update calibrations set status = 'retired' where id = $1 and status <> 'retired' returning id", [req.params.id]);
        if (!r.rows[0]) fail(409, 'wrong_state', verb === 'approve' ? 'Only a draft calibration can be approved.' : 'The calibration is already retired.');
        await audit(a.id, 'calibration_' + status, { id: req.params.id });
        return { calibration: calOut((await db.query(calSelect + ' where c.id = $1', [req.params.id])).rows[0]) };
      });
    }
    /* The setup file the app's Calibration step loads: a profile and its approved calibrations. */
    api.get<{ Params: { id: string } }>('/setup-files/:id', async (req) => {
      signedIn(req);
      const p = (await db.query('select * from device_profiles where id = $1', [req.params.id])).rows[0];
      if (!p) fail(404, 'not_found', 'No such device profile.');
      const cals = (await db.query("select * from calibrations where profile_id = $1 and status = 'approved' order by created_at", [req.params.id])).rows;
      return {
        profile: { id: p.id, name: p.name, channels: p.channels },
        calibrations: cals.map((c) => ({ id: c.id, quantity: c.quantity, unit: c.unit, slope: c.slope, offset: c.offset_value, signalPath: c.signal_path, origin: 'measured', createdAt: c.created_at.toISOString(), note: c.note })),
      };
    });

    /* ---------- recorded tests ---------- */
    api.post('/test-sessions', async (req, reply) => {
      const u = signedIn(req), b = parse(UploadBody, req.body), f = b.file;
      type Hello = { device_id?: string; device_type?: string; sw_version?: string };
      let hello: Hello | null = null, samples = 0, firstSample: number | null = null;
      for (let i = 0; i < f.lines.length; i++) {
        const l = f.lines[i] as string;
        if (l.includes('"type":"sample"')) { samples++; if (firstSample === null && typeof f.receivedAt_ms[i] === 'number') firstSample = f.receivedAt_ms[i] as number; }
        else if (!hello && l.includes('"type":"hello"')) { try { hello = JSON.parse(l) as Hello; } catch { hello = null; } }
      }
      const h: Hello = hello ?? fail(400, 'invalid', 'The session file has no device identification.');
      const raw = JSON.stringify((req.body as { file: unknown }).file), gz = zlib.gzipSync(raw), sha = crypto.createHash('sha256').update(raw).digest('hex');
      const setup = f.setup as Record<string, string | boolean>;
      const client = await db.connect();
      try {
        await client.query('begin');
        const r = await client.query(`insert into test_sessions (owner_id, test_type, recorded_from, material, specimen_id, device_id, device_type, device_software,
          protocol, app_version, calibration_ids, sample_count, started_at, summary, notes)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, to_timestamp($13 / 1000.0), $14, $15) returning id, created_at`,
          [u.id, f.test, f.recordedFrom, String(setup.material ?? '').slice(0, 200), String(setup.specimenId ?? '').slice(0, 200), String(h.device_id ?? ''), String(h.device_type ?? ''),
           String(h.sw_version ?? ''), 'tensile-ndjson/1', f.appVersion, f.calibrations.map((c) => c.id), samples, firstSample, JSON.stringify(b.summary), b.notes]);
        const id = r.rows[0].id;
        await client.query('insert into session_files (session_id, format_version, gzip, sha256, bytes_raw) values ($1, 1, $2, $3, $4)', [id, gz, sha, Buffer.byteLength(raw)]);
        if (f.recordedFrom === 'real' && h.device_id) {
          await client.query(`insert into devices (device_id, device_type, last_software) values ($1, $2, $3)
            on conflict (device_id) do update set device_type = excluded.device_type, last_software = excluded.last_software, last_seen = now()`, [h.device_id, h.device_type ?? '', h.sw_version ?? '']);
        }
        await client.query('commit');
        await audit(u.id, 'session_saved', { id: String(id), samples });
        return reply.status(201).send({ id: String(id), createdAt: r.rows[0].created_at, sampleCount: samples, sha256: sha });
      } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
    });

    const sessionOut = (r: Record<string, unknown>) => ({
      id: String(r.id), owner: r.owner_name, testType: r.test_type, recordedFrom: r.recorded_from,
      data: r.recorded_from === 'simulated' ? 'Simulated data, not measured' : 'Measured',
      material: r.material, specimenId: r.specimen_id, deviceId: r.device_id, deviceType: r.device_type, deviceSoftware: r.device_software,
      appVersion: r.app_version, calibrationIds: r.calibration_ids, sampleCount: r.sample_count, startedAt: r.started_at, savedAt: r.created_at,
      summary: r.summary, notes: r.notes,
    });
    const sessionSelect = 'select s.*, u.username as owner_name from test_sessions s join users u on u.id = s.owner_id';
    api.get<{ Querystring: { owner?: string; limit?: string } }>('/test-sessions', async (req) => {
      const u = signedIn(req), limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
      const all = u.role === 'admin', owner = all ? req.query.owner : u.id;
      if (owner !== undefined && !/^\d+$/.test(owner)) fail(400, 'invalid', 'The owner must be a user id.');
      const r = owner && /^\d+$/.test(owner)
        ? await db.query(sessionSelect + ' where s.owner_id = $1 order by s.created_at desc limit $2', [owner, limit])
        : all ? await db.query(sessionSelect + ' order by s.created_at desc limit $1', [limit]) : fail(400, 'invalid', 'Bad owner.');
      return { sessions: r.rows.map(sessionOut) };
    });
    const own = async (req: FastifyRequest<{ Params: { id: string } }>) => {
      const u = signedIn(req);
      if (!/^\d+$/.test(req.params.id)) fail(404, 'not_found', 'No such test.');
      const r = (await db.query(sessionSelect + ' where s.id = $1', [req.params.id])).rows[0];
      if (!r || (u.role !== 'admin' && String(r.owner_id) !== u.id)) fail(404, 'not_found', 'No such test.');   /* someone else's test looks the same as none */
      return r;
    };
    api.get<{ Params: { id: string } }>('/test-sessions/:id', async (req) => ({ session: sessionOut(await own(req)) }));
    api.get<{ Params: { id: string } }>('/test-sessions/:id/file', async (req, reply: FastifyReply) => {
      const s = await own(req);
      const f = (await db.query('select gzip from session_files where session_id = $1', [s.id])).rows[0];
      if (!f) fail(404, 'not_found', 'The file for this test is missing.');
      reply.header('content-type', 'application/json; charset=utf-8');
      reply.header('content-disposition', `attachment; filename="test-${s.id}.session.json"`);
      return reply.send(zlib.gunzipSync(f.gzip));
    });

    /* ---------- test methods (shared setups; admins change them, everyone signed in uses them) ---------- */
    const methodOut = (r: Record<string, unknown>) => ({
      id: r.method_key, name: r.name, revision: r.revision, test: r.test_type, fields: r.fields, instructions: r.instructions,
      archived: r.archived, createdAt: r.created_at, createdBy: r.created_by_name ?? null,
    });
    const methodSelect = `select distinct on (m.method_key) m.*, u.username as created_by_name from test_methods m left join users u on u.id = m.created_by`;
    api.get('/methods', async (req) => {
      signedIn(req);
      const r = await db.query(`select * from (${methodSelect} order by m.method_key, m.revision desc) cur where not archived order by lower(name)`);
      return { methods: r.rows.map(methodOut) };
    });
    api.post('/methods', async (req, reply) => {
      const a = admin(req), b = parse(MethodBody, req.body);
      const client = await db.connect();
      try {
        await client.query('begin');
        let key: string, revision: number;
        if (b.replaces) {
          await client.query('select pg_advisory_xact_lock(hashtext($1))', [b.replaces.key]);
          const cur = (await client.query('select revision, archived from test_methods where method_key = $1 order by revision desc limit 1', [b.replaces.key])).rows[0];
          if (!cur) fail(404, 'not_found', 'No such method.');
          if (cur.archived) fail(409, 'archived', 'This method was archived.');
          if (cur.revision !== b.replaces.revision) fail(409, 'changed', 'Someone else changed this method. Reload the list and try again.');
          key = b.replaces.key; revision = cur.revision + 1;
        } else {
          key = 'lm-' + (await client.query("select nextval(pg_get_serial_sequence('test_methods', 'id')) as n")).rows[0].n; revision = 1;
        }
        await client.query(`insert into test_methods (method_key, revision, name, test_type, fields, instructions, created_by) values ($1, $2, $3, $4, $5, $6, $7)`,
          [key, revision, b.name, b.test, JSON.stringify(b.fields), b.instructions, a.id]);
        await client.query('commit');
        await audit(a.id, 'method_saved', { key, revision });
        const row = (await db.query(methodSelect + ' where m.method_key = $1 order by m.method_key, m.revision desc', [key])).rows[0];
        return reply.status(201).send({ method: methodOut(row) });
      } catch (e) { await client.query('rollback'); throw e; } finally { client.release(); }
    });
    api.post<{ Params: { key: string } }>('/methods/:key/archive', async (req) => {
      const a = admin(req);
      /* Archiving adds a row (the latest revision, marked archived): earlier rows are never changed. */
      const r = await db.query(`insert into test_methods (method_key, revision, name, test_type, fields, instructions, archived, created_by)
        select method_key, revision + 1, name, test_type, fields, instructions, true, $2 from test_methods
         where method_key = $1 and revision = (select max(revision) from test_methods where method_key = $1) and not archived returning revision`, [req.params.key, a.id]);
      if (!r.rows[0]) fail(404, 'not_found', 'No such method, or it is already archived.');
      await audit(a.id, 'method_archived', { key: req.params.key });
      return { ok: true };
    });

    /* ---------- record of changes (admin) ---------- */
    api.get('/audit', async (req) => {
      admin(req);
      const r = await db.query('select a.id, a.at, a.action, a.detail, u.username from audit_log a left join users u on u.id = a.user_id order by a.id desc limit 200');
      return { entries: r.rows.map((x) => ({ id: String(x.id), at: x.at, action: x.action, detail: x.detail, username: x.username })) };
    });
  }, { prefix: '/api/v1' });

  return app;
}
