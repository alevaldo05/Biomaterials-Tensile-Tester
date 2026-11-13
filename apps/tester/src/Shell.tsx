/* The frame around the pages: the header with navigation and the sign-in area, and which page is shown.
   The lab database is optional. Without it (or in the learning edition) the app is the test screen alone. */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { App, useTheme } from './App';
import type { TestController } from './controller';
import { ApiError, LabApi } from './lab-api';
import type { Account, LabUser } from './lab-api';
import { Admin } from './pages/Admin';
import { History } from './pages/History';
import { PREVIEW } from './preview-text';

/* The app is served at <site>/app/ (on GitHub Pages and behind the gateway), so the website is one folder up. */
const SITE_URL = '../';
type Page = 'test' | 'history' | 'admin';

function Dialog(p: { open: boolean; title: string; onClose?: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement | null>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (p.open && !d.open) d.showModal(); if (!p.open && d.open) d.close(); }, [p.open]);
  return (
    <dialog ref={ref} className="ask" aria-label={p.title} onCancel={(e) => { e.preventDefault(); p.onClose?.(); }}>
      <h2>{p.title}</h2>
      {p.children}
    </dialog>
  );
}

function SignIn(p: { api: LabApi; onDone: (u: LabUser) => void; onCancel: () => void }) {
  const [name, setName] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); setBusy(true); setErr(''); p.api.login(name, pw).then(p.onDone, (x: unknown) => setErr(x instanceof Error ? x.message : String(x))).finally(() => { setBusy(false); setPw(''); }); }}>
      <label className="field"><span className="field-label">Username</span><input type="text" autoComplete="username" value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label className="field"><span className="field-label">Password</span><input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
      {err ? <p className="error" role="alert">{err}</p> : null}
      <p className="row"><button type="submit" className="primary" disabled={busy}>Sign in</button><button type="button" onClick={p.onCancel}>Cancel</button></p>
    </form>
  );
}

function NewPassword(p: { api: LabApi; required: boolean; onDone: () => void; onCancel: () => void }) {
  const [cur, setCur] = useState(''), [next, setNext] = useState(''), [again, setAgain] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  return (
    <form className="form" onSubmit={(e) => {
      e.preventDefault();
      if (next !== again) { setErr('The two new passwords are different.'); return; }
      setBusy(true); setErr('');
      p.api.changePassword(cur, next).then(p.onDone, (x: unknown) => setErr(x instanceof Error ? x.message : String(x))).finally(() => setBusy(false));
    }}>
      {p.required ? <p>Choose your own password before you continue.</p> : null}
      <label className="field"><span className="field-label">Current password</span><input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></label>
      <label className="field"><span className="field-label">New password</span><input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={10} /><span className="field-hint">At least 10 characters.</span></label>
      <label className="field"><span className="field-label">New password again</span><input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></label>
      {err ? <p className="error" role="alert">{err}</p> : null}
      <p className="row"><button type="submit" className="primary" disabled={busy}>Change password</button><button type="button" onClick={p.onCancel}>{p.required ? 'Sign out' : 'Cancel'}</button></p>
    </form>
  );
}

/** The app preview's opening panel: open the first time, remembered closed in this browser. */
function PreviewIntro() {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('app-preview-intro') !== 'closed'; } catch { return true; } });
  return (
    <details className="intro" open={open} onToggle={(e) => {
      const now = (e.currentTarget as HTMLDetailsElement).open;
      setOpen(now);
      try { localStorage.setItem('app-preview-intro', now ? 'open' : 'closed'); } catch { /* not remembered */ }
    }}>
      <summary>{PREVIEW.introTitle}</summary>
      <div className="intro-body">
        {PREVIEW.intro.map((t) => <p key={t}>{t}</p>)}
        <p className="hint">{PREVIEW.simulator}</p>
        <p className="row">{PREVIEW.introLinks.map((l) => <a key={l.href} href={l.href}>{l.label}</a>)}</p>
      </div>
    </details>
  );
}

