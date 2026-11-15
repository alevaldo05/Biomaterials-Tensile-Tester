'use strict';
/* Who may run the machine: the people list and the sign-in of the Windows app, kept on this computer (the app's data
   folder). See docs/app/SIGN-IN.md.
   - Three kinds of access: admin (manages everyone), operator (runs tests; adds and manages only the students they
     added), student (runs tests; adds nobody; has an end date; names a responsible operator before each connection).
   - Everyone signs in the same way: a username, then a password (for a student, the password or code their operator
     set; they choose their own at the first sign-in).
   - Passwords and the admin recovery code are kept only as scrypt hashes (Node's own crypto; no other package), and
     compared in constant time. After 5 wrong tries for one name, that name is locked for 1 minute; each wrong try
     after a lock locks it for the next step (3, 5, 15 minutes, then 60 minutes each time). A right password starts
     the ladder again. The locks are kept in lockouts.json, so closing the app does not clear them. At sign-in a person
     is told how many wrong tries there were for their name since they last signed in.
   - people.json is rewritten whole, through a temporary file and a rename; the previous version is kept as
     people.json.bak. A file that cannot be read is never replaced by an empty list: sign-in is refused instead.
   - usage-log.jsonl is append only: sign-ins, wrong tries, sign-outs, responsible operators, tests started and ended,
     and every change to the people list. No password or code is ever written to it.
   - A student signs in freely. Before their first test (Connect) they complete the training (safety briefing, where
     the tester's own STOP is, a practice test), approved by any operator or the admin with their own password; it is
     saved and not asked again. An operator may limit a student to chosen test methods and a maximum crosshead speed; the
     app sends no command, so a limit stops a recording from starting, never the machine.
   - The admin can copy the list to and from the lab server (exportForLab, importFromLab), for a second lab computer,
     or save it to a backup file and restore it (backupFile, restoreFile), with a SHA-256 check that notices changes.
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
/* Minutes locked: the first lock comes after LOCK_AFTER wrong tries, each later wrong try takes the next step. */
const LOCK_AFTER = 5;
const LOCK_STEPS = [1, 3, 5, 15, 60];
const MAX_LOCK_KEYS = 2000;
const IDLE_MS = 15 * 60 * 1000;
const FORMAT = 'tensile-tester-people';
const BACKUP_FORMAT = 'tensile-tester-people-backup';
/* The training sign-off items, in order (draft wording, for the owner's review). */
const TRAINING_ITEMS = ['Safety briefing given', 'Shown where the tester’s own STOP is (the on-screen STOP is not an emergency stop)', 'Practice test completed on the learning website'];
const MAX_METHODS = 20;

const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');
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
/* Per key ('u:<username>' or 'recovery'): wrong tries in a row, the last lock step, when the lock ends, and wrong
   tries since the person last signed in (for the line shown at sign-in). Kept in lockouts.json (no password, only
   names and times); a file that cannot be read starts empty. */
