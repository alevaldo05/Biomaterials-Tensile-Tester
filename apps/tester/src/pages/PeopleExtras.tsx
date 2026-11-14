/* More of the People screen: a student's training sign-off and limits, the usage report, adding a class from a list,
   printable sign-in slips, and the copy of the people list to and from the lab server. Every rule is checked again
   in the Windows app's main process (apps/desktop/people.cjs). */
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';
import { csvCell } from '@tensile/core';
import { Field } from '@tensile/ui';
import type { Limits, NewPerson, People, PersonView, UsageReportRow } from '../people';
import { MIN_PASSWORD } from '../people';
import { save } from '../exports';

const msgOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const when = (iso: string | null): string => { if (!iso) return '—'; const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(); };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The training items, all ticked by the operator before the student's first sign-in. */
export function TrainingSignOff(p: { people: People; person: PersonView; onDone: (msg: string) => void; onCancel: () => void }): JSX.Element {
  const [items, setItems] = useState<string[] | null>(null);
  const [ticked, setTicked] = useState<boolean[]>([]);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { p.people.trainingItems().then((i) => { setItems(i); setTicked(i.map(() => false)); }, (e: unknown) => setErr(msgOf(e))); }, [p.people]);
  return (
    <form className="inline-form" onSubmit={(e) => {
      e.preventDefault(); setBusy(true); setErr('');
      p.people.signOffTraining(p.person.id, ticked).then(() => p.onDone('Training signed off for ' + p.person.name + '. They can sign in now.'), (x: unknown) => setErr(msgOf(x))).finally(() => setBusy(false));
    }}>
      <fieldset className="checks-box">
        <legend>Training for {p.person.name}</legend>
        {items?.map((t, i) => (
          <label key={t} className="check"><input type="checkbox" checked={!!ticked[i]} onChange={(e) => setTicked(ticked.map((v, j) => (j === i ? e.target.checked : v)))} /> {t}</label>
        ))}
        <p className="hint">Draft wording. Your sign-off is saved with the date and your name. It is a record, not a safety certification.</p>
      </fieldset>
      {err ? <p className="error" role="alert">{err}</p> : null}
      <span className="row"><button type="submit" className="primary" disabled={busy || !items || !ticked.every(Boolean)}>Sign off training</button><button type="button" onClick={p.onCancel}>Cancel</button></span>
    </form>
  );
}

/** A student's limits: test methods (by name) and a maximum crosshead speed. */
export function LimitsEditor(p: { people: People; person: PersonView; methods: { id: string; name: string }[]; onDone: (msg: string) => void; onCancel: () => void }): JSX.Element {
  const cur = p.person.limits;
  const [speed, setSpeed] = useState(cur?.maxSpeed != null ? String(cur.maxSpeed) : '');
  const [names, setNames] = useState<string[]>(cur?.methods.map((m) => m.name) ?? []);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const all = [...new Map([...p.methods, ...(cur?.methods ?? [])].map((m) => [m.name, m])).values()];
  return (
    <form className="inline-form" onSubmit={(e) => {
      e.preventDefault(); setBusy(true); setErr('');
      const limits: Limits | null = speed.trim() || names.length ? { maxSpeed: speed.trim() ? Number(speed) : null, methods: all.filter((m) => names.includes(m.name)) } : null;
      p.people.update(p.person.id, { limits }).then(() => p.onDone(limits ? 'Limits saved for ' + p.person.name + '.' : 'Limits removed for ' + p.person.name + '.'), (x: unknown) => setErr(msgOf(x))).finally(() => setBusy(false));
    }}>
      <Field label="Maximum crosshead speed" unit="mm/min" hint="Leave empty for no limit. The app cannot slow the machine: Start recording is refused when the setup asks for more.">
        <input type="number" min="0" step="any" inputMode="decimal" value={speed} onChange={(e) => setSpeed(e.target.value)} />
      </Field>
      <fieldset className="checks-box">
        <legend>Test methods allowed</legend>
        {all.length ? all.map((m) => (
          <label key={m.name} className="check"><input type="checkbox" checked={names.includes(m.name)} onChange={(e) => setNames(e.target.checked ? [...names, m.name] : names.filter((n) => n !== m.name))} /> {m.name}</label>
        )) : <p className="hint">No test methods on this computer yet (Test methods screen).</p>}
        <p className="hint">None ticked: any method, or none.</p>
      </fieldset>
      {err ? <p className="error" role="alert">{err}</p> : null}
      <span className="row"><button type="submit" className="primary" disabled={busy}>Save limits</button><button type="button" onClick={p.onCancel}>Cancel</button></span>
    </form>
  );
}

