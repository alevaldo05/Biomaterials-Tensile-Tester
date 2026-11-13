/* The frame around the screens: the menu, the status bar, which screen is shown, recovery of interrupted recordings,
   and the Need help button. The lab server is optional; recording never depends on it. */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { TestType } from '@tensile/core';
import { App, useTheme } from './App';
import type { TestController } from './controller';
import { sessionFileFromJournal } from './controller';
import { ApiError, LabApi } from './lab-api';
import type { Account, LabUser, SessionRow } from './lab-api';
import { openTestFile } from './load';
import type { LoadedTest } from './load';
import { save } from './exports';
import { helpFor } from './help-text';
import { HelpButton } from './components/HelpButton';
import { StatusIndicators } from './components/StatusIndicators';
import type { JournalMeta, SessionJournal } from './storage/journal';
import type { MethodStore } from './storage/methods';
import { Admin } from './pages/Admin';
import { Device } from './pages/Device';
import { HelpPage } from './pages/HelpPage';
import { History } from './pages/History';
import { Home, recentRows } from './pages/Home';
import type { Destination } from './pages/Home';
import { LoadTest } from './pages/LoadTest';
import { Methods } from './pages/Methods';
import { Settings } from './pages/Settings';

type Page = 'home' | 'test' | 'load' | 'methods' | 'device' | 'history' | 'help' | 'settings' | 'admin';

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

export interface ShellProps { controller: TestController; serialAvailable: boolean; journal: SessionJournal | null; methods: MethodStore }

