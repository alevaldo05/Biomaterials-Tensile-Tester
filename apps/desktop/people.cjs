'use strict';
/* Who may run the machine: the people list and the sign-in of the Windows app, kept on this computer (the app's data
   folder). See docs/app/SIGN-IN.md.
   - Three kinds of access: admin (manages everyone), operator (runs tests; adds and manages only the students they
     added), student (runs tests; adds nobody; has an end date; names a responsible operator before each connection).
   - Everyone signs in the same way: a username, then a password (for a student, the password or code their operator
     set; they choose their own at the first sign-in).
   - Passwords and the admin recovery code are kept only as scrypt hashes (Node's own crypto; no other package), and
     compared in constant time. After 5 wrong tries in 15 minutes for one name, sign-in for that name pauses.
   - people.json is rewritten whole, through a temporary file and a rename; the previous version is kept as
     people.json.bak. A file that cannot be read is never replaced by an empty list: sign-in is refused instead.
   - usage-log.jsonl is append only: sign-ins, wrong tries, sign-outs, responsible operators, tests started and ended,
     and every change to the people list. No password or code is ever written to it.
   - Every rule is checked here, in the main process; the screens only ever see names and kinds.
   This keeps casual and unauthorised use off the machine. It is not a lock on the tester, and someone with Windows
   administrator rights can still delete these files. No Electron here, so it can be tested on its own. */
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');

const KINDS = ['admin', 'operator', 'student'];
const KIND_NAME = { admin: 'Admin', operator: 'Operator', student: 'Student' };
const USERNAME = /^[a-z0-9][a-z0-9._-]{1,39}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_PASSWORD = { admin: 10, operator: 10, student: 8 };
const MAX_PASSWORD = 200;
const MAX_NAME = 80;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };
const TRIES = { max: 5, windowMs: 15 * 60 * 1000 };
const IDLE_MS = 15 * 60 * 1000;
const FORMAT = 'tensile-tester-people';

function fail(msg) { const e = new Error(msg); e.plain = true; throw e; }