export function Shell({ controller: c, serialAvailable }: { controller: TestController; serialAvailable: boolean }) {
  useSyncExternalStore(c.subscribe, c.snapshot);
  const [theme, toggleTheme] = useTheme();
  const lab = c.edition === 'lab';   /* the learning edition has no lab database */
  const api = useMemo(() => new LabApi(), []);
  const [reachable, setReachable] = useState<boolean | null>(lab ? null : false);
  const [user, setUser] = useState<LabUser | null>(null);
  const [viewAsUser, setViewAsUser] = useState(false);
  const [page, setPage] = useState<Page>('test');
  const [dialog, setDialog] = useState<null | 'sign-in' | 'password'>(null);

  const check = () => {
    if (!lab) return;
    api.health().then(() => { setReachable(true); return api.me().then(setUser, () => setUser(null)); }, () => setReachable(false));
  };
  useEffect(check, []);

  const effectiveRole = user ? (user.role === 'admin' && !viewAsUser ? 'admin' : 'user') : null;
  const account: Account | null = lab ? { api, reachable, user, viewAsUser, effectiveRole } : null;
  const recording = c.phase === 'recording';
  useEffect(() => { if (page === 'admin' && effectiveRole !== 'admin') setPage('test'); if (page === 'history' && !user) setPage('test'); }, [effectiveRole, user, page]);
  useEffect(() => { if (user?.mustChangePassword) setDialog('password'); }, [user]);

  const signOut = () => { void api.logout().catch(() => undefined); setUser(null); setViewAsUser(false); setDialog(null); setPage('test'); };
  const openReplay = (text: string) => {
    if (c.phase === 'recording') throw new Error('Stop the recording first.');
    if (!c.saved) throw new Error('The current test has not been saved. Save it or start a new test first.');
    void (async () => {
      if (c.source) await c.disconnect();
      c.newTest();
      c.loadReplay(text);
      setPage('test');
    })();
  };
  const nav = (id: Page, label: string) => (
    <button type="button" className={'nav' + (page === id ? ' nav-on' : '')} aria-current={page === id ? 'page' : undefined} disabled={recording && page !== id} onClick={() => setPage(id)}>{label}</button>
  );

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href={SITE_URL}>Biomaterials Tensile Tester</a>
        {lab ? <span className="badge">App</span> : <span className="badge">{PREVIEW.badge}</span>}
        {user ? <nav className="navs" aria-label="Pages">{nav('test', 'Test')}{nav('history', 'History')}{effectiveRole === 'admin' ? nav('admin', 'Admin') : null}</nav> : null}
        <span className="top-space" />
        <a href={SITE_URL + 'learn.html'}>Learn</a>
        <a href={SITE_URL + 'help.html'}>Help</a>
        <button type="button" className="quiet" onClick={toggleTheme} aria-pressed={theme === 'dark'}>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</button>
        {lab ? (
          <span className="account">
            {reachable === false ? <button type="button" className="quiet hint" onClick={check} title="Check again">Lab database not connected</button> : null}
            {reachable && !user ? <button type="button" onClick={() => setDialog('sign-in')}>Sign in</button> : null}
            {user ? (<>
              <span className="who">{user.displayName || user.username}{user.role === 'admin' ? <span className="badge badge-soft">Admin</span> : null}</span>
              {user.role === 'admin' ? <button type="button" className="quiet" aria-pressed={viewAsUser} disabled={recording} onClick={() => setViewAsUser((v) => !v)}>{viewAsUser ? 'Back to admin view' : 'View as user'}</button> : null}
              <button type="button" className="quiet" onClick={() => setDialog('password')}>Password</button>
              <button type="button" className="quiet" disabled={recording} onClick={signOut}>Sign out</button>
            </>) : null}
          </span>) : null}
      </header>
      {!lab ? <PreviewIntro /> : null}
      {viewAsUser ? <p className="view-as" role="status">Viewing as a user. This changes only what this screen shows; your admin permissions are unchanged. <button type="button" className="link" onClick={() => setViewAsUser(false)}>Back to admin view</button></p> : null}

      {page === 'test' ? <App controller={c} serialAvailable={serialAvailable} theme={theme} account={account} /> : null}
      {page === 'history' && account ? <main className="page" id="main-content"><History account={account} onReplay={openReplay} /></main> : null}
      {page === 'admin' && account && effectiveRole === 'admin' ? <main className="page" id="main-content"><Admin account={account} controller={c} /></main> : null}

      {lab ? (<>
      <Dialog open={dialog === 'sign-in'} title="Sign in to the lab database" onClose={() => setDialog(null)}>
        <SignIn api={api} onDone={(u) => { setUser(u); setDialog(u.mustChangePassword ? 'password' : null); }} onCancel={() => setDialog(null)} />
      </Dialog>
      <Dialog open={dialog === 'password'} title="Change password" onClose={() => { if (!user?.mustChangePassword) setDialog(null); }}>
        <NewPassword api={api} required={!!user?.mustChangePassword}
          onDone={() => { setDialog(null); api.me().then(setUser, (e: unknown) => { if (e instanceof ApiError && e.status === 401) setUser(null); }); }}
          onCancel={() => (user?.mustChangePassword ? signOut() : setDialog(null))} />
      </Dialog>
      </>) : null}
    </div>
  );
}
