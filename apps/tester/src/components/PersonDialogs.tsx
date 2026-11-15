/* Sign-in on the lab computer (the Windows app): sign in, choose your own password, set up this computer (the first
   admin and the recovery code), a forgotten password (students ask their operator, operators the admin, the admin uses
   the recovery code), and the line after sign-in that names wrong tries for your username. Every rule is checked in the
   app's main process (apps/desktop/people.cjs); these forms only collect the words and show its answer. */
import { useState } from 'react';
import type { JSX } from 'react';
import type { Me, People, WrongSince } from '../people';
import { MIN_PASSWORD } from '../people';

const msgOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function PersonSignIn(p: { people: People; onDone: (me: Me) => void; onCancel: () => void; onForgot: () => void }): JSX.Element {
  const [name, setName] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); setBusy(true); setErr(''); p.people.signIn(name, pw).then(p.onDone, (x: unknown) => setErr(msgOf(x))).finally(() => { setBusy(false); setPw(''); }); }}>
      <p className="hint">Sign in with the username and password (or code) you were given. Students: your operator gave you these.</p>
      <label className="field"><span className="field-label">Username</span><input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label className="field"><span className="field-label">Password or code</span><input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
      {err ? <p className="error" role="alert">{err}</p> : null}
      <p className="row"><button type="submit" className="primary" disabled={busy}>Sign in</button><button type="button" onClick={p.onCancel}>Cancel</button></p>
      <p><button type="button" className="link" onClick={p.onForgot}>Forgot your password?</button></p>
    </form>
  );
}

export function PersonPassword(p: { people: People; me: Me; onDone: (me: Me) => void; onCancel: () => void }): JSX.Element {
  const [cur, setCur] = useState(''), [next, setNext] = useState(''), [again, setAgain] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const min = MIN_PASSWORD[p.me.kind];
  return (
    <form className="form" onSubmit={(e) => {
      e.preventDefault();
      if (next !== again) { setErr('The two new passwords are different.'); return; }
      setBusy(true); setErr('');
      p.people.changePassword(cur, next).then(p.onDone, (x: unknown) => setErr(msgOf(x))).finally(() => setBusy(false));
    }}>
      {p.me.mustChange ? <p>Choose your own password before you continue. The person who gave you access will not know it.</p> : null}
      <label className="field"><span className="field-label">{p.me.mustChange ? 'Password or code you were given' : 'Current password'}</span><input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></label>
      <label className="field"><span className="field-label">New password</span><input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={min} /><span className="field-hint">At least {min} characters.</span></label>
      <label className="field"><span className="field-label">New password again</span><input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></label>
      {err ? <p className="error" role="alert">{err}</p> : null}
      <p className="row"><button type="submit" className="primary" disabled={busy}>Change password</button><button type="button" onClick={p.onCancel}>{p.me.mustChange ? 'Sign out' : 'Cancel'}</button></p>
    </form>
  );
}

/** Shows a recovery code once, with a box to tick before closing. */
function RecoveryCode(p: { code: string; onDone: () => void }): JSX.Element {
  const [kept, setKept] = useState(false);
  return (
    <div className="form">
      <p>Your admin recovery code. It resets the admin password if it is forgotten. It is shown <strong>only now</strong>; write it down and keep it somewhere safe, away from this computer.</p>
      <p className="recovery-code" aria-label="Recovery code">{p.code}</p>
      <label className="check"><input type="checkbox" checked={kept} onChange={(e) => setKept(e.target.checked)} /> I wrote the recovery code down.</label>
      <p className="row"><button type="button" className="primary" disabled={!kept} onClick={p.onDone}>Done</button></p>
    </div>
  );
}

export function SetUpComputer(p: { people: People; onDone: (me: Me) => void }): JSX.Element {
  const [form, setForm] = useState({ name: '', username: '', password: '', again: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ code: string; me: Me } | null>(null);
  if (done) return <RecoveryCode code={done.code} onDone={() => p.onDone(done.me)} />;
  return (
    <form className="form" onSubmit={(e) => {
      e.preventDefault();
      if (form.password !== form.again) { setErr('The two passwords are different.'); return; }
      setBusy(true); setErr('');
      p.people.setup({ name: form.name, username: form.username, password: form.password })
        .then((r) => setDone({ code: r.recoveryCode, me: r.me }), (x: unknown) => setErr(msgOf(x))).finally(() => setBusy(false));
    }}>
      <p>This computer has no people yet. Create the admin account: the admin decides who may run the machine (operators and students).</p>
      <label className="field"><span className="field-label">Your name</span><input type="text" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
      <label className="field"><span className="field-label">Username</span><input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /><span className="field-hint">Lowercase letters, digits, and . _ -</span></label>
      <label className="field"><span className="field-label">Password</span><input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={MIN_PASSWORD.admin} /><span className="field-hint">At least {MIN_PASSWORD.admin} characters.</span></label>
      <label className="field"><span className="field-label">Password again</span><input type="password" autoComplete="new-password" value={form.again} onChange={(e) => setForm({ ...form, again: e.target.value })} required /></label>
      {err ? <p className="error" role="alert">{err}</p> : null}
      <p className="row"><button type="submit" className="primary" disabled={busy}>Create the admin</button></p>
    </form>
  );
}

export function RecoverAdmin(p: { people: People; onDone: () => void; onCancel: () => void }): JSX.Element {
  const [code, setCode] = useState(''), [pw, setPw] = useState(''), [again, setAgain] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ code: string; username: string } | null>(null);
  if (fresh) return (<><p>The admin password for <strong>{fresh.username}</strong> is reset. Sign in with it. The old recovery code no longer works; here is the new one.</p><RecoveryCode code={fresh.code} onDone={p.onDone} /></>);
  return (
    <form className="form" onSubmit={(e) => {
      e.preventDefault();
      if (pw !== again) { setErr('The two passwords are different.'); return; }
      setBusy(true); setErr('');
      p.people.recover(code, pw).then((r) => setFresh({ code: r.recoveryCode, username: r.username }), (x: unknown) => setErr(msgOf(x))).finally(() => setBusy(false));
    }}>
      <p>Students: ask your operator. Operators: ask the admin.</p>
      <p><strong>Admin: recovery code</strong></p>
      <label className="field"><span className="field-label">Recovery code</span><input type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} required /></label>
      <label className="field"><span className="field-label">New admin password</span><input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={MIN_PASSWORD.admin} /><span className="field-hint">At least {MIN_PASSWORD.admin} characters.</span></label>
      <label className="field"><span className="field-label">New password again</span><input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></label>
      {err ? <p className="error" role="alert">{err}</p> : null}
      <p className="row"><button type="submit" className="primary" disabled={busy}>Reset the admin password</button><button type="button" onClick={p.onCancel}>Cancel</button></p>
    </form>
  );
}

/** After sign-in: how many wrong tries there were for your username since you last signed in. */
export function WrongTries(p: { since: WrongSince; onClose: () => void }): JSX.Element {
  const n = p.since.count;
  const last = p.since.lastAt ? new Date(p.since.lastAt) : null;
  return (
    <p className="notice wrong-tries" role="status">
      <span>{n} wrong {n === 1 ? 'try' : 'tries'} for your username since you last signed in{last && !Number.isNaN(last.getTime()) ? ' (last: ' + last.toLocaleString() + ')' : ''}.</span>
      <button type="button" className="quiet" aria-label="Close" onClick={p.onClose}>×</button>
    </p>
  );
}
