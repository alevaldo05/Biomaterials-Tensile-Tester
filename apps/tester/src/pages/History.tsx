/* Saved tests from the lab database. The server decides who may see what; this screen only asks for the right list. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import type { Account, SessionRow } from '../lab-api';
import './pages.css';

const sig = (n: number, digits = 4): string => String(Number(n.toPrecision(digits)));
/** The summary is keyNumbers() from @tensile/core, saved by the app (App.tsx, saveToLab): uniaxial E, uts, ...; relaxation s0, relaxed, ... */
const KEYS = { uts: ['uts'], modulus: ['E'], s0: ['s0'], relaxed: ['relaxed'] } as const;
function pick(summary: SessionRow['summary'], keys: readonly string[]): number | null {
  for (const k of keys) { const v = summary[k]; if (typeof v === 'number' && Number.isFinite(v)) return v; }
  return null;
}
function results(s: SessionRow): string {
  const parts: string[] = [];
  const add = (label: string, v: number | null, unit: string) => { parts.push(label + ' ' + (v === null ? '—' : sig(v) + ' ' + unit)); };
  if (s.testType === 'uniaxial') { add('UTS', pick(s.summary, KEYS.uts), 'MPa'); add('E', pick(s.summary, KEYS.modulus), 'MPa'); }
  else { add('s0', pick(s.summary, KEYS.s0), 'MPa'); add('Relaxed', pick(s.summary, KEYS.relaxed), '%'); }
  return parts.join(' · ');
}
const when = (iso: string): string => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(); };
const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function saveText(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function History(p: { account: Account; onReplay: (sessionFileText: string) => void }): JSX.Element {
  const { account } = p;
  const isAdmin = account.effectiveRole === 'admin';
  const ownerId = isAdmin ? undefined : account.user?.id;
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setError(''); setRows(null);
    try {
      const list = await account.api.sessions(ownerId);
      setRows(list);
    } catch (e) { setError(message(e)); setRows([]); }
  }, [account.api, ownerId]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => {
    if (!rows) return [];
    const q = filter.trim().toLowerCase();
    return q && isAdmin ? rows.filter((r) => r.owner.toLowerCase().includes(q)) : rows;
  }, [rows, filter, isAdmin]);

  const fetchText = async (id: string, then: (text: string) => void) => {
    setBusy(id); setError('');
    try { then(await account.api.sessionFileText(id)); } catch (e) { setError(message(e)); } finally { setBusy(''); }
  };

  return (
    <section className="page" aria-labelledby="history-h">
      <div className="page-head">
        <h2 id="history-h">Saved tests</h2>
        <button type="button" onClick={() => void load()} disabled={rows === null}>Refresh</button>
      </div>
      {isAdmin ? (
        <label className="field page-filter">
          <span className="field-label">Filter by owner</span>
          <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Username" autoComplete="off" />
        </label>
      ) : <p className="hint">Your own saved tests.</p>}
      {error ? <p className="error" role="alert">{error}</p> : null}
      {rows === null ? <p className="hint" role="status">Loading saved tests…</p> : null}
      {rows && rows.length === 0 && !error ? <p className="hint">No saved tests yet. After a test, use Save data → Save to lab database.</p> : null}
      {rows && rows.length > 0 && shown.length === 0 ? <p className="hint">No saved tests match that owner.</p> : null}
      {shown.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Saved</th><th scope="col">Test</th><th scope="col">Material</th><th scope="col">Specimen ID</th>
                <th scope="col">Data</th><th scope="col">Calibration</th><th scope="col">Samples</th><th scope="col">Device</th>
                {isAdmin ? <th scope="col">Owner</th> : null}
                <th scope="col">Key results</th><th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id}>
                  <td>{when(s.savedAt)}</td>
                  <td>{s.testType === 'uniaxial' ? 'Uniaxial tension' : 'Stress relaxation'}</td>
                  <td>{s.material || '—'}</td>
                  <td>{s.specimenId || '—'}</td>
                  <td>{s.data}</td>
                  <td>{s.calibrationLabel || '—'}</td>
                  <td className="num">{s.sampleCount}</td>
                  <td>{(s.deviceType || '—') + ' · ' + (s.deviceId || '—')}</td>
                  {isAdmin ? <td>{s.owner}</td> : null}
                  <td className="num">{results(s)}</td>
                  <td>
                    <span className="row">
                      <button type="button" disabled={busy === s.id} onClick={() => void fetchText(s.id, (t) => saveText(t, 'test-' + s.id + '.session.json'))}>Download session file</button>
                      <button type="button" disabled={busy === s.id} onClick={() => void fetchText(s.id, (t) => p.onReplay(t))}>Open in replay</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