export function Shell({ controller: c, serialAvailable, journal, methods }: ShellProps) {
  useSyncExternalStore(c.subscribe, c.snapshot);
  const [theme, toggleTheme] = useTheme();
  const api = useMemo(() => new LabApi(), []);
  const [reachable, setReachable] = useState<boolean | null>(null);
  const [user, setUser] = useState<LabUser | null>(null);
  const [viewAsUser, setViewAsUser] = useState(false);
  const [page, setPage] = useState<Page>('home');
  const [dialog, setDialog] = useState<null | 'sign-in' | 'password'>(null);
  const [local, setLocal] = useState<JournalMeta[]>([]);
  const [lab, setLab] = useState<SessionRow[]>([]);
  const [loaded, setLoaded] = useState<LoadedTest | null>(null);
  const [loadError, setLoadError] = useState('');
  const [helpSub, setHelpSub] = useState('test');
  const onHelpSub = useCallback((s: string) => setHelpSub(s), []);

  const check = () => { api.health().then(() => { setReachable(true); return api.me().then(setUser, () => setUser(null)); }, () => setReachable(false)); };
  useEffect(check, []);
  const effectiveRole = user ? (user.role === 'admin' && !viewAsUser ? 'admin' : 'user') : null;
  const account: Account = { api, reachable, user, viewAsUser, effectiveRole };
  const recording = c.phase === 'recording';

  /* Lists for Home and Load test: recordings on this computer, and the lab server's when signed in. */
  const refresh = useCallback(() => {
    if (journal) void journal.list().then(setLocal, () => setLocal([]));
    if (user) void api.sessions(effectiveRole === 'admin' ? undefined : user.id).then(setLab, () => setLab([])); else setLab([]);
  }, [journal, user, effectiveRole, api]);
  useEffect(refresh, [refresh, page, c.phase, c.localSave]);
  useEffect(() => { if (page === 'admin' && effectiveRole !== 'admin') setPage('home'); if (page === 'history' && !user) setPage('home'); }, [effectiveRole, user, page]);
  useEffect(() => { if (user?.mustChangePassword) setDialog('password'); }, [user]);
  /* Leaving or reloading while recording or with unsaved data: the browser's own warning. */
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (recording || (!c.saved && c.localSave !== 'saved')) e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [recording, c.saved, c.localSave]);

  const open = async (name: string, text: string, hint?: TestType) => {
    setLoadError('');
    if (!text) { setLoadError('The file is empty or too large (limit 64 MB).'); setPage('load'); return; }
    try { setLoaded(await openTestFile(name, text, hint)); } catch (e) { setLoaded(null); setLoadError(e instanceof Error ? e.message : String(e)); }
    setPage('load');
  };
  const openLocal = async (id: string) => { if (!journal) return; try { const f = await sessionFileFromJournal(journal, id); await open('recording-' + id + '.session.json', JSON.stringify(f)); } catch (e) { setLoadError(e instanceof Error ? e.message : String(e)); setPage('load'); } };
  const openLab = async (id: string) => { try { await open('test-' + id + '.session.json', await api.sessionFileText(id)); } catch (e) { setLoadError(e instanceof Error ? e.message : String(e)); setPage('load'); } };
  const downloadLocal = async (m: JournalMeta) => { if (journal) save('recording-' + m.id + '.session.json', [JSON.stringify(await sessionFileFromJournal(journal, m.id))], 'application/json'); };
  const interrupted = local.filter((m) => m.status === 'recording' && m.id !== c.journalId);
  const recover = async (m: JournalMeta, how: 'open' | 'download' | 'dismiss') => {
    if (!journal) return;
    if (how === 'download') { await downloadLocal(m); return; }
    await journal.finish(m.id, 'interrupted', 'The app closed before the recording ended. Samples after the last saved batch were not kept.');
    refresh();
    if (how === 'open') await openLocal(m.id);
  };
  const recent = recentRows(local, lab, (id) => void openLocal(id), (id) => void openLab(id));
  const go = (d: Destination | Page) => setPage(d);

  const signOut = () => { void api.logout().catch(() => undefined); setUser(null); setViewAsUser(false); setDialog(null); if (page === 'history' || page === 'admin') setPage('home'); };
  const nav = (id: Page, label: string) => (
    <button type="button" className={'nav' + (page === id ? ' nav-on' : '')} aria-current={page === id ? 'page' : undefined} disabled={recording && id !== 'test' && id !== 'help'} onClick={() => setPage(id)}>{label}</button>
  );
  const topic = helpFor(page, page === 'test' ? helpSub : undefined);

  return (
    <div className="app">
      <header className="top">
        <span className="brand">Biomaterials Tensile Tester</span>
        <nav className="navs" aria-label="Main">
          {nav('home', 'Home')}{nav('test', 'Test')}{user ? nav('history', 'History') : null}{nav('device', 'Device')}{nav('help', 'Help')}{nav('settings', 'Settings')}
          {effectiveRole === 'admin' ? nav('admin', 'Admin') : null}
        </nav>
        <span className="top-space" />
        <span className="account">
          {reachable && !user ? <button type="button" onClick={() => setDialog('sign-in')}>Sign in to the lab server</button> : null}
          {user ? (<>
            <span className="who">{user.displayName || user.username}{user.role === 'admin' ? <span className="badge badge-soft">Admin</span> : null}</span>
            {user.role === 'admin' ? <button type="button" className="quiet" aria-pressed={viewAsUser} disabled={recording} onClick={() => setViewAsUser((v) => !v)}>{viewAsUser ? 'Back to admin view' : 'View as user'}</button> : null}
            <button type="button" className="quiet" onClick={() => setDialog('password')}>Password</button>
            <button type="button" className="quiet" disabled={recording} onClick={signOut}>Sign out</button>
          </>) : null}
        </span>
      </header>
      <StatusIndicators controller={c} account={account} />
      {viewAsUser ? <p className="view-as" role="status">Viewing as a user. This changes only what this screen shows; your admin permissions are unchanged. <button type="button" className="link" onClick={() => setViewAsUser(false)}>Back to admin view</button></p> : null}

      {page === 'home' ? <Home go={go} recent={recent} interrupted={interrupted} recover={(m, how) => void recover(m, how)} recording={recording} /> : null}
      {page === 'test' ? <App controller={c} serialAvailable={serialAvailable} theme={theme} account={account} onHelpSub={onHelpSub} /> : null}
      {page === 'load' ? <LoadTest loaded={loaded} error={loadError} theme={theme} recent={recent} openFile={(n, t, h) => void open(n, t, h)} clear={() => { setLoaded(null); setLoadError(''); }} /> : null}
      {page === 'methods' ? <Methods store={methods} controller={c} start={() => setPage('test')} /> : null}
      {page === 'device' ? <Device controller={c} account={account} serialAvailable={serialAvailable} /> : null}
      {page === 'history' && user ? <main className="page" id="main-content"><History account={account} onReplay={(text) => void open('lab-test.session.json', text)} /></main> : null}
      {page === 'help' ? <HelpPage /> : null}
      {page === 'settings' ? <Settings theme={theme} toggleTheme={toggleTheme} journal={journal} download={(m) => void downloadLocal(m)} /> : null}
      {page === 'admin' && effectiveRole === 'admin' ? <main className="page" id="main-content"><Admin account={account} controller={c} /></main> : null}

      <HelpButton topic={topic} onOpenHelp={() => setPage('help')} />

      <Dialog open={dialog === 'sign-in'} title="Sign in to the lab server" onClose={() => setDialog(null)}>
        <SignIn api={api} onDone={(u) => { setUser(u); setDialog(u.mustChangePassword ? 'password' : null); }} onCancel={() => setDialog(null)} />
      </Dialog>
      <Dialog open={dialog === 'password'} title="Change password" onClose={() => { if (!user?.mustChangePassword) setDialog(null); }}>
        <NewPassword api={api} required={!!user?.mustChangePassword}
          onDone={() => { setDialog(null); api.me().then(setUser, (e: unknown) => { if (e instanceof ApiError && e.status === 401) setUser(null); }); }}
          onCancel={() => (user?.mustChangePassword ? signOut() : setDialog(null))} />
      </Dialog>
    </div>
  );
}
