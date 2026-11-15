/* Who may run the machine (people.cjs): the first admin, sign-in, the lock after wrong tries, the end date, the first
   password, who may manage whom, the training at a student's first test, the responsible operator, the usage log, a
   damaged file, the recovery code, and the backup file. */
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

type Me = { name: string; username: string; kind: string; mustChange: boolean; canRunMachine: boolean; why: string; daysLeft: number | null; responsible: { name: string; username: string; by: string } | null } | null;
type View = { id: string; username: string; name: string; kind: string; disabled: boolean; endDate: string | null; mustChange: boolean; addedBy: string | null };
interface People {
  status(): Promise<{ setUp: boolean; broken: string | null }>;
  setup(i: object): Promise<{ recoveryCode: string; me: Me }>;
  signIn(u: string, p: string): Promise<Me & { wrongSince?: { count: number; lastAt: string } | null }>;
  signOut(): Promise<null>;
  current(): Me;
  touch(busy: boolean): Me;
  changePassword(o: string, n: string): Promise<Me>;
  list(): Promise<View[]>;
  responsibleChoices(): Promise<{ id: string; name: string; gaveAccess: boolean }[]>;
  confirmResponsible(id: string, password?: string): Promise<Me>;
  add(i: object): Promise<View>;
  update(id: string, c: object): Promise<View>;
  trainingItems(): string[];
  completeTraining(ticked: boolean[], approverId: string, password: string): Promise<Me & { needsTraining: boolean }>;
  backupFile(): Promise<string>;
  restoreFile(text: string, mode: string): Promise<{ added: number; updated: number; removed?: number }>;
  usageReport(): Promise<{ username: string; tests: number; recordingMinutes: number; lastUse: string | null; asResponsible: number }[]>;
  exportForLab(): Promise<{ format: string; version: number; people: { username: string; hash: string; changedAt?: string; name: string }[] }>;
  importFromLab(copy: object): Promise<{ added: number; updated: number }>;
  checkSetup(setup: object): string;
  recover(code: string, p: string): Promise<{ recoveryCode: string; username: string }>;
  usageLog(): Promise<{ event: string; by: string | null; person?: string | null }[]>;
  machine(): { allowed: boolean; why: string };
  operatorBlock(): object | null;
  noteTest(e: string, d: object): Promise<void>;
}
const { createPeople, IDLE_MS, LOCK_STEPS } = createRequire(import.meta.url)('../people.cjs') as { createPeople: (dir: string, o?: { now?: () => number }) => People; IDLE_MS: number; LOCK_STEPS: number[] };

const dirs: string[] = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-people-')); dirs.push(d); return d; };
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

const ADMIN = { username: 'ale', name: 'Ale Admin', password: 'admin-password-1' };
let clock = Date.parse('2026-11-14T12:00:00');
const now = () => clock;
/* An admin, an operator (first password changed), and a student added by that operator. */
async function lab(dir = tmp()) {
  clock = Date.parse('2026-11-14T12:00:00');
  const p = createPeople(dir, { now });
  const { recoveryCode } = await p.setup(ADMIN);
  const op = await p.add({ username: 'olga', name: 'Olga Operator', kind: 'operator', password: 'first-op-pass' });
  await p.signOut();
  await p.signIn('olga', 'first-op-pass');
  await p.changePassword('first-op-pass', 'olga-own-password');
  const st = await p.add({ username: 'sam', name: 'Sam Student', kind: 'student', password: 'first-st1', endDate: '2026-12-20' });
  await p.signOut();
  return { p, dir, op, st, recoveryCode };
}
/* Sam signs in, chooses a password, and Olga approves the training at the first test. */
async function samReady(p: People, op: View) {
  await p.signIn('sam', 'first-st1');
  await p.changePassword('first-st1', 'sams-own-1');
  await p.completeTraining([true, true, true], op.id, 'olga-own-password');
}
const MIN = 60 * 1000;

