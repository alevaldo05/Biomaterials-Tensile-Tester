/* Settings: the theme, and what is stored on this computer (recordings can be downloaded or removed here). */
import { useEffect, useState } from 'react';
import type { SessionJournal, JournalMeta } from '../storage/journal';
import { desktopBridge } from '../desktop';

/* The Windows app only: where the lab server is. Saved by the Windows app on this computer. */
function LabAddress({ recording, changed, reachable }: { recording: boolean; changed: () => void; reachable: boolean | null }) {
  const d = desktopBridge();
  const [value, setValue] = useState(''), [saved, setSaved] = useState(''), [msg, setMsg] = useState(''), [err, setErr] = useState('');
  useEffect(() => { if (d) void d.getLabServer().then((u) => { setValue(u); setSaved(u); }); }, []);
  if (!d) return <p className="hint">When the app is opened from the lab computer's address, it can sign in to the lab server to share tests, methods, and calibrations. Recording never depends on it.</p>;
  const save = async () => {
    setMsg(''); setErr('');
    const r = await d.setLabServer(value);
    if (r.error) { setErr(r.error); return; }
    setValue(r.url ?? ''); setSaved(r.url ?? '');
    setMsg(r.url ? 'Saved.' : 'Removed. This app now works without a lab server.');
    changed();
  };
  return (<>
    <p className="hint">The address of the lab server, for example http://lab-pc:8080. The app sends only data requests there (sign-in, saved tests, methods, calibrations); its screens always come from this installation. Recording never depends on it. Leave it empty to work without a lab server.</p>
    <label className="field"><span className="field-label">Lab server address</span><input type="text" inputMode="url" autoComplete="off" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} placeholder="http://lab-pc:8080" /></label>
    <p className="row"><button type="button" className="primary" disabled={recording || value.trim() === saved} onClick={() => void save()}>Save address</button>
      {saved ? <button type="button" disabled={recording} onClick={() => { setMsg('Checking…'); changed(); }}>Check connection</button> : null}
      {saved ? <span className="hint" role="status">{reachable === null ? 'Checking…' : reachable ? 'Reachable.' : 'Not reachable from this computer.'}</span> : null}</p>
    {recording ? <p className="hint">The address cannot be changed while recording.</p> : null}
    {msg ? <p className="hint" role="status">{msg}</p> : null}
    {err ? <p className="error" role="alert">{err}</p> : null}
    <p className="hint">Changing the address signs you out of the previous lab server.</p>
  </>);
}

export function Settings({ theme, toggleTheme, journal, download, recording, labChanged, reachable }: { theme: string; toggleTheme: () => void; journal: SessionJournal | null; download: (m: JournalMeta) => void; recording: boolean; labChanged: () => void; reachable: boolean | null }) {
  const [items, setItems] = useState<JournalMeta[]>([]);
  const [space, setSpace] = useState<{ usage: number; quota: number } | null>(null);
  const reload = () => { if (journal) { void journal.list().then(setItems); void journal.estimate().then(setSpace); } };
  useEffect(reload, [journal]);
  const mb = (n: number) => (n / 1024 / 1024).toFixed(1) + ' MB';
  return (
    <main className="page" id="main-content">
      <h1>Settings</h1>
      <section className="card-plain" aria-labelledby="look-title">
        <h2 id="look-title">Display</h2>
        <p className="row"><span>Theme: {theme === 'dark' ? 'Dark' : 'Light'}</span><button type="button" onClick={toggleTheme}>Switch to {theme === 'dark' ? 'light' : 'dark'}</button></p>
      </section>
      <section className="card-plain" aria-labelledby="store-title">
        <h2 id="store-title">Recordings on this computer</h2>
        {!journal ? <p className="hint">This browser offers no storage, so recordings are kept in memory only. Download each test when it ends.</p> : (<>
          {desktopBridge()?.journal ? <p className="hint">Kept as files in this Windows app's data folder (recordings).</p> : null}
          <p className="hint">{items.length} recording{items.length === 1 ? '' : 's'}{space ? ' · ' + mb(space.usage) + ' used of about ' + mb(space.quota) + ' available to the app' : ''}. Remove a recording only after downloading it or saving it to the lab server.</p>
          {items.length ? (
            <div className="tablebox"><table className="list-table">
              <thead><tr><th scope="col">Started</th><th scope="col">Specimen</th><th scope="col">Status</th><th scope="col">Samples</th><th scope="col"><span className="sr">Actions</span></th></tr></thead>
              <tbody>{items.map((m) => (
                <tr key={m.id}><td>{new Date(m.startedAt).toLocaleString()}</td><td>{m.setup.specimenId || '—'}</td><td>{m.status}</td><td>{m.sampleCount}</td>
                  <td className="row"><button type="button" onClick={() => download(m)}>Download</button>
                    <button type="button" className="quiet" disabled={m.status === 'recording'} onClick={() => void journal.remove(m.id).then(reload)}>Remove</button></td></tr>))}
              </tbody></table></div>) : null}
        </>)}
      </section>
      <section className="card-plain" aria-labelledby="lab-title">
        <h2 id="lab-title">Lab server</h2>
        <LabAddress recording={recording} changed={labChanged} reachable={reachable} />
      </section>
    </main>
  );
}
