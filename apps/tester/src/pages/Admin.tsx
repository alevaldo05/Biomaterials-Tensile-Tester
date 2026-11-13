/* Admin screens: people, device profiles, calibrations, and the record of changes. The server enforces who may do
   what; this screen only hides what a role cannot use and shows the server's message when a request is refused. */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { FormEvent, JSX } from 'react';
import { Field, Panel } from '@tensile/ui';
import type { Account, AuditRow, CalibrationRow, ProfileRow, Role, UserRow } from '../lab-api';
import { ApiError } from '../lab-api';
import type { TestController } from '../controller';
import { buildCalibration, pathFor } from './signal-path';
import './pages.css';

function errText(e: unknown): string {
  if (e instanceof ApiError && e.status === 403) return 'Only an admin can do this. ' + e.message;
  return e instanceof Error ? e.message : String(e);
}
const when = (iso: string | null): string => { if (!iso) return '—'; const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(); };

/** Loads a list once, and again on demand. */
function useList<T>(load: () => Promise<T[]>): { items: T[] | null; error: string; reload: () => void } {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(() => {
    setError('');
    load().then(setItems).catch((e: unknown) => { setError(errText(e)); setItems((x) => x ?? []); });
  }, [load]);
  useEffect(() => { reload(); }, [reload]);
  return { items, error, reload };
}

