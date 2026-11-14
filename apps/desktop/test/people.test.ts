/* Who may run the machine (people.cjs): the first admin, sign-in, wrong tries, the end date, the first password,
   who may manage whom, the responsible operator, the usage log, a damaged file, and the recovery code. */
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
  signIn(u: string, p: string): Promise<Me>;
  signOut(): Promise<null>;
  current(): Me;
  touch(busy: boolean): Me;
  changePassword(o: string, n: string): Promise<Me>;
  list(): Promise<View[]>;
  responsibleChoices(): Promise<{ id: string; name: string; gaveAccess: boolean }[]>;
  confirmResponsible(id: string, password?: string): Promise<Me>;
  add(i: object): Promise<View>;
  update(id: string, c: object): Promise<View>;
  recover(code: string, p: string): Promise<{ recoveryCode: string; username: string }>;
  usageLog(): Promise<{ event: string; by: string | null; person?: string | null }[]>;
  machine(): { allowed: boolean; why: string };
  operatorBlock(): object | null;
  noteTest(e: string, d: object): Promise<void>;
}
const { createPeople, IDLE_MS } = createRequire(import.meta.url)('../people.cjs') as { createPeople: (dir: string, o?: { now?: () => number }) => People; IDLE_MS: number };

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
  it('signs in with the right password only, and pauses a username after 5 wrong tries', async () => {
    const { p } = await lab();
    await expect(p.signIn('olga', 'wrong-password')).rejects.toThrow('not right');
    await expect(p.signIn('nobody', 'whatever-pass')).rejects.toThrow('not right');
    for (let i = 0; i < 4; i++) await expect(p.signIn('olga', 'wrong')).rejects.toThrow('not right');
    await expect(p.signIn('olga', 'olga-own-password')).rejects.toThrow('Too many wrong tries');
    clock += 16 * 60 * 1000;
    expect(await p.signIn('OLGA ', 'olga-own-password')).toMatchObject({ username: 'olga', kind: 'operator', canRunMachine: true });
  });
  it('makes a new person choose their own password before anything else', async () => {
    const { p } = await lab();
    const me = await p.signIn('sam', 'first-st1');
    expect(me).toMatchObject({ mustChange: true, canRunMachine: false, why: 'Choose your own password first.' });
    await expect(p.responsibleChoices()).rejects.toThrow('Choose your own password first');
    await expect(p.changePassword('first-st1', 'first-st1')).rejects.toThrow('different');
    await expect(p.changePassword('first-st1', 'short')).rejects.toThrow('at least 8');
    expect(await p.changePassword('first-st1', 'sams-own-1')).toMatchObject({ mustChange: false, canRunMachine: false, why: 'Choose your responsible operator first.' });
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
    await p.signIn('sam', 'first-st1');
    await p.changePassword('first-st1', 'sams-own-1');
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
    expect(p.operatorBlock()).toEqual({ name: 'Sam Student', username: 'sam', kind: 'student', responsible: { name: 'Olga Operator', username: 'olga', confirmedBy: 'gave access' } });
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
    const r = await p.recover(recoveryCode.toLowerCase().replace(/-/g, ' '), 'new-admin-pass');
    expect(r.username).toBe('ale');
    expect(r.recoveryCode).not.toBe(recoveryCode);
    await expect(p.recover(recoveryCode, 'another-pass-1')).rejects.toThrow('not right');
    expect(await p.signIn('ale', 'new-admin-pass')).toMatchObject({ kind: 'admin' });
  });
});
