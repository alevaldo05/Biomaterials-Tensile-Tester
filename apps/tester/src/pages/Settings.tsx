/* Settings: the theme, and what is stored on this computer (recordings can be downloaded or removed here). */
import { useEffect, useState } from 'react';
import type { SessionJournal, JournalMeta } from '../storage/journal';

export function Settings({ theme, toggleTheme, journal, download }: { theme: string; toggleTheme: () => void; journal: SessionJournal | null; download: (m: JournalMeta) => void }) {
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
        <p className="hint">When the app is opened from the lab computer's address, it can sign in to the lab server to share tests, methods, and calibrations. Recording never depends on it.</p>
      </section>
    </main>
  );
}