/* ---------- people ---------- */
function People(p: { account: Account }): JSX.Element {
  const { api } = p.account;
  const load = useCallback(() => api.users(), [api]);
  const { items, error, reload } = useList<UserRow>(load);
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ username: '', displayName: '', role: 'user' as Role, password: '' });
  const [reset, setReset] = useState<{ id: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (f: () => Promise<unknown>, done: string): Promise<boolean> => {
    setBusy(true); setMsg('');
    try { await f(); reload(); setMsg(done); return true; } catch (e) { setMsg(errText(e)); return false; } finally { setBusy(false); }
  };
  const create = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(() => api.createUser({ username: form.username.trim(), displayName: form.displayName.trim(), role: form.role, password: form.password }), 'Person added.');
    if (ok) setForm({ username: '', displayName: '', role: 'user', password: '' });
  };
  const sendReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!reset) return;
    const ok = await run(() => api.updateUser(reset.id, { password: reset.password }), 'Temporary password set. They must change it at first sign-in.');
    if (ok) setReset(null);
  };
  const failed = msg !== '' && !/^(Person added|Temporary password set|Saved)/.test(msg);

  return (
    <div className="page-block">
      {error ? <p className="error" role="alert">{error}</p> : null}
      {items === null ? <p className="hint" role="status">Loading people…</p> : null}
      {items && items.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">Username</th><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Password</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.displayName || '—'}</td>
                  <td>
                    <select aria-label={'Role of ' + u.username} value={u.role} disabled={busy}
                      onChange={(e) => void run(() => api.updateUser(u.id, { role: e.target.value as Role }), 'Saved.')}>
                      <option value="user">User</option><option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>{u.disabled ? 'Disabled' : 'Active'}</td>
                  <td>{u.mustChangePassword ? 'Must change' : '—'}</td>
                  <td>
                    <span className="row">
                      <button type="button" disabled={busy} onClick={() => void run(() => api.updateUser(u.id, { disabled: !u.disabled }), 'Saved.')}>{u.disabled ? 'Enable' : 'Disable'}</button>
                      <button type="button" disabled={busy} onClick={() => setReset(reset?.id === u.id ? null : { id: u.id, password: '' })}>Reset password</button>
                    </span>
                    {reset?.id === u.id ? (
                      <form className="inline-form" onSubmit={(e) => void sendReset(e)}>
                        <Field label={'Temporary password for ' + u.username} hint="At least 10 characters. They must change it at first sign-in.">
                          <input type="password" autoComplete="new-password" value={reset.password} onChange={(e) => setReset({ id: u.id, password: e.target.value })} />
                        </Field>
                        <span className="row"><button type="submit" className="primary" disabled={busy || reset.password.length < 10}>Set password</button><button type="button" onClick={() => setReset(null)}>Cancel</button></span>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {msg ? <p className={failed ? 'error' : 'hint'} role={failed ? 'alert' : 'status'}>{msg}</p> : null}

      <form className="page-form" onSubmit={(e) => void create(e)}>
        <h3>Add a person</h3>
        <div className="form-grid">
          <Field label="Username" required hint="Lowercase letters, digits, dots, dashes, underscores.">
            <input type="text" autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </Field>
          <Field label="Display name">
            <input type="text" autoComplete="off" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </Field>
          <Field label="Role">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}><option value="user">User</option><option value="admin">Admin</option></select>
          </Field>
          <Field label="Temporary password" required hint="At least 10 characters. They must change it at first sign-in.">
            <input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
        </div>
        <p><button type="submit" className="primary" disabled={busy || !form.username.trim() || form.password.length < 10}>Add person</button></p>
      </form>
    </div>
  );
}

/* ---------- device profiles ---------- */
interface ChannelRow { channel: string; circuit: string; gain: string; offset: string }
const EMPTY_ROW: ChannelRow = { channel: '', circuit: '', gain: '', offset: '0' };

function Profiles(p: { account: Account; items: ProfileRow[] | null; error: string; reload: () => void }): JSX.Element {
  const { api } = p.account;
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<ChannelRow[]>([{ ...EMPTY_ROW }]);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const setRow = (i: number, patch: Partial<ChannelRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(''); setOk(false);
    const channels: Record<string, { conditioning: { id: string; gain: number; offset_V: number } }> = {};
    for (const r of rows) {
      const ch = r.channel.trim(), gain = Number(r.gain), offset = Number(r.offset);
      if (!ch || !r.circuit.trim()) { setMsg('Each channel needs a channel id and a conditioning circuit id.'); return; }
      if (channels[ch]) { setMsg('Channel ' + ch + ' is listed twice.'); return; }
      if (r.gain.trim() === '' || !Number.isFinite(gain) || gain === 0) { setMsg('The gain of channel ' + ch + ' must be a number other than 0.'); return; }
      if (r.offset.trim() === '' || !Number.isFinite(offset)) { setMsg('The offset of channel ' + ch + ' must be a number.'); return; }
      channels[ch] = { conditioning: { id: r.circuit.trim(), gain, offset_V: offset } };
    }
    setBusy(true);
    try {
      await api.createProfile({ id: id.trim(), name: name.trim(), channels, notes: notes.trim() });
      setOk(true); setMsg('Profile saved.');
      setId(''); setName(''); setNotes(''); setRows([{ ...EMPTY_ROW }]);
      p.reload();
    } catch (err) { setMsg(errText(err)); } finally { setBusy(false); }
  };

  return (
    <div className="page-block">
      {p.error ? <p className="error" role="alert">{p.error}</p> : null}
      {p.items === null ? <p className="hint" role="status">Loading profiles…</p> : null}
      {p.items && p.items.length === 0 && !p.error ? <p className="hint">No device profiles yet.</p> : null}
      {p.items && p.items.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">Id</th><th scope="col">Name</th><th scope="col">Channels (circuit, gain, offset)</th><th scope="col">Notes</th></tr></thead>
            <tbody>
              {p.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.name}</td>
                  <td>
                    <ul className="plain-list">
                      {Object.entries(r.channels).map(([ch, v]) => (
                        <li key={ch}><strong>{ch}</strong>: {v.conditioning.id}, gain {v.conditioning.gain}, offset {v.conditioning.offset_V} V</li>
                      ))}
                    </ul>
                  </td>
                  <td>{r.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <form className="page-form" onSubmit={(e) => void submit(e)}>
        <h3>New device profile</h3>
        <p className="hint">Describe the reviewed conditioning circuit. A changed circuit gets a new profile id; profiles are never overwritten.</p>
        <div className="form-grid">
          <Field label="Profile id" required hint="Lowercase letters, digits, dots, dashes, underscores."><input type="text" autoComplete="off" value={id} onChange={(e) => setId(e.target.value)} /></Field>
          <Field label="Name" required><input type="text" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        </div>
        <Field label="Notes"><input type="text" autoComplete="off" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <fieldset className="channel-rows">
          <legend>Channels</legend>
          {rows.map((r, i) => (
            <div className="channel-row" key={i}>
              <Field label="Channel id"><input type="text" autoComplete="off" value={r.channel} onChange={(e) => setRow(i, { channel: e.target.value })} /></Field>
              <Field label="Conditioning circuit id"><input type="text" autoComplete="off" value={r.circuit} onChange={(e) => setRow(i, { circuit: e.target.value })} /></Field>
              <Field label="Gain" hint="Volts at the ADC per volt at the machine output."><input type="text" inputMode="decimal" autoComplete="off" value={r.gain} onChange={(e) => setRow(i, { gain: e.target.value })} /></Field>
              <Field label="Offset" unit="V"><input type="text" inputMode="decimal" autoComplete="off" value={r.offset} onChange={(e) => setRow(i, { offset: e.target.value })} /></Field>
              <button type="button" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove channel</button>
            </div>
          ))}
          <p><button type="button" onClick={() => setRows([...rows, { ...EMPTY_ROW }])}>Add channel</button></p>
        </fieldset>
        {msg ? <p className={ok ? 'hint' : 'error'} role={ok ? 'status' : 'alert'}>{msg}</p> : null}
        <p><button type="submit" className="primary" disabled={busy || !id.trim() || !name.trim()}>Save profile</button></p>
      </form>
    </div>
  );
}

/* ---------- calibrations ---------- */
function Calibrations(p: { account: Account; controller: TestController; profiles: ProfileRow[] | null }): JSX.Element {
  const { api } = p.account;
  const c = p.controller;
  useSyncExternalStore(c.subscribe, c.snapshot);
  const load = useCallback(() => api.calibrations(), [api]);
  const { items, error, reload } = useList<CalibrationRow>(load);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [calId, setCalId] = useState('');
  const [slope, setSlope] = useState('');
  const [offset, setOffset] = useState('0');
  const [note, setNote] = useState('');

  const act = async (f: () => Promise<unknown>, done: string) => {
    setBusy(true); setMsg(''); setOk(false);
    try { await f(); setOk(true); setMsg(done); reload(); } catch (e) { setMsg(errText(e)); } finally { setBusy(false); }
  };

  const src = c.source;
  const identity = src?.identity ?? null, settings = src?.settings ?? null;
  const real = !!src && src.kind === 'real' && !!identity && !!settings && c.connected;
  const profile = (p.profiles ?? []).find((x) => x.id === profileId) ?? null;
  const channels = (src?.channels ?? []).filter((ch) => (ch.quantity === 'force' || ch.quantity === 'displacement') && !!profile && !!profile.channels[ch.id]);
  const channel = channels.find((ch) => ch.id === channelId) ?? null;
  const path = real && profile && channel && identity && settings ? pathFor({ identity, settings, profile, channel }) : null;

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!real || !profile || !channel || !identity || !settings) return;
    const r = buildCalibration({ identity, channel, settings, profile, id: calId, slope, offset, note });
    if (!r.ok) { setOk(false); setMsg(r.reason); return; }
    await act(() => api.createCalibration(r.body), 'Draft saved. It must be approved before the app uses it.');
    setCalId(''); setSlope(''); setOffset('0'); setNote('');
  };

  return (
    <div className="page-block">
      <p className="hint">Calibrations are of real equipment only. They are never overwritten: a change gets a new id. A draft must be approved before the app uses it; a retired one is no longer used.</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {items === null ? <p className="hint" role="status">Loading calibrations…</p> : null}
      {items && items.length === 0 && !error ? <p className="hint">No calibrations yet.</p> : null}
      {items && items.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">Id</th><th scope="col">Profile</th><th scope="col">Quantity</th><th scope="col">Slope</th><th scope="col">Offset</th><th scope="col">Status</th><th scope="col">Created</th><th scope="col">Approved</th><th scope="col">Note</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.profileId}</td>
                  <td>{r.quantity}</td>
                  <td className="num">{r.slope} {r.unit}/V</td>
                  <td className="num">{r.offset} {r.unit}</td>
                  <td>{r.status}</td>
                  <td>{(r.createdBy ?? '—') + ', ' + when(r.createdAt)}</td>
                  <td>{r.approvedAt ? (r.approvedBy ?? '—') + ', ' + when(r.approvedAt) : '—'}</td>
                  <td>{r.note || '—'}</td>
                  <td>
                    <span className="row">
                      {r.status === 'draft' ? <button type="button" disabled={busy} onClick={() => void act(() => api.approveCalibration(r.id), 'Approved.')}>Approve</button> : null}
                      {r.status !== 'retired' ? <button type="button" disabled={busy} onClick={() => void act(() => api.retireCalibration(r.id), 'Retired.')}>Retire</button> : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {msg ? <p className={ok ? 'hint' : 'error'} role={ok ? 'status' : 'alert'}>{msg}</p> : null}

      <form className="page-form" onSubmit={(e) => void create(e)}>
        <h3>New calibration from the connected device</h3>
        {!real ? <p className="hint">Connect a real acquisition device first. Calibrations of the simulator are not stored.</p> : (<>
          <p className="hint">From your bench calibration of the reviewed signal path (for example known masses). This app does not work them out.</p>
          <div className="form-grid">
            <Field label="Device profile" required>
              <select value={profileId} onChange={(e) => { setProfileId(e.target.value); setChannelId(''); }}>
                <option value="">Choose…</option>
                {(p.profiles ?? []).map((x) => <option key={x.id} value={x.id}>{x.name + ' (' + x.id + ')'}</option>)}
              </select>
            </Field>
            <Field label="Channel" required hint={profile && channels.length === 0 ? 'No force or displacement channel of this device has conditioning in the profile.' : undefined}>
              <select value={channelId} disabled={!profile} onChange={(e) => setChannelId(e.target.value)}>
                <option value="">Choose…</option>
                {channels.map((ch) => <option key={ch.id} value={ch.id}>{ch.id + ' (' + ch.quantity + ', ' + ch.input + ')'}</option>)}
              </select>
            </Field>
            <Field label="Calibration id" required hint="A new id for every change."><input type="text" autoComplete="off" value={calId} onChange={(e) => setCalId(e.target.value)} /></Field>
            <Field label="Slope" unit={channel ? (channel.quantity === 'force' ? 'N per V' : 'mm per V') : 'per V'} required hint="Per volt at the machine output.">
              <input type="text" inputMode="decimal" autoComplete="off" value={slope} onChange={(e) => setSlope(e.target.value)} />
            </Field>
            <Field label="Offset" unit={channel ? (channel.quantity === 'force' ? 'N' : 'mm') : undefined} required hint="The value at 0 V.">
              <input type="text" inputMode="decimal" autoComplete="off" value={offset} onChange={(e) => setOffset(e.target.value)} />
            </Field>
          </div>
          <Field label="Note"><input type="text" autoComplete="off" value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: masses used, date, who" /></Field>
          {path ? (path.ok ? (
            <dl className="facts wide" aria-label="Signal path">
              <div><dt>Device type</dt><dd>{path.path.deviceType}</dd></div>
              <div><dt>ADC</dt><dd>{path.path.adc + ', ' + path.path.bits + ' bits'}</dd></div>
              <div><dt>ADC input range</dt><dd>± {path.path.fullScale_mV} mV</dd></div>
              <div><dt>Mode and input</dt><dd>{path.path.mode + ', ' + path.path.input}</dd></div>
              <div><dt>Conditioning circuit</dt><dd>{path.path.conditioningId}</dd></div>
              <div><dt>Conditioning gain</dt><dd>{path.path.conditioningGain}</dd></div>
              <div><dt>Conditioning offset</dt><dd>{path.path.conditioningOffset_V} V</dd></div>
            </dl>
          ) : <p className="error" role="alert">{path.reason}</p>) : null}
          <p><button type="submit" className="primary" disabled={busy || !path || !path.ok || !calId.trim() || slope.trim() === ''}>Save as draft</button></p>
        </>)}
      </form>
    </div>
  );
}

/* ---------- record of changes ---------- */
const SECRET = /pass|secret|token|hash|cookie|key/i;
function detailText(d: Record<string, unknown>): string {
  const parts = Object.entries(d ?? {}).filter(([k]) => !SECRET.test(k)).map(([k, v]) => k + ': ' + (typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)));
  const t = parts.join(', ');
  return t.length > 160 ? t.slice(0, 157) + '…' : t;
}
function Audit(p: { account: Account }): JSX.Element {
  const { api } = p.account;
  const load = useCallback(() => api.audit(), [api]);
  const { items, error, reload } = useList<AuditRow>(load);
  return (
    <div className="page-block">
      <p><button type="button" onClick={reload}>Refresh</button></p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {items === null ? <p className="hint" role="status">Loading…</p> : null}
      {items && items.length === 0 && !error ? <p className="hint">Nothing recorded yet.</p> : null}
      {items && items.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th scope="col">Time</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Detail</th></tr></thead>
            <tbody>
              {[...items].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).map((r) => (
                <tr key={r.id}><td>{when(r.at)}</td><td>{r.username ?? '—'}</td><td>{r.action}</td><td>{detailText(r.detail)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function Admin(p: { account: Account; controller: TestController }): JSX.Element {
  const { api } = p.account;
  const loadProfiles = useCallback(() => api.profiles(), [api]);
  const profiles = useList<ProfileRow>(loadProfiles);
  return (
    <section className="page" aria-labelledby="admin-h">
      <div className="page-head"><h2 id="admin-h">Admin</h2></div>
      <Panel title="People" open><People account={p.account} /></Panel>
      <Panel title="Device profiles"><Profiles account={p.account} items={profiles.items} error={profiles.error} reload={profiles.reload} /></Panel>
      <Panel title="Calibrations"><Calibrations account={p.account} controller={p.controller} profiles={profiles.items} /></Panel>
      <Panel title="Record of changes"><Audit account={p.account} /></Panel>
    </section>
  );
}
