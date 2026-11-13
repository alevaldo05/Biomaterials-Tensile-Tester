/* The device's identity and settings, and the calibration in use. Shown in the Test steps and on the Device screen. */
import { useEffect, useState } from 'react';
import { sig } from '@tensile/core';
import { Field } from '@tensile/ui';
import type { TestController } from '../controller';
import { parseSetupFile } from '../controller';
import type { Account, ProfileRow } from '../lab-api';

export function DeviceFacts({ c }: { c: TestController }) {
  const id = c.source?.identity, st = c.source?.settings;
  if (!id || !st) return <p className="hint">Not identified yet. Connect, and the device answers with who it is; a port name alone is not accepted.</p>;
  return (
    <dl className="facts">
      <div><dt>Device</dt><dd>{id.deviceType} · {id.deviceId}</dd></div>
      <div><dt>Software</dt><dd>{id.softwareVersion}</dd></div>
      <div><dt>Protocol</dt><dd>{id.protocol} (compatible)</dd></div>
      <div><dt>Channels</dt><dd>{c.source?.channels.map((ch) => ch.quantity + ' on ' + ch.input + ', ' + ch.mode).join('; ')}</dd></div>
      <div><dt>ADC</dt><dd>{st.adc}, {st.bits} bit, ±{st.fullScale_mV} mV</dd></div>
      <div><dt>Conversion rate</dt><dd>{st.dataRate_sps} per second, shared by {st.channelOrder.length} channels converted one after another</dd></div>
      <div><dt>Achieved rate</dt><dd>{c.rate !== null ? sig(c.rate, 3) + ' samples/s per channel (last recording)' : 'measured while recording'}</dd></div>
      <div><dt>Last sample</dt><dd>{c.lastSampleAt ? new Date(c.lastSampleAt).toLocaleTimeString() : 'none yet'}</dd></div>
    </dl>
  );
}

export function CalibrationPanel({ c, account }: { c: TestController; account: Account | null }) {
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (account?.user && profiles === null) void account.api.profiles().then(setProfiles, () => setProfiles([])); }, [account?.user, profiles]);
  const readiness = c.readiness, locked = c.phase === 'recording';
  const apply = (f: ReturnType<typeof parseSetupFile>) => { try { c.useSetup(f); setError(''); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } };
  return (
    <>
      {readiness ? (['force', 'displacement'] as const).map((q) => { const r = readiness.channels[q]; return (
        <div key={q} className={'cal ' + (r.calibrated ? 'cal-ok' : 'cal-no')}>
          <strong>{q === 'force' ? 'Force' : 'Displacement'}: {r.calibrated ? 'calibrated' : 'uncalibrated'}</strong>
          <span className="hint">{r.calibrated ? 'Calibration ' + r.calibrationId : r.reasons.join(' ')}</span>
        </div>); }) : <p className="hint">Connect first; then the app checks whether a calibration matches this device's signal path.</p>}
      <Field label="Setup file" hint={c.setupFile ? 'Loaded profile "' + c.setupFile.profile.name + '" with ' + c.setupFile.calibrations.length + ' calibration records.' : 'The device profile (conditioning circuit) and calibration records for this tester. Without it, readings stay in volts.'}>
        <input type="file" accept=".json,application/json" disabled={locked} onChange={(e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (f) void f.text().then((t) => { try { apply(parseSetupFile(t)); } catch (err) { setError(err instanceof Error ? err.message : String(err)); } });
        }} />
      </Field>
      {account?.user ? (
        <Field label="Setup from the lab server" hint={profiles === null ? 'Loading…' : profiles.length ? 'A device profile and its approved calibrations.' : 'No device profiles are stored yet. An admin adds them.'}>
          <select value="" disabled={locked || !profiles?.length} onChange={(e) => { const id = e.target.value; if (id) void account.api.setupFile(id).then(apply, (err: unknown) => setError(err instanceof Error ? err.message : String(err))); }}>
            <option value="">Choose a profile…</option>
            {(profiles ?? []).map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
          </select>
        </Field>) : null}
      <label className="check"><input type="checkbox" checked={c.voltagesOnly} disabled={c.locked} onChange={(e) => c.update((x) => { x.voltagesOnly = e.target.checked; })} /> Record voltages only (no force, stress, or strain)</label>
      {error ? <p className="error" role="alert">{error}</p> : null}
      <p className="hint">A calibration is used only when the whole signal path matches the one it was made with. After a change to the board, ADC, conditioning circuit, or machine range it must be reviewed.</p>
    </>
  );
}