export function usageReportCsv(rows: UsageReportRow[]): string {
  const out = ['Name,Username,Access,Tests run,Recording time (min),Responsible operator for (tests),Last use'];
  for (const r of rows) out.push([r.name, r.username, r.kindName, r.tests, r.recordingMinutes, r.asResponsible, r.lastUse ?? ''].map(csvCell).join(','));
  return out.join('\r\n') + '\r\n';
}

export function UsageReport(p: { people: People }): JSX.Element {
  const [rows, setRows] = useState<UsageReportRow[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { p.people.usageReport().then(setRows, (e: unknown) => { setRows([]); setErr(msgOf(e)); }); }, [p.people]);
  return (
    <div className="page-form">
      <h2>Usage</h2>
      <p className="hint">Tests run, time spent recording, and last use, from the usage log on this computer.</p>
      {err ? <p className="error" role="alert">{err}</p> : null}
      {rows === null ? <p className="hint" role="status">Loading…</p> : rows.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">Name</th><th scope="col">Access</th><th scope="col">Tests run</th><th scope="col">Recording time</th><th scope="col">Responsible for</th><th scope="col">Last use</th></tr></thead>
            <tbody>{rows.map((r) => <tr key={r.username}><td>{r.name}</td><td>{r.kindName}</td><td>{r.tests}</td><td>{r.recordingMinutes} min</td><td>{r.asResponsible} test{r.asResponsible === 1 ? '' : 's'}</td><td>{when(r.lastUse)}</td></tr>)}</tbody>
          </table>
        </div>) : null}
      {rows?.length ? <p><button type="button" onClick={() => save('usage-report.csv', [usageReportCsv(rows)], 'text/csv;charset=utf-8')}>Download usage (CSV)</button></p> : null}
    </div>
  );
}

/** A class list pasted or opened as CSV: name, username, first password, end date (one student per line). */
export function parseClassList(text: string, endDefault: string): { rows: NewPerson[]; problems: string[] } {
  const rows: NewPerson[] = [], problems: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
    if (i === 0 && /^name$/i.test(cells[0] ?? '') && /user/i.test(cells[1] ?? '')) return;   /* a heading row */
    const [name = '', username = '', password = '', end = ''] = cells;
    const endDate = end || endDefault;
    const why = !name ? 'no name' : !/^[a-z0-9][a-z0-9._-]{1,39}$/.test(username.toLowerCase()) ? 'the username is not valid' : password.length < MIN_PASSWORD.student ? 'the first password is shorter than ' + MIN_PASSWORD.student + ' characters' : !DATE.test(endDate) ? 'no end date' : '';
    if (why) problems.push('Line ' + (i + 1) + ': ' + why + '.');
    else rows.push({ name, username: username.toLowerCase(), password, kind: 'student', endDate });
  });
  return { rows, problems };
}

export function ClassList(p: { people: People; onAdded: (slips: Slip[], msg: string) => void }): JSX.Element {
  const [text, setText] = useState(''), [end, setEnd] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const parsed = parseClassList(text, end);
  const addAll = async () => {
    setBusy(true); setErr('');
    const slips: Slip[] = [], failed: string[] = [];
    for (const r of parsed.rows) {
      try { await p.people.add(r); slips.push({ name: r.name, username: r.username, password: r.password }); } catch (e) { failed.push(r.username + ': ' + msgOf(e)); }
    }
    setBusy(false);
    if (failed.length) setErr('Not added: ' + failed.join(' '));
    if (slips.length) { setText(''); p.onAdded(slips, slips.length + ' student' + (slips.length === 1 ? '' : 's') + ' added. Sign off their training before their first sign-in.'); }
  };
  return (
    <details className="page-form more">
      <summary>Add students from a class list</summary>
      <div className="more-body">
        <p className="hint">One student per line: name, username, first password, end date (YYYY-MM-DD; optional when set below). Paste from a spreadsheet, or open a CSV. Nothing is saved until you press Add.</p>
        <Field label="Class list"><textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} /></Field>
        <p className="row">
          <label className="file-button">Open a CSV<input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then(setText); e.target.value = ''; }} /></label>
        </p>
        <Field label="End date for lines without one"><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        {parsed.rows.length ? (
          <div className="table-wrap"><table className="data-table"><caption>Preview: {parsed.rows.length} student{parsed.rows.length === 1 ? '' : 's'}</caption>
            <thead><tr><th scope="col">Name</th><th scope="col">Username</th><th scope="col">Ends</th></tr></thead>
            <tbody>{parsed.rows.map((r) => <tr key={r.username}><td>{r.name}</td><td>{r.username}</td><td>{r.endDate}</td></tr>)}</tbody></table></div>) : null}
        {parsed.problems.length ? <ul className="error">{parsed.problems.map((x) => <li key={x}>{x}</li>)}</ul> : null}
        {err ? <p className="error" role="alert">{err}</p> : null}
        <p><button type="button" className="primary" disabled={busy || !parsed.rows.length || parsed.problems.length > 0} onClick={() => void addAll()}>Add {parsed.rows.length || ''} student{parsed.rows.length === 1 ? '' : 's'}</button></p>
      </div>
    </details>
  );
}

