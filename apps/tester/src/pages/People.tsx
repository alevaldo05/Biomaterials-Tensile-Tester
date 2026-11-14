/* People: who may run the machine on this computer (the Windows app). The admin sees and manages everyone and
   downloads the usage log; an operator sees and manages only the students they added. Every rule is checked again in
   the app's main process (apps/desktop/people.cjs); this screen shows its answer when something is refused. */
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { Field } from '@tensile/ui';
import type { Kind, Me, People as PeopleApi, PersonView } from '../people';
import { KIND_NAMES, MIN_PASSWORD, usageCsv } from '../people';
import { save } from '../exports';
import './pages.css';

const when = (iso: string | null): string => { if (!iso) return '—'; const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(); };
const msgOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const localToday = (): string => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

type Edit = { id: string; what: 'password' | 'end'; value: string };

export function PeoplePage(p: { people: PeopleApi; me: Me }): JSX.Element {
  const admin = p.me.kind === 'admin';
  const kinds: Kind[] = admin ? ['student', 'operator', 'admin'] : ['student'];
  const [items, setItems] = useState<PersonView[] | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Edit | null>(null);
  const empty = { username: '', name: '', kind: 'student' as Kind, password: '', endDate: '' };
  const [form, setForm] = useState(empty);

  const reload = useCallback(() => { p.people.list().then(setItems, (e: unknown) => { setItems([]); setMsg({ text: msgOf(e), bad: true }); }); }, [p.people]);
  useEffect(reload, [reload]);
  const run = async (f: () => Promise<unknown>, done: string): Promise<boolean> => {
    setBusy(true); setMsg(null);
    try { await f(); reload(); setMsg({ text: done, bad: false }); return true; } catch (e) { setMsg({ text: msgOf(e), bad: true }); return false; } finally { setBusy(false); }
  };
  const add = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(() => p.people.add({ username: form.username, name: form.name, kind: form.kind, password: form.password, endDate: form.endDate || null }),
      form.name.trim() + ' added. Give them their username and first password; they choose their own at the first sign-in.');
    if (ok) setForm(empty);
  };
  const sendEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const ok = edit.what === 'password'
      ? await run(() => p.people.update(edit.id, { password: edit.value }), 'New first password set. They choose their own at the next sign-in.')
      : await run(() => p.people.update(edit.id, { endDate: edit.value || null }), 'End date saved.');
    if (ok) setEdit(null);
  };
  const downloadLog = async () => {
    setMsg(null);
    try { save('usage-log-' + localToday() + '.csv', [usageCsv(await p.people.usageLog())], 'text/csv;charset=utf-8'); } catch (e) { setMsg({ text: msgOf(e), bad: true }); }
  };
  const others = (items ?? []).filter((v) => v.username !== p.me.username);
  const minPw = MIN_PASSWORD[form.kind];

  return (
    <main className="page" id="main-content">
      <section className="page-block" aria-labelledby="people-h">
        <div className="page-head"><h1 id="people-h">People</h1></div>
        <p className="hint">
          {admin ? 'Everyone who may run the machine on this computer. Operators add their own students; you can manage everyone.'
            : 'The students you gave access to. Each student signs in with their own username and password, and names you (or another operator) as responsible before each test.'}
          {' '}Sign-in keeps casual use off the machine; it is not a lock on the tester itself.
        </p>
        {items === null ? <p className="hint" role="status">Loading people…</p> : null}
        {items && others.length === 0 ? <p className="hint">{admin ? 'No one else yet.' : 'You have not added any students yet.'}</p> : null}
        {others.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th scope="col">Name</th><th scope="col">Username</th><th scope="col">Access</th><th scope="col">Ends</th><th scope="col">Status</th>{admin ? <th scope="col">Added by</th> : null}<th scope="col">Last sign-in</th><th scope="col">Actions</th></tr></thead>
              <tbody>
                {others.map((v) => (
                  <tr key={v.id}>
                    <td>{v.name}</td>
                    <td>{v.username}</td>
                    <td>{admin ? (
                      <select aria-label={'Access of ' + v.name} value={v.kind} disabled={busy}
                        onChange={(e) => { const k = e.target.value as Kind; if (k === 'student' && !v.endDate) { setMsg({ text: 'Set an end date first: a student needs one.', bad: true }); return; } void run(() => p.people.update(v.id, { kind: k }), 'Access changed.'); }}>
                        {(['admin', 'operator', 'student'] as Kind[]).map((k) => <option key={k} value={k}>{KIND_NAMES[k]}</option>)}
                      </select>) : v.kindName}</td>
                    <td>{v.endDate ?? '—'}{v.ended ? <span className="badge badge-soft">Ended</span> : null}</td>
                    <td>{v.disabled ? 'Turned off' : v.mustChange ? 'Must choose a password' : 'Active'}</td>
                    {admin ? <td>{v.addedBy ?? '—'}</td> : null}
                    <td>{when(v.lastSignIn)}</td>
                    <td>
                      <span className="row">
                        <button type="button" disabled={busy} onClick={() => void run(() => p.people.update(v.id, { disabled: !v.disabled }), v.disabled ? 'Access turned on.' : 'Access turned off.')}>{v.disabled ? 'Turn on' : 'Turn off'}</button>
                        <button type="button" disabled={busy} onClick={() => setEdit(edit?.id === v.id && edit.what === 'password' ? null : { id: v.id, what: 'password', value: '' })}>Reset password</button>
                        <button type="button" disabled={busy} onClick={() => setEdit(edit?.id === v.id && edit.what === 'end' ? null : { id: v.id, what: 'end', value: v.endDate ?? '' })}>End date</button>
                      </span>
                      {edit?.id === v.id ? (
                        <form className="inline-form" onSubmit={(e) => void sendEdit(e)}>
                          {edit.what === 'password' ? (
                            <Field label={'New first password for ' + v.name} hint={'At least ' + MIN_PASSWORD[v.kind] + ' characters. They choose their own at the next sign-in.'}>
                              <input type="password" autoComplete="new-password" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} />
                            </Field>
                          ) : (
                            <Field label={'End date for ' + v.name} hint={v.kind === 'student' ? 'Required for a student. After it, sign-in is refused until extended.' : 'Optional.'}>
                              <input type="date" min={localToday()} value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} />
                            </Field>
                          )}
                          <span className="row"><button type="submit" className="primary" disabled={busy || (edit.what === 'password' && edit.value.length < MIN_PASSWORD[v.kind])}>Save</button><button type="button" onClick={() => setEdit(null)}>Cancel</button></span>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {msg ? <p className={msg.bad ? 'error' : 'hint'} role={msg.bad ? 'alert' : 'status'}>{msg.text}</p> : null}

        <form className="page-form" onSubmit={(e) => void add(e)}>
          <h2>{admin ? 'Add a person' : 'Add a student'}</h2>
          <div className="form-grid">
            <Field label="Name" required><input type="text" autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Username" required hint="Lowercase letters, digits, and . _ -"><input type="text" autoComplete="off" autoCapitalize="none" spellCheck={false} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
            {admin ? (
              <Field label="Access">
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>{kinds.map((k) => <option key={k} value={k}>{KIND_NAMES[k]}</option>)}</select>
              </Field>
            ) : null}
            <Field label="First password or code" required hint={'At least ' + minPw + ' characters. They choose their own at the first sign-in.'}>
              <input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <Field label="End date" required={form.kind === 'student'} hint={form.kind === 'student' ? 'For example the end of term. After it, sign-in is refused until extended.' : 'Optional.'}>
              <input type="date" min={localToday()} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </Field>
          </div>
          <p><button type="submit" className="primary" disabled={busy || !form.name.trim() || !form.username.trim() || form.password.length < minPw || (form.kind === 'student' && !form.endDate)}>{form.kind === 'student' ? 'Add student' : 'Add ' + KIND_NAMES[form.kind].toLowerCase()}</button></p>
        </form>

        {admin ? (
          <div className="page-form">
            <h2>Usage log</h2>
            <p className="hint">Every sign-in, wrong password, test started and ended, and change to this list, with the time and who did it. No password is ever written to it.</p>
            <p><button type="button" onClick={() => void downloadLog()}>Download usage log (CSV)</button></p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