describe('people on this computer', () => {
  it('starts with no one, makes the first admin once, and keeps passwords only as hashes', async () => {
    const dir = tmp();
    const p = createPeople(dir, { now });
    expect(await p.status()).toEqual({ setUp: false, broken: null });
    const { recoveryCode, me } = await p.setup(ADMIN);
    expect(recoveryCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(me).toMatchObject({ username: 'ale', kind: 'admin', canRunMachine: true });
    await expect(p.setup({ ...ADMIN, username: 'other' })).rejects.toThrow('already has an admin');
    const text = fs.readFileSync(path.join(dir, 'people.json'), 'utf8');
    expect(text).not.toContain(ADMIN.password);
    expect(text).not.toContain(recoveryCode.replace(/-/g, ''));
    expect(text).toMatch(/"hash": "scrypt\$16384\$8\$1\$/);
    expect(await p.status()).toEqual({ setUp: true, broken: null });
  });
  it('signs in with the right password only, and locks a username for 1, 3, 5, 15, then 60 minutes', async () => {
    const { p } = await lab();
    expect(LOCK_STEPS).toEqual([1, 3, 5, 15, 60]);
    await expect(p.signIn('nobody', 'whatever-pass')).rejects.toThrow('not right');
    for (let i = 0; i < 4; i++) await expect(p.signIn('olga', 'wrong')).rejects.toThrow('not right');
    /* the 5th wrong try locks for 1 minute, and says so */
    await expect(p.signIn('olga', 'wrong')).rejects.toThrow('Wait 1 minute');
    await expect(p.signIn('olga', 'olga-own-password')).rejects.toThrow('Too many wrong tries. Wait 1 minute');
    /* each wrong try after a lock ends locks for the next step; 60 minutes repeats */
    let lock = 1;
    for (const m of [3, 5, 15, 60, 60]) {
      clock += lock * MIN;
      await expect(p.signIn('olga', 'wrong')).rejects.toThrow('Wait ' + m + ' minutes');
      clock += (m - 1) * MIN;
      await expect(p.signIn('olga', 'olga-own-password')).rejects.toThrow('Too many wrong tries. Wait 1 minute');
      clock -= (m - 1) * MIN;
      lock = m;
    }
    clock += lock * MIN;
    expect(await p.signIn('OLGA ', 'olga-own-password')).toMatchObject({ username: 'olga', kind: 'operator', canRunMachine: true });
    /* a correct sign-in starts the ladder again: 4 wrong tries do not lock, the 5th locks for 1 minute */
    await p.signOut();
    for (let i = 0; i < 4; i++) await expect(p.signIn('olga', 'wrong')).rejects.toThrow('not right');
    await expect(p.signIn('olga', 'wrong')).rejects.toThrow('Wait 1 minute');
  });
  it('keeps a lock when the app is closed and opened again, and logs it', async () => {
    const { p, dir } = await lab();
    for (let i = 0; i < 5; i++) await expect(p.signIn('olga', 'wrong')).rejects.toThrow('not right');
    const again = createPeople(dir, { now });
    await expect(again.signIn('olga', 'olga-own-password')).rejects.toThrow('Too many wrong tries');
    expect(fs.readFileSync(path.join(dir, 'lockouts.json'), 'utf8')).not.toContain('wrong');
    clock += MIN;
    await again.signIn('ale', ADMIN.password);
    expect((await again.usageLog()).filter((r) => r.event === 'locked')).toHaveLength(1);
  });
  it('tells a person how many wrong tries there were for their username since they last signed in', async () => {
    const { p } = await lab();
    expect((await p.signIn('olga', 'olga-own-password')).wrongSince).toBeNull();
    await p.signOut();
    clock += 2 * MIN;
    await expect(p.signIn('olga', 'guess-1')).rejects.toThrow('not right');
    clock += MIN;
    await expect(p.signIn('olga', 'guess-2')).rejects.toThrow('not right');
    const me = await p.signIn('olga', 'olga-own-password');
    expect(me.wrongSince).toEqual({ count: 2, lastAt: new Date(clock).toISOString() });
    await p.signOut();
    expect((await p.signIn('olga', 'olga-own-password')).wrongSince).toBeNull();
  });
  it('makes a new person choose their own password before anything else', async () => {
    const { p } = await lab();
    const me = await p.signIn('sam', 'first-st1');
    expect(me).toMatchObject({ mustChange: true, canRunMachine: false, why: 'Choose your own password first.' });
    await expect(p.responsibleChoices()).rejects.toThrow('Choose your own password first');
    await expect(p.changePassword('first-st1', 'first-st1')).rejects.toThrow('different');
    await expect(p.changePassword('first-st1', 'short')).rejects.toThrow('at least 8');
    expect(await p.changePassword('first-st1', 'sams-own-1')).toMatchObject({ mustChange: false, canRunMachine: false, why: 'Complete the training first.' });
  });
  it('refuses a student after their end date, and needs an end date for every student', async () => {
    const { p } = await lab();
    await p.signIn('olga', 'olga-own-password');
    await expect(p.add({ username: 'nodate', name: 'No Date', kind: 'student', password: 'student-1' })).rejects.toThrow('needs an end date');
    await expect(p.add({ username: 'past', name: 'Past', kind: 'student', password: 'student-1', endDate: '2026-11-01' })).rejects.toThrow('in the past');
    await p.signOut();
    clock = Date.parse('2026-12-21T09:00:00');
    await expect(p.signIn('sam', 'first-st1')).rejects.toThrow('ended on 2026-12-20');
  });
  it('lets an operator manage only the students they added; a student manages nobody', async () => {
    const { p, st } = await lab();
    await p.signIn('ale', ADMIN.password);
    const op2 = await p.add({ username: 'otto', name: 'Otto Operator', kind: 'operator', password: 'otto-first-1' });
    await p.signOut();
    await p.signIn('otto', 'otto-first-1');
    await p.changePassword('otto-first-1', 'otto-own-pass');
    expect((await p.list()).map((v) => v.username)).toEqual(['otto']);
    await expect(p.update(st.id, { disabled: true })).rejects.toThrow('cannot change this person');
    await expect(p.add({ username: 'newop', name: 'New Op', kind: 'operator', password: 'newop-pass-1' })).rejects.toThrow('students only');
    await p.signOut();
    await p.signIn('olga', 'olga-own-password');
    expect((await p.list()).map((v) => v.username).sort()).toEqual(['olga', 'sam']);
    await expect(p.update(op2.id, { disabled: true })).rejects.toThrow('cannot change this person');
    expect(await p.update(st.id, { endDate: '2027-01-15' })).toMatchObject({ endDate: '2027-01-15' });
    expect(await p.update(st.id, { password: 'reset-pass-1' })).toMatchObject({ mustChange: true });
    await p.signOut();
    await p.signIn('sam', 'reset-pass-1');
    await p.changePassword('reset-pass-1', 'sams-own-1');
    await expect(p.list()).rejects.toThrow('does not allow');
    await expect(p.add({ username: 'friend', name: 'Friend', kind: 'student', password: 'friend-pass', endDate: '2026-12-01' })).rejects.toThrow('does not allow');
  });
  it('keeps at least one admin, and only the admin changes the kind of access', async () => {
    const { p, op } = await lab();
    await p.signIn('olga', 'olga-own-password');
    await expect(p.update(op.id, { kind: 'admin' })).rejects.toThrow('cannot change this person');
    await p.signOut();
    await p.signIn('ale', ADMIN.password);
    const me = (await p.list()).find((v) => v.username === 'ale')!;
    await expect(p.update(me.id, { disabled: true })).rejects.toThrow('your own access');
    await expect(p.update(me.id, { kind: 'operator' })).rejects.toThrow('your own kind');
    expect(await p.update(op.id, { kind: 'student', endDate: '2027-01-01' })).toMatchObject({ kind: 'student', endDate: '2027-01-01' });
  });
  it('lets a student run the machine only after naming a responsible operator; another operator confirms with their password', async () => {
    const { p, op } = await lab();
    await p.signIn('ale', ADMIN.password);
    await p.signOut();
    await samReady(p, op);
    expect(p.machine()).toEqual({ allowed: false, why: 'Choose your responsible operator first.' });
    expect(p.operatorBlock()).toBeNull();
    const choices = await p.responsibleChoices();
    expect(choices.map((c) => [c.name, c.gaveAccess])).toEqual([['Ale Admin', false], ['Olga Operator', true]]);
    const admin = choices.find((c) => c.name === 'Ale Admin')!;
    await expect(p.confirmResponsible(admin.id, 'wrong')).rejects.toThrow('Ale Admin’s password is not right');
    await expect(p.confirmResponsible(admin.id)).rejects.toThrow('not right');
    expect((await p.confirmResponsible(admin.id, ADMIN.password))!.responsible).toEqual({ name: 'Ale Admin', username: 'ale', by: 'password' });
    expect((await p.confirmResponsible(op.id))!.responsible).toEqual({ name: 'Olga Operator', username: 'olga', by: 'gave access' });
    expect(p.machine()).toEqual({ allowed: true, why: '' });
    expect(p.operatorBlock()).toEqual({ name: 'Sam Student', username: 'sam', kind: 'student', responsible: { name: 'Olga Operator', username: 'olga', confirmedBy: 'gave access' },
      training: { approvedBy: 'Olga Operator', at: new Date(clock).toISOString() } });
    /* while connected or recording: no change of responsible operator, no sign-out, no other sign-in */
    p.touch(true);
    await expect(p.confirmResponsible(admin.id, ADMIN.password)).rejects.toThrow('Disconnect first');
    await expect(p.signOut()).rejects.toThrow('Disconnect first');
    await expect(p.signIn('olga', 'olga-own-password')).rejects.toThrow('Disconnect first');
    /* a new sign-in starts without a responsible operator */
    p.touch(false);
    await p.signOut();
    await p.signIn('sam', 'sams-own-1');
    expect(p.current()!.responsible).toBeNull();
  });
  it('signs out after 15 minutes without activity, never while connected or recording', async () => {
    const { p } = await lab();
    await p.signIn('olga', 'olga-own-password');
    p.touch(true);
    clock += IDLE_MS + 60000;
    expect(p.current()).not.toBeNull();
    p.touch(false);
    clock += IDLE_MS + 1;
    expect(p.current()).toBeNull();
    expect(p.machine()).toEqual({ allowed: false, why: 'Sign in to run the machine.' });
  });
  it('turns access off and on, and a turned-off person cannot sign in', async () => {
    const { p, st } = await lab();
    await p.signIn('olga', 'olga-own-password');
    expect(await p.update(st.id, { disabled: true })).toMatchObject({ disabled: true });
    await p.signOut();
    await expect(p.signIn('sam', 'first-st1')).rejects.toThrow('turned off');
  });
  it('writes the usage log with who and what, never a password', async () => {
    const { p, dir } = await lab();
    await expect(p.signIn('sam', 'a-wrong-guess-123')).rejects.toThrow();
    await p.signIn('ale', ADMIN.password);
    await p.noteTest('test_started', { id: 's-abc-1' });
    const rows = await p.usageLog();
    const events = rows.map((r) => r.event);
    for (const e of ['admin_created', 'person_added', 'sign_in', 'password_changed', 'sign_out', 'sign_in_failed', 'test_started']) expect(events).toContain(e);
    const text = fs.readFileSync(path.join(dir, 'usage-log.jsonl'), 'utf8');
    for (const secret of [ADMIN.password, 'first-op-pass', 'olga-own-password', 'first-st1', 'a-wrong-guess-123']) expect(text).not.toContain(secret);
    await p.signOut();
    await p.signIn('olga', 'olga-own-password');
    await expect(p.usageLog()).rejects.toThrow('does not allow');
  });
  it('refuses everyone when the file is damaged, and never replaces it with an empty list', async () => {
    const { dir } = await lab();
    fs.writeFileSync(path.join(dir, 'people.json'), '{"format":"tensile-tester-people","version":1,"people":[{"id":');
    const p = createPeople(dir, { now });
    expect((await p.status()).broken).toContain('damaged');
    await expect(p.signIn('ale', ADMIN.password)).rejects.toThrow('damaged');
    await expect(p.setup({ ...ADMIN, username: 'intruder' })).rejects.toThrow('damaged');
    expect(fs.readFileSync(path.join(dir, 'people.json'), 'utf8')).toContain('"people":[{"id":');
    /* the previous version is kept beside it */
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'people.json.bak'), 'utf8')).people.length).toBeGreaterThan(0);
  });
  it('writes through a temporary file and leaves none behind', async () => {
    const { dir } = await lab();
    expect(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([]);
  });
  it('resets a forgotten admin password with the recovery code, once, and gives a new code', async () => {
    const { p, recoveryCode } = await lab();
    await expect(p.recover('AAAA-BBBB-CCCC-DDDD', 'new-admin-pass')).rejects.toThrow('not right');
    for (let i = 0; i < 3; i++) await expect(p.recover('AAAA-BBBB-CCCC-DDDD', 'new-admin-pass')).rejects.toThrow('not right');
    await expect(p.recover('AAAA-BBBB-CCCC-DDDD', 'new-admin-pass')).rejects.toThrow('Wait 1 minute');
    await expect(p.recover(recoveryCode, 'new-admin-pass')).rejects.toThrow('Too many wrong tries');
    clock += MIN;
    const r = await p.recover(recoveryCode.toLowerCase().replace(/-/g, ' '), 'new-admin-pass');
    expect(r.username).toBe('ale');
    expect(r.recoveryCode).not.toBe(recoveryCode);
    await expect(p.recover(recoveryCode, 'another-pass-1')).rejects.toThrow('not right');
    expect(await p.signIn('ale', 'new-admin-pass')).toMatchObject({ kind: 'admin' });
  });
  it('lets a student sign in without training, and asks for it, approved by any operator, at the first test', async () => {
    const { p, st } = await lab();
    await p.signIn('ale', ADMIN.password);
    const otto = await p.add({ username: 'otto', name: 'Otto Operator', kind: 'operator', password: 'otto-first-1' });
    const off = await p.add({ username: 'oona', name: 'Oona Off', kind: 'operator', password: 'oona-first-1' });
    await p.update(off.id, { disabled: true });
    await p.signOut();
    expect(await p.signIn('sam', 'first-st1')).toMatchObject({ username: 'sam', mustChange: true });
    await expect(p.completeTraining([true, true, true], otto.id, 'otto-first-1')).rejects.toThrow('Choose your own password first');
    expect(await p.changePassword('first-st1', 'sams-own-1')).toMatchObject({ needsTraining: true, canRunMachine: false, why: 'Complete the training first.' });
    expect(p.machine()).toEqual({ allowed: false, why: 'Complete the training first.' });
    expect(p.trainingItems()).toHaveLength(3);
    await expect(p.completeTraining([true, false, true], otto.id, 'otto-first-1')).rejects.toThrow('Tick every training item');
    await expect(p.completeTraining([true, true, true], otto.id, 'wrong-pass')).rejects.toThrow('Otto Operator’s password is not right');
    await expect(p.completeTraining([true, true, true], off.id, 'oona-first-1')).rejects.toThrow('Choose an operator from the list');
    await expect(p.completeTraining([true, true, true], st.id, 'sams-own-1')).rejects.toThrow('Choose an operator from the list');
    /* any operator or the admin may approve, with their own password (even before choosing their own) */
    const me = await p.completeTraining([true, true, true], otto.id, 'otto-first-1');
    expect(me).toMatchObject({ needsTraining: false, why: 'Choose your responsible operator first.' });
    /* saved: not asked again at the next sign-in, and shown on the People screen */
    await p.signOut();
    expect(await p.signIn('sam', 'sams-own-1')).toMatchObject({ needsTraining: false });
    await p.signOut();
    await p.signIn('olga', 'olga-own-password');
    expect((await p.list()).find((v) => v.username === 'sam')).toMatchObject({ training: { by: 'Otto Operator' } });
    await p.signOut();
    await p.signIn('ale', ADMIN.password);
    expect((await p.usageLog()).find((r) => r.event === 'training_completed')).toMatchObject({ person: 'sam', approvedBy: 'otto' });
  });
  it('keeps a student within their maximum crosshead speed, and writes their limits into the test file', async () => {
    const { p, st, op } = await lab();
    await p.signIn('olga', 'olga-own-password');
    await expect(p.update(st.id, { limits: { maxSpeed: -2 } })).rejects.toThrow('above 0');
    expect((await p.update(st.id, { limits: { maxSpeed: 20, methods: [{ id: 'm-1', name: 'Skin, slow' }] } }) as View & { limits: object }).limits).toEqual({ maxSpeed: 20, methods: [{ id: 'm-1', name: 'Skin, slow' }] });
    await p.signOut();
    await samReady(p, op);
    await p.confirmResponsible(op.id);
    expect(p.checkSetup({ speed: '30' })).toBe('Your operator set a maximum crosshead speed of 20 mm/min.');
    expect(p.checkSetup({ speed: 'fast' })).toContain('maximum crosshead speed');
    expect(p.checkSetup({ speed: '' })).toContain('maximum crosshead speed');
    expect(p.checkSetup({ speed: '20' })).toBe('');
    expect(p.operatorBlock()).toMatchObject({ limits: { maxSpeed: 20, methods: ['Skin, slow'] } });
  });
  it('reports tests, recording time, and last use per person, from the usage log', async () => {
    const { p, op } = await lab();
    await samReady(p, op);
    await p.confirmResponsible(op.id);
    await p.noteTest('test_started', { id: 's-1' });
    clock += 6 * 60000;
    await p.noteTest('test_ended', { id: 's-1' });
    await p.signOut();
    await p.signIn('olga', 'olga-own-password');
    const rows = await p.usageReport();
    expect(rows.map((r) => r.username).sort()).toEqual(['olga', 'sam']);
    expect(rows.find((r) => r.username === 'sam')).toMatchObject({ tests: 1, recordingMinutes: 6 });
    expect(rows.find((r) => r.username === 'olga')).toMatchObject({ asResponsible: 1 });
  });
  it('copies the list for the lab server (admin only) and brings a newer copy in without losing local people', async () => {
    const { p, st } = await lab();
    await p.signIn('olga', 'olga-own-password');
    await expect(p.exportForLab()).rejects.toThrow('does not allow');
    await p.signOut();
    await p.signIn('ale', ADMIN.password);
    const copy = await p.exportForLab();
    expect(copy.people.map((x) => x.username).sort()).toEqual(['ale', 'olga', 'sam']);
    expect(JSON.stringify(copy)).not.toContain('olga-own-password');
    /* on the second computer: a newer change to sam, and a new student from the other computer */
    const other = createPeople(tmp(), { now });
    await other.setup({ username: 'ale', name: 'Ale Admin', password: 'second-pc-admin' });
    const later = new Date(clock + 60000).toISOString();
    const edited = { ...copy, people: [...copy.people.map((x) => (x.username === 'sam' ? { ...x, name: 'Sam Student-Renamed', changedAt: later } : x)),
      { ...copy.people.find((x) => x.username === 'sam')!, id: 'p-other', username: 'una', name: 'Una Other', changedAt: later }] };
    expect(await other.importFromLab(copy)).toEqual({ added: 2, updated: 0 });
    expect(await p.importFromLab(edited)).toEqual({ added: 1, updated: 1 });
    const names = (await p.list()).map((v) => v.name).sort();
    expect(names).toEqual(['Ale Admin', 'Olga Operator', 'Sam Student-Renamed', 'Una Other']);
    expect((await p.list()).find((v) => v.id === st.id)?.username).toBe('sam');
    await expect(p.importFromLab({ format: 'nope' })).rejects.toThrow('not a people list');
    /* the signed-in admin's own account is never replaced by the copy */
    await p.signOut();
    expect(await other.signIn('ale', 'second-pc-admin')).toMatchObject({ kind: 'admin' });
  });
  it('saves a backup file (admin only) and restores it on another computer, refusing a changed file', async () => {
    const { p } = await lab();
    await p.signIn('olga', 'olga-own-password');
    await expect(p.backupFile()).rejects.toThrow('does not allow');
    await p.signOut();
    await p.signIn('ale', ADMIN.password);
    const text = await p.backupFile();
    const file = JSON.parse(text);
    expect(file).toMatchObject({ format: 'tensile-tester-people-backup', version: 1 });
    expect(file.check.sha256).toMatch(/^[0-9a-f]{64}$/);
    for (const secret of [ADMIN.password, 'olga-own-password', 'first-st1']) expect(text).not.toContain(secret);
    /* a new lab computer with its own admin */
    const other = createPeople(tmp(), { now });
    await other.setup({ username: 'nina', name: 'Nina New', password: 'new-pc-admin-1' });
    await expect(other.restoreFile(text.replace('Olga Operator', 'Olga Hacked'), 'merge')).rejects.toThrow('changed since it was saved');
    await expect(other.restoreFile('{"format":"nope"}', 'merge')).rejects.toThrow('not a people backup');
    await expect(other.restoreFile(text, 'sideways')).rejects.toThrow('Merge or Replace');
    expect(await other.restoreFile(text, 'merge')).toMatchObject({ added: 3, updated: 0 });
    expect((await other.list()).map((v) => v.username).sort()).toEqual(['ale', 'nina', 'olga', 'sam']);
    /* replace: the list becomes the backup's, and the signed-in admin is always kept */
    const third = createPeople(tmp(), { now });
    await third.setup({ username: 'nina', name: 'Nina New', password: 'new-pc-admin-1' });
    expect(await third.restoreFile(text, 'replace')).toMatchObject({ added: 3, removed: 0 });
    await third.signOut();
    expect(await third.signIn('olga', 'olga-own-password')).toMatchObject({ kind: 'operator' });
    await third.signOut();
    expect(await third.signIn('nina', 'new-pc-admin-1')).toMatchObject({ kind: 'admin' });
    const log = (await third.usageLog()).map((r) => r.event);
    expect(log).toContain('people_restored');
    /* a backup with no admin in it is refused */
    const noAdmin = { ...file, people: file.people.filter((x: { kind: string }) => x.kind !== 'admin') };
    await expect(third.restoreFile(JSON.stringify(noAdmin), 'replace')).rejects.toThrow();
  });
});
