/* Builds the request body for a new calibration from the connected device. Pure: no page code, so it is tested by itself.
   The slope and offset come from the person's own bench calibration; nothing here works them out. */
import { signalPathOf } from '@tensile/recording';
import type { DeviceProfile, SignalPath } from '@tensile/recording';
import type { AcquisitionSettings, Channel, DeviceIdentity } from '@tensile/acquisition';

export interface CalibrationInput {
  identity: DeviceIdentity;
  channel: Channel;
  settings: AcquisitionSettings;
  profile: { id: string; channels: DeviceProfile['channels'] };
  /** Typed values, as text. */
  id: string;
  slope: string;
  offset: string;
  note: string;
}
export interface CalibrationBody {
  id: string; profileId: string; quantity: 'force' | 'displacement'; unit: 'N' | 'mm'; slope: number; offset: number; signalPath: SignalPath; note: string;
}
export type CalibrationResult = { ok: true; body: CalibrationBody } | { ok: false; reason: string };

export const unitFor = (q: 'force' | 'displacement'): 'N' | 'mm' => (q === 'force' ? 'N' : 'mm');
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,63}$/;

function typedNumber(text: string): number | null {
  const t = text.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** The signal path for a channel, or a reason it cannot be made (the profile has no conditioning for it). */
export function pathFor(i: Pick<CalibrationInput, 'identity' | 'channel' | 'settings' | 'profile'>): { ok: true; path: SignalPath } | { ok: false; reason: string } {
  const entry = i.profile.channels[i.channel.id];
  if (!entry) return { ok: false, reason: 'The profile has no conditioning circuit for channel ' + i.channel.id + '.' };
  return { ok: true, path: signalPathOf(i.identity, i.channel, i.settings, entry.conditioning) };
}

export function buildCalibration(i: CalibrationInput): CalibrationResult {
  const q = i.channel.quantity;
  if (q !== 'force' && q !== 'displacement') return { ok: false, reason: 'Only force and displacement channels are calibrated.' };
  const p = pathFor(i);
  if (!p.ok) return p;
  const id = i.id.trim();
  if (!ID_PATTERN.test(id)) return { ok: false, reason: 'Use 2 to 64 lowercase letters, digits, dots, dashes, or underscores for the id.' };
  const slope = typedNumber(i.slope);
  if (slope === null) return { ok: false, reason: 'Enter the slope as a number.' };
  if (slope === 0) return { ok: false, reason: 'The slope cannot be 0.' };
  const offset = typedNumber(i.offset);
  if (offset === null) return { ok: false, reason: 'Enter the offset as a number.' };
  return { ok: true, body: { id, profileId: i.profile.id, quantity: q, unit: unitFor(q), slope, offset, signalPath: p.path, note: i.note.trim() } };
}
