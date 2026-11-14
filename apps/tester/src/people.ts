/* Who may run the machine, as the screens see it. The people list and the sign-in live in the Windows app's main
   process (apps/desktop/people.cjs), which checks every rule again; the screens only show names and kinds.
   In a browser there is no people list: running the machine is not offered there (run tests from the Windows app). */
import { csvCell } from '@tensile/core';

export type Kind = 'admin' | 'operator' | 'student';
export const KIND_NAMES: Record<Kind, string> = { admin: 'Admin', operator: 'Operator', student: 'Student' };
export const MIN_PASSWORD: Record<Kind, number> = { admin: 10, operator: 10, student: 8 };

/** The signed-in person. */
export interface Me {
  name: string; username: string; kind: Kind; kindName: string; mustChange: boolean;
  endDate: string | null; daysLeft: number | null;
  responsible: { name: string; username: string; by: 'gave access' | 'password' } | null;
  canRunMachine: boolean; why: string;
}
/** A person in the list (Admin: everyone; Operator: the students they added). */
export interface PersonView {
  id: string; username: string; name: string; kind: Kind; kindName: string; disabled: boolean; endDate: string | null; ended: boolean;
  mustChange: boolean; addedBy: string | null; createdAt: string | null; lastSignIn: string | null;
}
export interface ResponsibleChoice { id: string; name: string; username: string; kindName: string; gaveAccess: boolean }
export interface UsageRow { at: string; event: string; by: string | null; person?: string | null; [k: string]: unknown }
/** Who ran a test, as written in its file. */
export interface OperatorBlock {
  name: string; username: string; kind: Kind;
  responsible?: { name: string; username: string; confirmedBy: 'gave access' | 'password' };
}
export interface NewPerson { username: string; name: string; kind: Kind; password: string; endDate?: string | null }
export interface PersonChanges { name?: string; kind?: Kind; endDate?: string | null; disabled?: boolean; password?: string }

type Answer<T> = Promise<{ ok?: T; error?: string }>;
/** The calls the Windows app's preload offers (apps/desktop/preload.cjs). */
export interface PeopleBridge {
  status(): Answer<{ setUp: boolean; broken: string | null }>;
  setup(input: { username: string; name: string; password: string }): Answer<{ recoveryCode: string; me: Me }>;
  signIn(username: string, password: string): Answer<Me>;
  signOut(): Answer<null>;
  current(): Answer<Me | null>;
  touch(busy: boolean): Answer<Me | null>;
  changePassword(oldPassword: string, newPassword: string): Answer<Me>;
  list(): Answer<PersonView[]>;
  responsibleChoices(): Answer<ResponsibleChoice[]>;
  confirmResponsible(id: string, password?: string): Answer<Me>;
  add(input: NewPerson): Answer<PersonView>;
  update(id: string, changes: PersonChanges): Answer<PersonView>;
  recover(code: string, newPassword: string): Answer<{ recoveryCode: string; username: string }>;
  usageLog(): Answer<UsageRow[]>;
}

/** The bridge's calls, each giving its value or throwing its plain-words error. */
export class People {
  constructor(private readonly b: PeopleBridge) {}
  private async call<T>(a: Answer<T>): Promise<T> {
    const r = await a;
    if (!r || r.error !== undefined) throw new Error(r?.error || 'No answer from the app.');
    return r.ok as T;
  }
  status() { return this.call(this.b.status()); }
  setup(i: { username: string; name: string; password: string }) { return this.call(this.b.setup(i)); }
  signIn(u: string, p: string) { return this.call(this.b.signIn(u, p)); }
  signOut() { return this.call(this.b.signOut()); }
  current() { return this.call(this.b.current()); }
  touch(busy: boolean) { return this.call(this.b.touch(busy)); }
  changePassword(o: string, n: string) { return this.call(this.b.changePassword(o, n)); }
  list() { return this.call(this.b.list()); }
  responsibleChoices() { return this.call(this.b.responsibleChoices()); }
  confirmResponsible(id: string, password?: string) { return this.call(this.b.confirmResponsible(id, password)); }
  add(i: NewPerson) { return this.call(this.b.add(i)); }
  update(id: string, c: PersonChanges) { return this.call(this.b.update(id, c)); }
  recover(code: string, p: string) { return this.call(this.b.recover(code, p)); }
  usageLog() { return this.call(this.b.usageLog()); }
}

export const BROWSER_WHY = 'Tests are run from the Windows app on the lab computer, where people sign in. This browser version does not connect to the tester.';

/** What the Test screen may do now, and who is running it. Kept up to date by the frame (Shell). */
export class MachineAccess {
  me: Me | null = null;
  private listeners = new Set<() => void>();
  constructor(readonly people: People | null) {}
  set(me: Me | null): void { this.me = me; for (const l of this.listeners) l(); }
  subscribe = (l: () => void): (() => void) => { this.listeners.add(l); return () => this.listeners.delete(l); };
  check(): { allowed: boolean; why: string; operator: OperatorBlock | null } {
    if (!this.people) return { allowed: false, why: BROWSER_WHY, operator: null };
    const me = this.me;
    if (!me) return { allowed: false, why: 'Sign in to run the machine.', operator: null };
    if (!me.canRunMachine) return { allowed: false, why: me.why || 'You cannot run the machine now.', operator: null };
    return { allowed: true, why: '', operator: operatorBlockOf(me) };
  }
}

export function operatorBlockOf(me: Me | null): OperatorBlock | null {
  if (!me) return null;
  const b: OperatorBlock = { name: me.name, username: me.username, kind: me.kind };
  if (me.kind === 'student' && me.responsible) b.responsible = { name: me.responsible.name, username: me.responsible.username, confirmedBy: me.responsible.by };
  return b;
}
/** "Sam Student (student, sam)" for the file details. */
export const runByText = (o: OperatorBlock | null | undefined): string => (o ? o.name + ' (' + KIND_NAMES[o.kind].toLowerCase() + ', ' + o.username + ')' : 'Not recorded');
export const responsibleText = (o: OperatorBlock | null | undefined): string | null =>
  o?.responsible ? o.responsible.name + ' (' + o.responsible.username + '; ' + (o.responsible.confirmedBy === 'password' ? 'confirmed with their password' : 'gave access') + ')' : null;

const EVENT_NAMES: Record<string, string> = {
  admin_created: 'Admin created', sign_in: 'Signed in', sign_in_failed: 'Wrong password', sign_in_refused: 'Sign-in refused', sign_out: 'Signed out',
  signed_out_idle: 'Signed out (no activity)', password_changed: 'Password changed', password_reset: 'Password reset', person_added: 'Person added',
  person_changed: 'Person changed', responsible_confirmed: 'Responsible operator named', responsible_failed: 'Responsible operator: wrong password',
  test_started: 'Test started', test_ended: 'Test ended', admin_recovered: 'Admin password reset with the recovery code', recovery_failed: 'Wrong recovery code',
};
export const eventName = (e: string): string => EVENT_NAMES[e] ?? e;

/** The usage log as CSV (every text cell guarded against spreadsheet formulas). */
export function usageCsv(rows: UsageRow[]): string {
  const head = ['Time', 'What', 'Signed in', 'Person', 'Details'];
  const out = [head.map(csvCell).join(',')];
  for (const r of rows) {
    const { at, event, by, person, ...rest } = r;
    const details = Object.entries(rest).filter(([, v]) => v != null && v !== '').map(([k, v]) => k + ': ' + String(v)).join('; ');
    out.push([at, eventName(event), by ?? '', person ?? '', details].map((v) => csvCell(String(v))).join(','));
  }
  return out.join('\r\n') + '\r\n';
}
