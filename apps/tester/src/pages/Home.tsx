/* Home: the chosen design (split with tiles). Start actions on the left, recent tests on the right, and any
   recording that did not finish, so it can be recovered. No paragraphs about the tester. */
import type { JournalMeta } from '../storage/journal';
import type { SessionRow } from '../lab-api';
import { RecentTable } from '../components/RecentTable';

export type Destination = 'test' | 'load' | 'methods' | 'device' | 'history';

export interface RecentRow { key: string; saved: string; specimen: string; test: string; method: string; samples: number; stored: string; open: () => void; /** The test's file, for comparing. */ fetch?: () => Promise<{ name: string; text: string }> }

const TEST_NAME = { uniaxial: 'Uniaxial tension', relaxation: 'Stress relaxation' } as const;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

export function recentRows(local: JournalMeta[], lab: SessionRow[], openLocal: (id: string) => void, openLab: (id: string) => void,
  fetchLocal?: (id: string) => Promise<{ name: string; text: string }>, fetchLab?: (id: string) => Promise<{ name: string; text: string }>): RecentRow[] {
  const a: (RecentRow & { t: string })[] = local.filter((m) => m.status !== 'recording').map((m) => ({
    key: 'l' + m.id, t: m.endedAt ?? m.startedAt, saved: when(m.endedAt ?? m.startedAt) + (m.status === 'interrupted' ? ' (interrupted)' : ''),
    specimen: m.setup.specimenId || '—', test: TEST_NAME[m.test], method: '—', samples: m.sampleCount, stored: 'This computer', open: () => openLocal(m.id), ...(fetchLocal ? { fetch: () => fetchLocal(m.id) } : {}) }));
  const b: (RecentRow & { t: string })[] = lab.map((s) => ({
    key: 'r' + s.id, t: s.savedAt, saved: when(s.savedAt), specimen: s.specimenId || '—', test: TEST_NAME[s.testType], method: '—',
    samples: s.sampleCount, stored: 'Lab server', open: () => openLab(s.id), ...(fetchLab ? { fetch: () => fetchLab(s.id) } : {}) }));
  return [...a, ...b].sort((x, y) => y.t.localeCompare(x.t)).slice(0, 8);
}

const ICON: Record<string, string> = {
  test: 'M12 5v14M5 12h14', load: 'M3 7h6l2 2h10v10H3z', methods: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h4',
  history: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M12 8v4l3 2', device: 'M8 3v5M16 3v5M6 8h12v4a6 6 0 0 1-12 0zM12 18v3', reports: 'M6 3h9l3 3v15H6zM9 13h6M9 17h6M9 9h3',
};
function Icon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={ICON[name]} /></svg>;
}

export interface DeviceGlance { state: string; detail: string; calibration: string }

export function Home(p: {
  go: (d: Destination) => void;
  recent: RecentRow[];
  interrupted: JournalMeta[];
  recover: (m: JournalMeta, how: 'open' | 'download' | 'dismiss') => void;
  recording: boolean;
  device: DeviceGlance;
}) {
  const tile = (d: Destination, name: string, desc: string, icon: string, primary = false) => (
    <button type="button" className={'tile' + (primary ? ' primary' : '')} onClick={() => p.go(d)} disabled={p.recording && d !== 'test'}>
      <Icon name={icon} />
      <span className="tile-text"><span className="t">{name}</span><span className="d">{desc}</span></span>
    </button>
  );
  return (
    <main className="home" id="main-content">
      <h1>Home</h1>
      <div className="home-grid">
        <nav className="home-start" aria-label="Start">
          {tile('test', p.recording ? 'Back to the recording' : 'Start a new test', 'Set up a specimen and record', 'test', true)}
          {tile('load', 'Load a recorded test', 'Open or compare saved files', 'load')}
          {tile('methods', 'Test methods', 'Start from a saved setup', 'methods')}
          {tile('device', 'Device check', 'Connection and calibration', 'device')}
        </nav>
        <section className="home-recent card-plain" aria-labelledby="recent-title">
          <div className="row between"><h2 id="recent-title">Recent tests</h2><button type="button" className="link" onClick={() => p.go('load')}>All tests</button></div>
          <RecentTable rows={p.recent} />
        </section>
        <aside className="home-glance" aria-label="At a glance">
          <section className="side-card" aria-labelledby="glance-device">
            <h2 id="glance-device">Device</h2>
            <p className="glance-state">{p.device.state}</p>
            {p.device.detail ? <p className="hint">{p.device.detail}</p> : null}
            <p className="hint">Calibration: {p.device.calibration}</p>
          </section>
          <section className="side-card" aria-labelledby="glance-int">
            <h2 id="glance-int">Interrupted recording</h2>
            {p.interrupted.length ? p.interrupted.map((m) => (
              <div key={m.id} className="recover" role="alert">
                <p><strong>Started {when(m.startedAt)}</strong>: {m.sampleCount} samples were saved, up to {when(m.lastCommitAt)}. Anything after that was not saved and cannot be recreated.</p>
                <p className="row">
                  <button type="button" className="primary" onClick={() => p.recover(m, 'open')}>Open it</button>
                  <button type="button" onClick={() => p.recover(m, 'download')}>Download its session file</button>
                  <button type="button" className="quiet" onClick={() => p.recover(m, 'dismiss')}>Mark as handled</button>
                </p>
              </div>)) : <p className="hint">None. An interrupted recording would appear here so it can be recovered.</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}