function createLocks(file, now) {
  let seen = null;
  let queue = Promise.resolve();
  const load = () => {
    if (seen) return seen;
    seen = new Map();
    try {
      const f = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (f && typeof f === 'object' && f.locks && typeof f.locks === 'object')
        for (const [k, v] of Object.entries(f.locks)) if (v && typeof v === 'object') seen.set(k, { tries: Number(v.tries) || 0, step: Number.isInteger(v.step) ? v.step : -1, until: Number(v.until) || 0, since: Number(v.since) || 0, lastAt: typeof v.lastAt === 'string' ? v.lastAt : null });
    } catch { /* none yet, or unreadable: start empty */ }
    return seen;
  };
  const write = () => {
    const out = { format: 'tensile-tester-locks', version: 1, locks: Object.fromEntries(load()) };
    const next = queue.then(async () => {
      await fsp.mkdir(path.dirname(file), { recursive: true });
      await fsp.writeFile(file + '.tmp', JSON.stringify(out));
      await fsp.rename(file + '.tmp', file);
    });
    queue = next.catch(() => undefined);
    return next.catch(() => undefined);   /* a lock that cannot be saved still holds while the app runs */
  };
  const tidy = (m, k) => { const e = m.get(k); if (e && !e.tries && e.step < 0 && !e.since) m.delete(k); };
  return {
    /** Minutes to wait, or 0. */
    paused(key) { const e = load().get(key); return e && e.until > now() ? Math.max(1, Math.ceil((e.until - now()) / 60000)) : 0; },
    /** A wrong try. Returns the minutes of the lock it starts, or 0. */
    async wrong(key) {
      const m = load();
      const e = m.get(key) || { tries: 0, step: -1, until: 0, since: 0, lastAt: null };
      e.tries++; e.since++; e.lastAt = new Date(now()).toISOString();
      let minutes = 0;
      if (e.step >= 0) e.step = Math.min(e.step + 1, LOCK_STEPS.length - 1);
      else if (e.tries >= LOCK_AFTER) e.step = 0;
      if (e.step >= 0) { minutes = LOCK_STEPS[e.step]; e.until = now() + minutes * 60000; }
      m.delete(key); m.set(key, e);
      while (m.size > MAX_LOCK_KEYS) m.delete(m.keys().next().value);
      await write();
      return minutes;
    },
    /** A right password: the ladder starts again (the count since the last sign-in is kept). */
    async clear(key) { const m = load(), e = m.get(key); if (!e || (!e.tries && e.step < 0)) return; e.tries = 0; e.step = -1; e.until = 0; tidy(m, key); await write(); },
    /** At sign-in: the wrong tries since the last sign-in, then forgotten. */
    async takeSince(key) {
      const m = load(), e = m.get(key);
      if (!e || !e.since) return null;
      const r = { count: e.since, lastAt: e.lastAt };
      e.since = 0; tidy(m, key); await write();
      return r;
    },
  };
}
const waitText = (n) => 'Wait ' + n + ' minute' + (n === 1 ? '' : 's') + ', then try again.';

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

function checkLimits(l) {
  if (l == null) return null;
  if (typeof l !== 'object' || Array.isArray(l)) fail('The limits are not valid.');
  const out = { maxSpeed: null, methods: [] };
  if (l.maxSpeed != null && l.maxSpeed !== '') {
    const v = Number(l.maxSpeed);
    if (!Number.isFinite(v) || v <= 0 || v > 10000) fail('The maximum crosshead speed must be a number above 0 (mm/min).');
    out.maxSpeed = v;
  }
  if (l.methods != null) {
    if (!Array.isArray(l.methods) || l.methods.length > MAX_METHODS) fail('Choose at most ' + MAX_METHODS + ' test methods.');
    for (const m of l.methods) {
      if (!m || typeof m.id !== 'string' || !m.id || m.id.length > 64 || typeof m.name !== 'string' || !m.name || m.name.length > 120) fail('A test method in the limits is not valid.');
      out.methods.push({ id: m.id, name: m.name });
    }
  }
  return out.maxSpeed === null && !out.methods.length ? null : out;
}

/* ---------- the file ---------- */
function validFile(f) {
  if (!f || f.format !== FORMAT || f.version !== 1 || !Array.isArray(f.people)) return false;
  return f.people.every((p) => p && typeof p.id === 'string' && USERNAME.test(p.username) && KINDS.includes(p.kind) && typeof p.hash === 'string' && typeof p.name === 'string');
}