/** A username and first password to hand over. Kept only in this screen until printed or cleared; never saved. */
export interface Slip { name: string; username: string; password: string }

export function Slips(p: { slips: Slip[]; onClear: () => void }): JSX.Element | null {
  if (!p.slips.length) return null;
  const print = () => {
    document.body.classList.add('printing-slips');
    const done = () => { document.body.classList.remove('printing-slips'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  };
  return (
    <div className="page-form slips-box" role="region" aria-label="Sign-in slips">
      <h2>Sign-in slips</h2>
      <p className="hint">{p.slips.length} slip{p.slips.length === 1 ? '' : 's'} with the username and first password, shown only until you clear them. They are not saved anywhere; the person chooses their own password at the first sign-in.</p>
      <p className="row"><button type="button" className="primary" onClick={print}>Print slips</button><button type="button" onClick={p.onClear}>Clear</button></p>
      {createPortal(
        <div className="slip-sheet" aria-hidden="true">
          {p.slips.map((s) => (
            <div key={s.username} className="slip">
              <p><strong>Biomaterials Tensile Tester</strong>: sign-in on the lab computer</p>
              <p>Name: {s.name}</p><p>Username: <strong>{s.username}</strong></p><p>First password: <strong>{s.password}</strong></p>
              <p>You choose your own password at the first sign-in. Keep this slip private.</p>
            </div>
          ))}
        </div>, document.body)}
    </div>
  );
}

/** Admin: copy the people list to the lab server, or bring the lab server's copy here (for a second lab computer). */
export function LabCopy(p: { people: People; labAdmin: boolean; onDone: () => void }): JSX.Element {
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false);
  const run = (f: () => Promise<string>) => { setBusy(true); setMsg(null); f().then((t) => { setMsg({ text: t, bad: false }); p.onDone(); }, (e: unknown) => setMsg({ text: msgOf(e), bad: true })).finally(() => { setBusy(false); setConfirm(false); }); };
  return (
    <div className="page-form">
      <h2>Second lab computer</h2>
      <p className="hint">Copy this list to the lab server, then on the other lab computer copy it from there. Passwords travel only as the scrambled form kept on this computer. People only on one computer are kept; a newer change wins. Needs a lab-server sign-in as a lab-server admin.</p>
      {!p.labAdmin ? <p className="hint">Sign in to the lab server as an admin (top right) to copy.</p> : null}
      <p className="row">
        <button type="button" disabled={busy || !p.labAdmin} onClick={() => run(async () => { const r = await p.people.copyToLab(); return r.count + ' people copied to the lab server.'; })}>Copy to the lab server</button>
        {!confirm ? <button type="button" disabled={busy || !p.labAdmin} onClick={() => setConfirm(true)}>Copy from the lab server…</button>
          : <><button type="button" className="primary" disabled={busy} onClick={() => run(async () => { const r = await p.people.copyFromLab(); return r.added + ' added and ' + r.updated + ' updated from the lab server.'; })}>Copy from the lab server now</button><button type="button" onClick={() => setConfirm(false)}>Cancel</button></>}
      </p>
      {msg ? <p className={msg.bad ? 'error' : 'hint'} role={msg.bad ? 'alert' : 'status'}>{msg.text}</p> : null}
    </div>
  );
}
