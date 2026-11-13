/* The status bar: one indicator per thing, never one combined "Ready". Each says its state in words. */
import type { Account } from '../lab-api';
import type { TestController } from '../controller';

type Level = 'unknown' | 'ok' | 'warn' | 'bad' | 'live';
interface Ind { key: string; label: string; value: string; level: Level }

export function indicators(c: TestController, account: Account | null, now = Date.now()): Ind[] {
  const s = c.state, r = c.readiness;
  const device: Ind = { key: 'device', label: 'Device', level: c.connected ? 'ok' : s === 'fault' ? 'bad' : s === 'connecting' || s === 'identifying' ? 'unknown' : 'unknown',
    value: c.connected ? 'Connected' + (c.source?.identity ? ' · ' + c.source.identity.deviceId : '') : s === 'fault' ? 'Fault' : s === 'connecting' ? 'Connecting' : s === 'identifying' ? 'Identifying' : 'Not connected' };
  const fresh = c.lastSampleAt !== null && now - c.lastSampleAt < 2000;
  const data: Ind = { key: 'data', label: 'Data', level: !c.connected ? 'unknown' : s === 'stale' ? 'warn' : fresh ? 'ok' : 'warn',
    value: !c.connected ? 'None' : s === 'stale' ? 'Stale' : fresh ? 'Arriving' : 'Waiting' };
  const calibrated = r ? (r.ready ? 'Matches' : r.channels.force.calibrated || r.channels.displacement.calibrated ? 'Partly' : 'Not calibrated') : 'Not checked';
  const calibration: Ind = { key: 'calibration', label: 'Calibration', level: r ? (r.ready ? 'ok' : 'warn') : 'unknown', value: calibrated };
  const recording: Ind = { key: 'recording', label: 'Recording', level: c.phase === 'recording' ? 'live' : 'unknown', value: c.phase === 'recording' ? 'On' : c.phase === 'done' ? 'Stopped' : 'Off' };
  const ls = c.localSave;
  const local: Ind = { key: 'local', label: 'Local storage', level: ls === 'error' ? 'bad' : ls === 'saved' ? 'ok' : ls === 'off' ? 'warn' : 'unknown',
    value: ls === 'saved' ? 'Saved locally' : ls === 'saving' ? 'Saving' : ls === 'error' ? 'Save error' : ls === 'off' ? 'Not available' : 'No open session' };
  const lab: Ind = { key: 'lab', label: 'Lab server', level: !account || account.reachable === false ? 'unknown' : account.user ? 'ok' : 'unknown',
    value: !account || account.reachable === false ? 'Not connected' : account.reachable === null ? 'Checking' : account.user ? 'Signed in' : 'Not signed in' };
  return [device, data, calibration, recording, local, lab];
}

export function StatusIndicators({ controller, account }: { controller: TestController; account: Account | null }) {
  return (
    <div className="statusbar" aria-label="Status">
      {indicators(controller, account).map((i) => (
        <span key={i.key} className={'ind ind-' + i.level}><span className="dot" aria-hidden="true" /><span className="k">{i.label}</span> {i.value}</span>
      ))}
    </div>
  );
}
