/* Make a setup file: the device profile (the reviewed circuit's gain and offset per channel) and the calibration
   records, as the file the app reads. Start blank or from an existing setup file; add calibration files (for example
   from the bench fit on this screen). Download it, or use it now. Nothing is sent anywhere; the values are the person's. */
import { useState, useSyncExternalStore } from 'react';
import type { CalibrationRecord } from '@tensile/recording';
import type { TestController } from '../controller';
import { parseSetupFile } from '../controller';
import { buildSetupFile, defaultChannels, profileInput, readCalibrations } from '../setup-maker';
import type { ChannelInput, ProfileInput } from '../setup-maker';
import { save } from '../exports';

export function SetupFileMaker({ controller: c }: { controller: TestController }) {
  useSyncExternalStore(c.subscribe, c.snapshot);
  const [open, setOpen] = useState(false);
  const deviceIds = (c.source?.channels ?? []).filter((ch) => ch.quantity === 'force' || ch.quantity === 'displacement').map((ch) => ch.id);
  const [p, setP] = useState<ProfileInput>(() => ({ id: '', name: '', channels: defaultChannels(deviceIds.length ? deviceIds : undefined) }));
  const [cals, setCals] = useState<CalibrationRecord[]>([]);
  const [msg, setMsg] = useState(''), [err, setErr] = useState('');
  const built = buildSetupFile(p, cals);
  const locked = c.phase === 'recording';
  const setCh = (i: number, k: keyof ChannelInput, v: string) => setP((x) => ({ ...x, channels: x.channels.map((ch, j) => (j === i ? { ...ch, [k]: v } : ch)) }));

  const startFrom = (file: File) => void file.text().then((t) => {
    setMsg(''); setErr('');
    try { const f = parseSetupFile(t); setP(profileInput(f)); setCals(f.calibrations); setMsg('Loaded "' + f.profile.name + '" to edit.'); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  });
  const addCals = (files: FileList) => {
    setMsg(''); setErr('');
    void Promise.all(Array.from(files).map((f) => f.text().then((t) => ({ name: f.name, r: readCalibrations(t) })))).then((all) => {
      const bad = all.filter((a) => !a.r.ok).map((a) => a.name + ': ' + (a.r.ok ? '' : a.r.reason));
      const good = all.flatMap((a) => (a.r.ok ? a.r.value : []));
      setCals((cs) => cs.concat(good.filter((g) => !cs.some((x) => x.id === g.id))));
      if (bad.length) setErr(bad.join(' ')); else setMsg('Added ' + good.length + ' calibration record' + (good.length === 1 ? '' : 's') + '.');
    });
  };

  return (
    <section className="card-plain" aria-labelledby="maker-title">
      <h2 id="maker-title">Make a setup file</h2>
      <p className="hint">The device profile (the reviewed circuit's gain and offset for each channel) and the calibration records, as the file the app reads. Type the values from the circuit's review record; nothing is worked out for you.</p>
      <p><button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Open'} the setup file maker</button></p>
      {open ? (<>
        <label className="field"><span className="field-label">Start from an existing setup file (optional)</span>
          <input type="file" accept=".json,application/json" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) startFrom(f); }} /></label>
        <label className="field"><span className="field-label">Profile id</span><input type="text" autoComplete="off" spellCheck={false} value={p.id} onChange={(e) => setP({ ...p, id: e.target.value })} placeholder="lab-tester-rev-a" /></label>
        <label className="field"><span className="field-label">Profile name</span><input type="text" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="Lab tester, interface rev A" /></label>
        <div className="tablebox"><table className="list-table">
          <thead><tr><th scope="col">Channel id</th><th scope="col">Circuit id</th><th scope="col">Gain (ADC V per tester V)</th><th scope="col">Offset (V)</th><th scope="col"><span className="sr">Remove</span></th></tr></thead>
          <tbody>{p.channels.map((ch, i) => (
            <tr key={i}>
              <td><input className="maker-cell maker-id" type="text" aria-label={'Channel id, row ' + (i + 1)} value={ch.id} onChange={(e) => setCh(i, 'id', e.target.value)} /></td>
              <td><input className="maker-cell" type="text" aria-label={'Circuit id, row ' + (i + 1)} value={ch.conditioningId} onChange={(e) => setCh(i, 'conditioningId', e.target.value)} placeholder="rev-a" /></td>
              <td><input className="maker-cell" type="text" inputMode="decimal" aria-label={'Gain, row ' + (i + 1)} value={ch.gain} onChange={(e) => setCh(i, 'gain', e.target.value)} /></td>
              <td><input className="maker-cell" type="text" inputMode="decimal" aria-label={'Offset, row ' + (i + 1)} value={ch.offset} onChange={(e) => setCh(i, 'offset', e.target.value)} /></td>
              <td><button type="button" className="quiet" aria-label={'Remove row ' + (i + 1)} onClick={() => setP({ ...p, channels: p.channels.filter((_, j) => j !== i) })}>Remove</button></td>
            </tr>))}</tbody></table></div>
        <p className="row"><button type="button" onClick={() => setP({ ...p, channels: p.channels.concat({ id: '', conditioningId: '', gain: '', offset: '0' }) })}>Add a channel</button></p>
        <p className="hint">The channel ids are the ones the device reports{deviceIds.length ? ' (this device: ' + deviceIds.join(', ') + ')' : ' (the reference firmware uses force and displacement; check the connected device)'}. A divider that halves the signal has a gain of 0.5.</p>

        <h3>Calibration records</h3>
        {cals.length ? <ul className="plain-list">{cals.map((k) => (
          <li key={k.id}><strong>{k.id}</strong> · {k.quantity} · {k.slope} {k.unit}/V, offset {k.offset} {k.unit} · circuit {k.signalPath.conditioningId}
            <button type="button" className="quiet" aria-label={'Remove ' + k.id} onClick={() => setCals(cals.filter((x) => x.id !== k.id))}>Remove</button></li>))}</ul>
          : <p className="hint">None yet. A file with only the profile is fine: load it, connect, and make calibrations from bench points on this screen.</p>}
        <label className="field"><span className="field-label">Add calibration files</span>
          <input type="file" multiple accept=".json,application/json" onChange={(e) => { const f = e.target.files; if (f?.length) addCals(f); e.target.value = ''; }} /></label>

        {!built.ok ? <p className="hint" role="status">{built.reason}</p> : null}
        {built.ok && built.value.warnings.length ? <div className="notice-warn" role="status">{built.value.warnings.map((w, i) => <p key={i}>{w} The app will not use it with this profile.</p>)}</div> : null}
        <p className="row">
          <button type="button" className="primary" disabled={!built.ok} onClick={() => { if (built.ok) { save('setup-' + built.value.file.profile.id + '.json', [built.value.text], 'application/json'); setMsg('Downloaded the setup file.'); } }}>Download setup file</button>
          <button type="button" disabled={!built.ok || locked} onClick={() => { if (built.ok) { c.useSetup(built.value.file); setMsg('Now in use on this screen and the Test screen.'); } }}>Use it now</button>
        </p>
        {locked ? <p className="hint">The setup in use cannot change while recording.</p> : null}
        {msg ? <p className="hint" role="status">{msg}</p> : null}
        {err ? <p className="error" role="alert">{err}</p> : null}
      </>) : null}
    </section>
  );
}
