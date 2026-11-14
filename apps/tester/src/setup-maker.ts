/* The setup file maker: builds the file the app already reads (a device profile and calibration records) from typed
   values, so nobody writes JSON by hand. Pure: no screen code, so it is tested by itself.
   The profile's gain and offset per channel come from the reviewed interface circuit (docs/app/TESTER-INTERFACE.md);
   nothing here works them out. Calibration records come from files (for example the Device screen's bench fit). The
   finished file is checked with the app's own reader (parseSetupFile) before it is offered. */
import type { CalibrationRecord, DeviceProfile } from '@tensile/recording';
import { parseSetupFile } from './controller';
import type { SetupFile } from './controller';

export interface ChannelInput { id: string; conditioningId: string; gain: string; offset: string }
export interface ProfileInput { id: string; name: string; channels: ChannelInput[] }
export type Built<T> = { ok: true; value: T } | { ok: false; reason: string };

const ID = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const ID_RULE = '2 to 64 lowercase letters, digits, dots, dashes, or underscores';

function num(t: string): number | null {
  const s = t.trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** The two channels the app records, with the reference firmware's channel ids (to verify against the device). */
export const defaultChannels = (ids: string[] = ['force', 'displacement']): ChannelInput[] =>
  ids.map((id) => ({ id, conditioningId: '', gain: '', offset: '0' }));

export function buildProfile(p: ProfileInput): Built<DeviceProfile> {
  const id = p.id.trim(), name = p.name.trim();
  if (!ID.test(id)) return { ok: false, reason: 'Profile id: use ' + ID_RULE + '.' };
  if (!name) return { ok: false, reason: 'Give the profile a name.' };
  if (!p.channels.length) return { ok: false, reason: 'Add at least one channel.' };
  const channels: DeviceProfile['channels'] = {};
  for (const ch of p.channels) {
    const cid = ch.id.trim(), cond = ch.conditioningId.trim();
    const label = 'Channel ' + (cid || '(no id)');
    if (!cid) return { ok: false, reason: 'Every channel needs the id the device reports (for example force).' };
    if (channels[cid]) return { ok: false, reason: label + ' is listed twice.' };
    if (!ID.test(cond)) return { ok: false, reason: label + ': the circuit id (its revision name) must use ' + ID_RULE + '.' };
    const gain = num(ch.gain), offset = num(ch.offset);
    if (gain === null || !(gain > 0)) return { ok: false, reason: label + ': the gain (volts at the ADC per volt at the tester’s output) must be a number above 0.' };
    if (offset === null) return { ok: false, reason: label + ': the offset must be a number (0 when there is none).' };
    channels[cid] = { conditioning: { id: cond, gain, offset_V: offset } };
  }
  return { ok: true, value: { id, name, channels } };
}

/** Reads calibration records from a file: one record, a list of records, or a setup file's records. */
export function readCalibrations(text: string): Built<CalibrationRecord[]> {
  let j: unknown;
  try { j = JSON.parse(text); } catch { return { ok: false, reason: 'This file is not JSON.' }; }
  const list = Array.isArray(j) ? j : j && typeof j === 'object' && Array.isArray((j as { calibrations?: unknown }).calibrations) ? (j as { calibrations: unknown[] }).calibrations : [j];
  const ok = (c: unknown): c is CalibrationRecord => {
    const r = c as CalibrationRecord;
    return !!r && typeof r.id === 'string' && (r.quantity === 'force' || r.quantity === 'displacement') && (r.unit === 'N' || r.unit === 'mm')
      && Number.isFinite(r.slope) && Number.isFinite(r.offset) && !!r.signalPath && typeof r.signalPath === 'object';
  };
  if (!list.length || !list.every(ok)) return { ok: false, reason: 'No calibration record was found in this file.' };
  if (list.some((c) => (c as CalibrationRecord).origin !== 'measured')) return { ok: false, reason: 'Only calibrations made on real equipment can go in a setup file (this one was made for the simulator).' };
  return { ok: true, value: list as CalibrationRecord[] };
}

/** Records whose circuit does not match the profile: the app would refuse them at connection, so say so now. */
export function mismatches(profile: DeviceProfile, cals: CalibrationRecord[]): string[] {
  const out: string[] = [];
  for (const c of cals) {
    const ch = Object.values(profile.channels).find((x) => x.conditioning.id === c.signalPath.conditioningId);
    if (!ch) { out.push('Calibration ' + c.id + ' was made with circuit "' + c.signalPath.conditioningId + '", which no channel in this profile has.'); continue; }
    const k = ch.conditioning;
    if (k.gain !== c.signalPath.conditioningGain || k.offset_V !== c.signalPath.conditioningOffset_V) {
      out.push('Calibration ' + c.id + ' was made with gain ' + c.signalPath.conditioningGain + ' and offset ' + c.signalPath.conditioningOffset_V + ' V, but the profile has gain ' + k.gain + ' and offset ' + k.offset_V + ' V.');
    }
  }
  return out;
}

/** The finished file, checked with the app's own reader. Duplicate record ids are refused. */
export function buildSetupFile(profile: ProfileInput, cals: CalibrationRecord[]): Built<{ file: SetupFile; text: string; warnings: string[] }> {
  const p = buildProfile(profile);
  if (!p.ok) return p;
  const ids = new Set<string>();
  for (const c of cals) { if (ids.has(c.id)) return { ok: false, reason: 'Two calibration records have the id ' + c.id + '. Keep one.' }; ids.add(c.id); }
  const text = JSON.stringify({ profile: p.value, calibrations: cals }, null, 2) + '\n';
  try { return { ok: true, value: { file: parseSetupFile(text), text, warnings: mismatches(p.value, cals) } }; } catch (e) { return { ok: false, reason: e instanceof Error ? e.message : String(e) }; }
}

/** Fills the form from an existing setup file, to add calibrations or change a value. */
export function profileInput(f: SetupFile): ProfileInput {
  return { id: f.profile.id, name: f.profile.name, channels: Object.entries(f.profile.channels).map(([id, c]) => ({ id, conditioningId: c.conditioning.id, gain: String(c.conditioning.gain), offset: String(c.conditioning.offset_V) })) };
}