/* ---------- hashing ---------- */
function scrypt(secret, salt, o) {
  return new Promise((resolve, reject) => crypto.scrypt(secret, salt, o.keylen, { N: o.N, r: o.r, p: o.p, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))));
}
async function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(secret), salt, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}
async function verifySecret(secret, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  const salt = Buffer.from(parts[4], 'base64'), want = Buffer.from(parts[5], 'base64');
  if (![N, r, p].every(Number.isInteger) || !salt.length || !want.length) return false;
  const got = await scrypt(String(secret), salt, { N, r, p, keylen: want.length });
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
/* A recovery code: 4 groups of 4 letters and digits, without look-alikes (0/O, 1/I/L). */
function recoveryCode() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(16);
  let s = '';
  for (let i = 0; i < 16; i++) s += abc[bytes[i] % abc.length] + (i % 4 === 3 && i < 15 ? '-' : '');
  return s;
}
const normalCode = (c) => String(c ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/* ---------- wrong tries ---------- */
function createTries(now) {
  const seen = new Map();
  const recent = (key) => (seen.get(key) || []).filter((t) => now() - t < TRIES.windowMs);
  return {
    /** Minutes to wait, or 0. */
    paused(key) { const r = recent(key); return r.length >= TRIES.max ? Math.max(1, Math.ceil((TRIES.windowMs - (now() - r[0])) / 60000)) : 0; },
    wrong(key) { const r = recent(key); r.push(now()); seen.set(key, r); if (seen.size > 10000) seen.delete(seen.keys().next().value); },
    clear(key) { seen.delete(key); },
  };
}

/* ---------- checks ---------- */
const today = (now) => { const d = new Date(now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function checkUsername(u) {
  const v = String(u ?? '').trim().toLowerCase();
  if (!USERNAME.test(v)) fail('A username is 2 to 40 characters: lowercase letters, digits, and . _ - (starting with a letter or digit).');
  return v;
}
function checkName(n) {
  const v = String(n ?? '').trim().replace(/\s+/g, ' ');
  if (!v) fail('Enter the person’s name.');
  if (v.length > MAX_NAME) fail('The name is longer than ' + MAX_NAME + ' characters.');
  if (/[\u0000-\u001f]/.test(v)) fail('The name has a character that cannot be used.');
  return v;
}
function checkKind(k) { if (!KINDS.includes(k)) fail('Choose Admin, Operator, or Student.'); return k; }
function checkPassword(p, kind) {
  if (typeof p !== 'string') fail('Enter a password.');
  const min = MIN_PASSWORD[kind] || 10;
  if (p.length < min) fail('A password for ' + (kind === 'student' ? 'a student' : 'an ' + kind) + ' is at least ' + min + ' characters.');
  if (p.length > MAX_PASSWORD) fail('The password is longer than ' + MAX_PASSWORD + ' characters.');
  return p;
}
function checkDate(d, now, required) {
  if (d == null || d === '') { if (required) fail('A student needs an end date.'); return null; }
  if (typeof d !== 'string' || !DATE.test(d) || Number.isNaN(Date.parse(d + 'T00:00:00Z'))) fail('The end date is not a date (YYYY-MM-DD).');
  if (d < today(now)) fail('The end date is in the past.');
  return d;
}

/* ---------- the file ---------- */
function validFile(f) {
  if (!f || f.format !== FORMAT || f.version !== 1 || !Array.isArray(f.people)) return false;
  return f.people.every((p) => p && typeof p.id === 'string' && USERNAME.test(p.username) && KINDS.includes(p.kind) && typeof p.hash === 'string' && typeof p.name === 'string');
}

function createPeople(dir, opts = {}) {
  const now = opts.now || (() => Date.now());
  const file = path.join(dir, 'people.json'), logFile = path.join(dir, 'usage-log.jsonl');
  const tries = createTries(now);
  let data = null;          /* the people list once read */
  let broken = '';          /* why it could not be read */
  let session = null;       /* { id, lastActive, busy, responsible: { id, by } | null } */
  let queue = Promise.resolve();
  let dummy = null;
  /* One change at a time, in the order asked. */
  const serial = (f) => { const next = queue.then(f, f); queue = next.catch(() => undefined); return next; };

  async function load() {
    if (data || broken) return;
    let text;
    try { text = await fsp.readFile(file, 'utf8'); } catch (e) {
      if (e && e.code === 'ENOENT') { data = { format: FORMAT, version: 1, people: [], recovery: null, recoveryFor: null }; return; }
      broken = 'The people list on this computer could not be read (' + (e && e.code ? e.code : 'error') + ').'; return;
    }
    let f = null;
    try { f = JSON.parse(text); } catch { f = null; }
    if (!validFile(f)) { broken = 'The people list on this computer is damaged. Nobody can sign in until it is restored (see Sign-in in the app’s docs: people.json.bak holds the previous version).'; return; }
    data = f;
  }
  async function ready() { await load(); if (broken) fail(broken); return data; }
  async function save() {
    await fsp.mkdir(dir, { recursive: true });
    const tmp = file + '.tmp';
    const fh = await fsp.open(tmp, 'w');
    try { await fh.writeFile(JSON.stringify(data, null, 1)); await fh.sync(); } finally { await fh.close(); }
    if (fs.existsSync(file)) await fsp.copyFile(file, file + '.bak');
    await fsp.rename(tmp, file);
  }
  async function log(event, detail = {}) {
    const who = session ? byId(session.id) : null;
    const row = { at: new Date(now()).toISOString(), event, by: who ? who.username : null, ...detail };
    try { await fsp.mkdir(dir, { recursive: true }); await fsp.appendFile(logFile, JSON.stringify(row) + '\n'); } catch { /* the log never stops the app */ }
  }

  const byId = (id) => (data ? data.people.find((p) => p.id === id) : undefined) || null;
  const byName = (u) => (data ? data.people.find((p) => p.username === u) : undefined) || null;
  const ended = (p) => p.kind === 'student' && p.endDate && p.endDate < today(now);
  const activeAdmins = () => data.people.filter((p) => p.kind === 'admin' && !p.disabled);
  const newId = () => 'p-' + crypto.randomBytes(6).toString('hex');

  /* The signed-in person, or null. Signs out after 15 minutes without activity, never while busy (connected or
     recording). */
  function me() {
    if (!session) return null;
    const p = byId(session.id);
    if (!p || p.disabled || ended(p)) { session = null; return null; }
    if (!session.busy && now() - session.lastActive > IDLE_MS) { session = null; void log('signed_out_idle', { person: p.username }); return null; }
    return p;
  }
  function need(kinds) {
    const p = me();
    if (!p) fail('Sign in first.');
    if (p.mustChange) fail('Choose your own password first.');
    if (kinds && !kinds.includes(p.kind)) fail('Your access does not allow this.');
    return p;
  }
  /* Admin: everyone. Operator: only the students they added. Student: nobody. */
  const canManage = (actor, target) => actor.kind === 'admin' || (actor.kind === 'operator' && target.kind === 'student' && target.addedBy === actor.id);
  function view(p) {
    const adder = p.addedBy ? byId(p.addedBy) : null;
    return {
      id: p.id, username: p.username, name: p.name, kind: p.kind, kindName: KIND_NAME[p.kind], disabled: !!p.disabled,
      endDate: p.endDate || null, ended: !!ended(p), mustChange: !!p.mustChange, addedBy: adder ? adder.name : null,
      createdAt: p.createdAt || null, lastSignIn: p.lastSignIn || null,
    };
  }
  function responsibleView() {
    if (!session || !session.responsible) return null;
    const r = byId(session.responsible.id);
    return r ? { name: r.name, username: r.username, by: session.responsible.by } : null;
  }
  async function dummyCheck(secret) { if (!dummy) dummy = await hashSecret('not a real password, used for timing'); await verifySecret(secret, dummy); }

  const api = {
    /** Whether the first admin exists, and whether the list could be read. */
    async status() {
      await load();
      return { setUp: !!(data && data.people.length), broken: broken || null };
    },
    /** First start only: the first admin. Returns the one-time recovery code (kept only as a hash). */
    setup(input) {
      return serial(async () => {
        await ready();
        if (data.people.length) fail('This computer already has an admin.');
        const i = input || {};
        const p = { id: newId(), username: checkUsername(i.username), name: checkName(i.name), kind: 'admin', hash: await hashSecret(checkPassword(i.password, 'admin')), mustChange: false, disabled: false, endDate: null, addedBy: null, createdAt: new Date(now()).toISOString() };
        const code = recoveryCode();
        data.people.push(p); data.recovery = await hashSecret(normalCode(code)); data.recoveryFor = p.id;
        await save();
        session = { id: p.id, lastActive: now(), busy: false, responsible: null };
        await log('admin_created', { person: p.username });
        return { recoveryCode: code, me: api.current() };
      });
    },
    async signIn(username, password) {
      await ready();
      if (session && session.busy && me()) fail('Disconnect first: another person cannot sign in while connected or recording.');
      const u = String(username ?? '').trim().toLowerCase().slice(0, 40), key = 'u:' + u;
      const wait = tries.paused(key);
      if (wait) fail('Too many wrong tries for this username. Wait ' + wait + ' minute' + (wait === 1 ? '' : 's') + ', then try again.');
      const p = USERNAME.test(u) ? byName(u) : null;
      const ok = p ? await verifySecret(String(password ?? '').slice(0, MAX_PASSWORD), p.hash) : (await dummyCheck(String(password ?? '')), false);
      if (!ok) { tries.wrong(key); await log('sign_in_failed', { person: p ? p.username : null }); fail('The username or password is not right.'); }
      tries.clear(key);
      if (p.disabled) { await log('sign_in_refused', { person: p.username, reason: 'turned off' }); fail('This access is turned off. Ask the person who gave it to you.'); }
      if (ended(p)) { await log('sign_in_refused', { person: p.username, reason: 'ended' }); fail('This access ended on ' + p.endDate + '. Ask your operator to extend it.'); }
      session = { id: p.id, lastActive: now(), busy: false, responsible: null };
      await serial(async () => { p.lastSignIn = new Date(now()).toISOString(); await save(); });
      await log('sign_in', { person: p.username });
      return api.current();
    },
    async signOut() {
      const p = session ? byId(session.id) : null;
      if (session && session.busy) fail('Disconnect first: you cannot sign out while connected or recording.');
      if (p) await log('sign_out', { person: p.username });
      session = null;
      return null;
    },
    /** The signed-in person as the screens may see them, or null. */
    current() {
      const p = me();
      if (!p) return null;
      const responsible = responsibleView();
      const why = p.mustChange ? 'Choose your own password first.' : p.kind === 'student' && !responsible ? 'Choose your responsible operator first.' : '';
      const daysLeft = p.kind === 'student' && p.endDate ? Math.round((Date.parse(p.endDate + 'T00:00:00Z') - Date.parse(today(now) + 'T00:00:00Z')) / 86400000) : null;
      return { name: p.name, username: p.username, kind: p.kind, kindName: KIND_NAME[p.kind], mustChange: !!p.mustChange, endDate: p.endDate || null, daysLeft, responsible, canRunMachine: !why, why };
    },
    /** Activity from the screens: keeps the sign-in, and busy (connected or recording) blocks the sign-out. */
    touch(busy) {
      if (!me()) return null;
      session.lastActive = now();
      session.busy = busy === true;
      return api.current();
    },
    changePassword(oldPassword, newPassword) {
      return serial(async () => {
        const p = me();
        if (!p) fail('Sign in first.');
        const key = 'u:' + p.username, wait = tries.paused(key);
        if (wait) fail('Too many wrong tries. Wait ' + wait + ' minute' + (wait === 1 ? '' : 's') + '.');
        if (!(await verifySecret(String(oldPassword ?? '').slice(0, MAX_PASSWORD), p.hash))) { tries.wrong(key); fail('Your current password is not right.'); }
        checkPassword(newPassword, p.kind);
        if (newPassword === oldPassword) fail('Choose a password different from the one you were given.');
        p.hash = await hashSecret(newPassword); p.mustChange = false;
        await save();
        await log('password_changed', { person: p.username });
        return api.current();
      });
    },
    /** Admin: everyone. Operator: their own students. */
    async list() {
      await ready();
      const actor = need(['admin', 'operator']);
      return data.people.filter((p) => canManage(actor, p) || p.id === actor.id).map(view);
    },
    /** For a student: the people who can be their responsible operator (active admins and operators). */
    async responsibleChoices() {
      await ready();
      const p = need(['student']);
      return data.people.filter((o) => (o.kind === 'admin' || o.kind === 'operator') && !o.disabled)
        .map((o) => ({ id: o.id, name: o.name, username: o.username, kindName: KIND_NAME[o.kind], gaveAccess: o.id === p.addedBy }));
    },
    /** A student names the operator responsible for their tests. The one who gave them access needs no password;
        anyone else confirms with their own password. */
    async confirmResponsible(id, password) {
      await ready();
      const s = need(['student']);
      const o = byId(String(id ?? ''));
      if (!o || (o.kind !== 'admin' && o.kind !== 'operator') || o.disabled) fail('Choose a responsible operator from the list.');
      let by = 'gave access';
      if (o.id !== s.addedBy) {
        const key = 'u:' + o.username, wait = tries.paused(key);
        if (wait) fail('Too many wrong tries for ' + o.name + '. Wait ' + wait + ' minute' + (wait === 1 ? '' : 's') + '.');
        if (!(await verifySecret(String(password ?? '').slice(0, MAX_PASSWORD), o.hash))) { tries.wrong(key); await log('responsible_failed', { person: s.username, responsible: o.username }); fail(o.name + '’s password is not right.'); }
        tries.clear(key);
        by = 'password';
      }
      if (session && session.busy) fail('Disconnect first: the responsible operator cannot change while connected or recording.');
      session.responsible = { id: o.id, by };
      await log('responsible_confirmed', { person: s.username, responsible: o.username, confirmedBy: by });
      return api.current();
    },
    add(input) {
      return serial(async () => {
        await ready();
        const actor = need(['admin', 'operator']);
        const i = input || {};
        const kind = checkKind(i.kind);
        if (actor.kind === 'operator' && kind !== 'student') fail('An operator can add students only.');
        const username = checkUsername(i.username);
        if (byName(username)) fail('That username is already used.');
        const p = {
          id: newId(), username, name: checkName(i.name), kind, hash: await hashSecret(checkPassword(i.password, kind)),
          mustChange: true, disabled: false, endDate: checkDate(i.endDate, now, kind === 'student'), addedBy: actor.id,
          createdAt: new Date(now()).toISOString(),
        };
        data.people.push(p);
        await save();
        await log('person_added', { person: p.username, kind: p.kind, endDate: p.endDate });
        return view(p);
      });
    },
    /** Change a person in your scope: name, end date, turned off, a new first password, or (admin) the kind. */
    update(id, changes) {
      return serial(async () => {
        await ready();
        const actor = need(['admin', 'operator']);
        const p = byId(String(id ?? ''));
        if (!p || !canManage(actor, p)) fail('You cannot change this person.');
        const c = changes || {}, done = [];
        const next = { ...p };
        if (c.name !== undefined) { next.name = checkName(c.name); done.push('name'); }
        if (c.kind !== undefined && c.kind !== p.kind) {
          if (actor.kind !== 'admin') fail('Only the admin can change the kind of access.');
          if (p.id === actor.id) fail('You cannot change your own kind of access.');
          next.kind = checkKind(c.kind); done.push('kind');
        }
        if (c.endDate !== undefined) { next.endDate = checkDate(c.endDate, now, next.kind === 'student'); done.push('end date'); }
        else if (next.kind === 'student' && !next.endDate) fail('A student needs an end date.');
        if (c.disabled !== undefined) {
          if (p.id === actor.id) fail('You cannot turn off your own access.');
          next.disabled = c.disabled === true; done.push(next.disabled ? 'turned off' : 'turned on');
        }
        if (c.password !== undefined) { next.hash = await hashSecret(checkPassword(c.password, next.kind)); next.mustChange = true; done.push('password reset'); }
        if (p.kind === 'admin' && (next.kind !== 'admin' || next.disabled) && activeAdmins().length <= 1) fail('This is the only admin: add another admin first.');
        Object.assign(p, next);
        await save();
        await log(c.password !== undefined ? 'password_reset' : 'person_changed', { person: p.username, changed: done.join(', ') });
        return view(p);
      });
    },
    /** Admin only: a forgotten admin password, with the recovery code from the first start. Gives a new code. */
    recover(code, newPassword) {
      return serial(async () => {
        await ready();
        const wait = tries.paused('recovery');
        if (wait) fail('Too many wrong tries. Wait ' + wait + ' minute' + (wait === 1 ? '' : 's') + '.');
        const admin = byId(data.recoveryFor);
        if (!data.recovery || !admin) fail('No recovery code is set on this computer.');
        if (!(await verifySecret(normalCode(code), data.recovery))) { tries.wrong('recovery'); await log('recovery_failed'); fail('The recovery code is not right.'); }
        tries.clear('recovery');
        admin.hash = await hashSecret(checkPassword(newPassword, 'admin')); admin.mustChange = false; admin.disabled = false;
        const fresh = recoveryCode();
        data.recovery = await hashSecret(normalCode(fresh));
        await save();
        await log('admin_recovered', { person: admin.username });
        return { recoveryCode: fresh, username: admin.username };
      });
    },
    /** Admin only: the usage log, newest last. */
    async usageLog() {
      need(['admin']);
      let text = '';
      try { text = await fsp.readFile(logFile, 'utf8'); } catch (e) { if (e && e.code === 'ENOENT') return []; throw e; }
      const rows = [];
      for (const line of text.split(/\r?\n/)) { if (!line) continue; try { rows.push(JSON.parse(line)); } catch { /* a line cut off by a crash */ } }
      return rows;
    },
    /** Whether the machine may be connected now, and why not. */
    machine() {
      const c = api.current();
      if (!c) return { allowed: false, why: 'Sign in to run the machine.' };
      return c.canRunMachine ? { allowed: true, why: '' } : { allowed: false, why: c.why };
    },
    /** Who is running the test, for the test file: written by the main process, not by the screens. */
    operatorBlock() {
      const c = api.current();
      if (!c || !c.canRunMachine) return null;
      const b = { name: c.name, username: c.username, kind: c.kind };
      if (c.kind === 'student' && c.responsible) b.responsible = { name: c.responsible.name, username: c.responsible.username, confirmedBy: c.responsible.by };
      return b;
    },
    /** A test started or ended, for the usage log. */
    async noteTest(event, detail) {
      if (event !== 'test_started' && event !== 'test_ended') return;
      const d = detail && typeof detail === 'object' ? detail : {};
      const p = me();
      await log(event, { person: p ? p.username : null, id: typeof d.id === 'string' ? d.id.slice(0, 40) : null, responsible: responsibleView()?.username ?? null });
    },
  };
  return api;
}

module.exports = { createPeople, hashSecret, verifySecret, KINDS, USERNAME, MIN_PASSWORD, IDLE_MS, TRIES };