function createPeople(dir, opts = {}) {
  const now = opts.now || (() => Date.now());
  const file = path.join(dir, 'people.json'), logFile = path.join(dir, 'usage-log.jsonl');
  const tries = createLocks(path.join(dir, 'lockouts.json'), now);
  /* A wrong password: counted, logged when it starts a lock, and the plain words to show (with the wait, if any). */
  async function wrongTry(key, words, person) {
    const minutes = await tries.wrong(key);
    if (minutes) await log('locked', { person: person || null, minutes });
    return minutes ? words + ' Too many wrong tries. ' + waitText(minutes) : words;
  }
  function checkPaused(key) { const w = tries.paused(key); if (w) fail('Too many wrong tries. ' + waitText(w)); }
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
      createdAt: p.createdAt || null, lastSignIn: p.lastSignIn || null, limits: p.limits || null,
      training: p.training ? { at: p.training.at, by: p.training.byName } : null,
    };
  }
  function trainingView(p) { return p.kind === 'student' && p.training ? { at: p.training.at, by: p.training.byName } : null; }
  /* Admins and operators who may approve a student's training or be their responsible operator. */
  function approver(id) {
    const o = byId(String(id ?? ''));
    return o && (o.kind === 'admin' || o.kind === 'operator') && !o.disabled ? o : null;
  }
  function responsibleView() {
    if (!session || !session.responsible) return null;
    const r = byId(session.responsible.id);
    return r ? { name: r.name, username: r.username, by: session.responsible.by } : null;
  }
  /* Another person's password typed on the spot (responsible operator, training approval): same lock ladder. */
  async function checkOperatorPassword(o, password, failEvent, s) {
    const key = 'u:' + o.username;
    checkPaused(key);
    if (!(await verifySecret(String(password ?? '').slice(0, MAX_PASSWORD), o.hash))) { await log(failEvent, { person: s.username, responsible: o.username }); fail(await wrongTry(key, o.name + '’s password is not right.', o.username)); }
    await tries.clear(key);
  }
  /* People from a copy or backup, matched by username: a newer one replaces the one here, a new one is added, people
     only here are kept, and the signed-in admin (actor) is never changed by it. */
  function merge(copy, actor) {
    let added = 0, updated = 0;
    for (const q of copy.people) {
      const here = byName(q.username);
      const clean = { id: here ? here.id : q.id, username: q.username, name: checkName(q.name), kind: checkKind(q.kind), hash: String(q.hash), mustChange: !!q.mustChange,
        disabled: !!q.disabled, endDate: q.endDate && DATE.test(q.endDate) ? q.endDate : null, addedBy: q.addedBy || null, createdAt: q.createdAt || null,
        lastSignIn: q.lastSignIn || null, limits: q.kind === 'student' ? checkLimits(q.limits) : null, training: q.training && typeof q.training === 'object' ? q.training : null, changedAt: q.changedAt || null };
      if (here && actor && here.id === actor.id) continue;
      if (here) { if ((q.changedAt || '') > (here.changedAt || '')) { Object.assign(here, clean); updated++; } }
      else { if (data.people.some((p) => p.id === clean.id)) clean.id = newId(); data.people.push(clean); added++; }
    }
    if (actor && !activeAdmins().length) fail('The copy would leave no admin.');
    return { added, updated };
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
      checkPaused(key);
      const p = USERNAME.test(u) ? byName(u) : null;
      const ok = p ? await verifySecret(String(password ?? '').slice(0, MAX_PASSWORD), p.hash) : (await dummyCheck(String(password ?? '')), false);
      if (!ok) { await log('sign_in_failed', { person: p ? p.username : null }); fail(await wrongTry(key, 'The username or password is not right.', p ? p.username : null)); }
      await tries.clear(key);
      if (p.disabled) { await log('sign_in_refused', { person: p.username, reason: 'turned off' }); fail('This access is turned off. Ask the person who gave it to you.'); }
      if (ended(p)) { await log('sign_in_refused', { person: p.username, reason: 'ended' }); fail('This access ended on ' + p.endDate + '. Ask your operator to extend it.'); }
      session = { id: p.id, lastActive: now(), busy: false, responsible: null };
      await serial(async () => { p.lastSignIn = new Date(now()).toISOString(); await save(); });
      await log('sign_in', { person: p.username });
      return { ...api.current(), wrongSince: await tries.takeSince(key) };
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
      const needsTraining = p.kind === 'student' && !p.training;
      const why = p.mustChange ? 'Choose your own password first.' : needsTraining ? 'Complete the training first.' : p.kind === 'student' && !responsible ? 'Choose your responsible operator first.' : '';
      const daysLeft = p.kind === 'student' && p.endDate ? Math.round((Date.parse(p.endDate + 'T00:00:00Z') - Date.parse(today(now) + 'T00:00:00Z')) / 86400000) : null;
      return { name: p.name, username: p.username, kind: p.kind, kindName: KIND_NAME[p.kind], mustChange: !!p.mustChange, endDate: p.endDate || null, daysLeft, responsible, canRunMachine: !why, why,
        needsTraining, training: trainingView(p), limits: p.kind === 'student' ? p.limits || null : null };
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
        const key = 'u:' + p.username;
        checkPaused(key);
        if (!(await verifySecret(String(oldPassword ?? '').slice(0, MAX_PASSWORD), p.hash))) fail(await wrongTry(key, 'Your current password is not right.', p.username));
        await tries.clear(key);
        checkPassword(newPassword, p.kind);
        if (newPassword === oldPassword) fail('Choose a password different from the one you were given.');
        p.hash = await hashSecret(newPassword); p.mustChange = false; p.changedAt = new Date(now()).toISOString();
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
      if (s.kind === 'student' && !s.training) fail('Complete the training first.');
      const o = approver(id);
      if (!o) fail('Choose a responsible operator from the list.');
      let by = 'gave access';
      if (o.id !== s.addedBy) {
        await checkOperatorPassword(o, password, 'responsible_failed', s);
        by = 'password';
      }
      if (session && session.busy) fail('Disconnect first: the responsible operator cannot change while connected or recording.');
      session.responsible = { id: o.id, by };
      await log('responsible_confirmed', { person: s.username, responsible: o.username, confirmedBy: by });
      return api.current();
    },
    /** A student's training, before their first test: every item ticked, approved by any active operator or the
        admin with their own password. Saved once. */
    completeTraining(ticked, approverId, password) {
      return serial(async () => {
        await ready();
        const s = need(['student']);
        if (s.training) return api.current();
        if (!Array.isArray(ticked) || ticked.length !== TRAINING_ITEMS.length || !ticked.every((t) => t === true)) fail('Tick every training item first.');
        const o = approver(approverId);
        if (!o) fail('Choose an operator from the list.');
        await checkOperatorPassword(o, password, 'training_failed', s);
        s.training = { at: new Date(now()).toISOString(), by: o.id, byName: o.name, items: TRAINING_ITEMS.slice() };
        s.changedAt = s.training.at;
        await save();
        await log('training_completed', { person: s.username, approvedBy: o.username });
        return api.current();
      });
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
          createdAt: new Date(now()).toISOString(), limits: kind === 'student' ? checkLimits(i.limits) : null, training: null,
        };
        p.changedAt = p.createdAt;
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
        if (c.limits !== undefined) { next.limits = next.kind === 'student' ? checkLimits(c.limits) : null; done.push('limits'); }
        if (c.password !== undefined) { next.hash = await hashSecret(checkPassword(c.password, next.kind)); next.mustChange = true; done.push('password reset'); }
        if (p.kind === 'admin' && (next.kind !== 'admin' || next.disabled) && activeAdmins().length <= 1) fail('This is the only admin: add another admin first.');
        Object.assign(p, next, { changedAt: new Date(now()).toISOString() });
        await save();
        await log(c.password !== undefined ? 'password_reset' : 'person_changed', { person: p.username, changed: done.join(', ') });
        return view(p);
      });
    },
    /** Admin only: a forgotten admin password, with the recovery code from the first start. Gives a new code. */
    recover(code, newPassword) {
      return serial(async () => {
        await ready();
        checkPaused('recovery');
        const admin = byId(data.recoveryFor);
        if (!data.recovery || !admin) fail('No recovery code is set on this computer.');
        if (!(await verifySecret(normalCode(code), data.recovery))) { await log('recovery_failed'); fail(await wrongTry('recovery', 'The recovery code is not right.', null)); }
        await tries.clear('recovery');
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
    /** The training items a student completes before their first test. */
    trainingItems() { return TRAINING_ITEMS.slice(); },
    /** Tests, recording time, and last use per person: the admin sees everyone, an operator their students and
        themselves. Worked out from the usage log. */
    async usageReport() {
      await ready();
      const actor = need(['admin', 'operator']);
      const visible = data.people.filter((p) => p.id === actor.id || canManage(actor, p));
      let rows = [];
      try { rows = (await fsp.readFile(logFile, 'utf8')).split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch (e) { if (!e || e.code !== 'ENOENT') throw e; }
      const started = new Map();
      const per = new Map(visible.map((p) => [p.username, { username: p.username, name: p.name, kind: p.kind, kindName: KIND_NAME[p.kind], tests: 0, recordingMinutes: 0, lastUse: p.lastSignIn || null, asResponsible: 0 }]));
      for (const r of rows) {
        const who = r.person && per.get(r.person);
        if (r.event === 'test_started') { if (r.id) started.set(r.id, { at: Date.parse(r.at), person: r.person }); if (who) who.tests++; if (r.responsible && per.get(r.responsible)) per.get(r.responsible).asResponsible++; }
        if (r.event === 'test_ended' && r.id && started.has(r.id)) { const s0 = started.get(r.id), w = per.get(s0.person); if (w && Number.isFinite(s0.at)) w.recordingMinutes += Math.max(0, (Date.parse(r.at) - s0.at) / 60000); started.delete(r.id); }
        if (who && (r.event === 'sign_in' || r.event === 'test_started' || r.event === 'test_ended') && (!who.lastUse || r.at > who.lastUse)) who.lastUse = r.at;
      }
      return [...per.values()].map((w) => ({ ...w, recordingMinutes: Math.round(w.recordingMinutes * 10) / 10 }));
    },
    /** Admin only: the list as kept on this computer (hashes included, never a password), to copy to the lab server.
        Called by the main process only; never given to the screens. */
    async exportForLab() {
      await ready();
      need(['admin']);
      return { format: FORMAT, version: 1, people: data.people.map((p) => ({ ...p })) };
    },
    /** Admin only: brings in a list copied from the lab server. A person is matched by username: one that is newer
        there replaces the one here, a new one is added, and people only on this computer are kept. The signed-in admin
        is never turned off or demoted by it. Returns what changed. */
    importFromLab(copy) {
      return serial(async () => {
        await ready();
        const actor = need(['admin']);
        if (!validFile(copy)) fail('The copy from the lab server is not a people list.');
        let added = 0, updated = 0;
        const r = merge(copy, actor);
        await save();
        await log('people_copied_from_lab', r);
        return r;
      });
    },
    /** Admin only: the list as a backup file (JSON text: hashes, never a password; with a SHA-256 check). Called by the
        main process only, which writes it where the admin chooses; never given to the screens. */
    async backupFile() {
      await ready();
      need(['admin']);
      const body = { format: BACKUP_FORMAT, version: 1, savedAt: new Date(now()).toISOString(), people: data.people.map((p) => ({ ...p })), recovery: data.recovery || null, recoveryFor: data.recoveryFor || null };
      await log('people_backup_saved', { count: body.people.length });
      return JSON.stringify({ ...body, check: { sha256: sha256(JSON.stringify(body)) } }, null, 1);
    },
    /** Admin only: brings back a backup file. 'merge' works like the copy from the lab server; 'replace' makes the
        list the backup's, always keeping the signed-in admin (and this computer's recovery code if it is theirs). */
    restoreFile(text, mode) {
      return serial(async () => {
        await ready();
        const actor = need(['admin']);
        if (mode !== 'merge' && mode !== 'replace') fail('Choose Merge or Replace.');
        let f = null;
        try { f = JSON.parse(String(text ?? '')); } catch { f = null; }
        if (!f || f.format !== BACKUP_FORMAT || f.version !== 1 || !f.check || typeof f.check.sha256 !== 'string') fail('This file is not a people backup from this app.');
        const { check, ...body } = f;
        if (sha256(JSON.stringify(body)) !== check.sha256) fail('This backup has changed since it was saved, so it is not used.');
        const list = { format: FORMAT, version: 1, people: body.people };
        if (!validFile(list)) fail('This file is not a people backup from this app.');
        if (!list.people.some((q) => q.kind === 'admin' && !q.disabled)) fail('The backup has no admin, so it is not used.');
        let r;
        if (mode === 'merge') r = merge(list, actor);
        else {
          const names = new Set(list.people.map((q) => q.username));
          const removed = data.people.filter((p) => p.id !== actor.id && !names.has(p.username)).length;
          const keep = byId(actor.id);
          data.people = [];
          const m = merge(list, null);
          if (byName(keep.username)) data.people = data.people.filter((p) => p.username !== keep.username);
          data.people.push(keep);
          const kept = data.recoveryFor === actor.id;
          if (!kept && body.recovery && body.recoveryFor && data.people.some((p) => p.id === body.recoveryFor)) { data.recovery = body.recovery; data.recoveryFor = body.recoveryFor; }
          else if (!kept) { data.recovery = null; data.recoveryFor = null; }
          r = { added: data.people.length - 1, updated: 0, removed };
        }
        await save();
        await log('people_restored', { mode, ...r });
        return r;
      });
    },
    /** A copy to the lab server, for the usage log. */
    async noteCopy(event, detail) { if (event === 'people_copied_to_lab') await log(event, detail && typeof detail === 'object' ? { count: Number(detail.count) || 0 } : {}); },
    /** Whether the machine may be connected now, and why not. */
    machine() {
      const c = api.current();
      if (!c) return { allowed: false, why: 'Sign in to run the machine.' };
      return c.canRunMachine ? { allowed: true, why: '' } : { allowed: false, why: c.why };
    },
    /** A student's limits against a recording's setup (checked by the main process before a recording starts). */
    checkSetup(setup) {
      const c = api.current();
      if (!c || c.kind !== 'student' || !c.limits || c.limits.maxSpeed == null) return '';
      const raw = setup && setup.speed != null ? String(setup.speed).trim() : '', v = raw === '' ? NaN : Number(raw);
      return Number.isFinite(v) && v <= c.limits.maxSpeed ? '' : 'Your operator set a maximum crosshead speed of ' + c.limits.maxSpeed + ' mm/min.';
    },
    /** Who is running the test, for the test file: written by the main process, not by the screens. */
    operatorBlock() {
      const c = api.current();
      if (!c || !c.canRunMachine) return null;
      const b = { name: c.name, username: c.username, kind: c.kind };
      if (c.kind === 'student' && c.responsible) b.responsible = { name: c.responsible.name, username: c.responsible.username, confirmedBy: c.responsible.by };
      if (c.kind === 'student' && c.training) b.training = { approvedBy: c.training.by, at: c.training.at };
      if (c.kind === 'student' && c.limits) b.limits = { maxSpeed: c.limits.maxSpeed, methods: c.limits.methods.map((m) => m.name) };
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

module.exports = { createPeople, hashSecret, verifySecret, KINDS, USERNAME, MIN_PASSWORD, IDLE_MS, LOCK_AFTER, LOCK_STEPS, TRAINING_ITEMS };
