/* The setup file maker: the profile from typed values, calibration files, mismatch warnings, and the finished file
   read back by the app's own reader. */
import { describe, expect, it } from 'vitest';
import type { CalibrationRecord, SignalPath } from '@tensile/recording';
import { parseSetupFile } from '../src/controller';
import { buildProfile, buildSetupFile, defaultChannels, mismatches, profileInput, readCalibrations } from '../src/setup-maker';

const PATH: SignalPath = { deviceType: 'esp32-ads1115', adc: 'ADS1115', bits: 16, fullScale_mV: 4096, mode: 'single-ended', input: 'AIN0', conditioningId: 'rev-a', conditioningGain: 0.6, conditioningOffset_V: 0 };
const CAL: CalibrationRecord = { id: 'force-bench-1', quantity: 'force', unit: 'N', slope: 200, offset: -50, signalPath: PATH, origin: 'measured', createdAt: '2026-11-14T12:00:00.000Z' };
const profile = () => ({ id: 'lab-rev-a', name: 'Lab tester, rev A', channels: [{ id: 'force', conditioningId: 'rev-a', gain: '0.6', offset: '0' }, { id: 'displacement', conditioningId: 'rev-a-d', gain: '0,5', offset: '0.01' }] });

describe('setup file maker', () => {
  it('builds the profile from typed values (a decimal comma is accepted)', () => {
    const r = buildProfile(profile());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.channels.force!.conditioning).toEqual({ id: 'rev-a', gain: 0.6, offset_V: 0 });
    expect(r.value.channels.displacement!.conditioning).toEqual({ id: 'rev-a-d', gain: 0.5, offset_V: 0.01 });
  });
  it('says what is wrong with a profile', () => {
    const bad = (patch: object, re: RegExp) => { const r = buildProfile({ ...profile(), ...patch }); expect(r.ok).toBe(false); if (!r.ok) expect(r.reason).toMatch(re); };
    bad({ id: 'Bad Id' }, /Profile id/);
    bad({ name: ' ' }, /name/);
    bad({ channels: [] }, /at least one channel/);
    bad({ channels: [{ id: 'force', conditioningId: 'rev-a', gain: '0', offset: '0' }] }, /gain/);
    bad({ channels: [{ id: 'force', conditioningId: 'rev-a', gain: '1', offset: 'x' }] }, /offset/);
    bad({ channels: [{ id: 'force', conditioningId: 'rev-a', gain: '1', offset: '0' }, { id: 'force', conditioningId: 'rev-b', gain: '1', offset: '0' }] }, /twice/);
    bad({ channels: [{ id: 'force', conditioningId: '', gain: '1', offset: '0' }] }, /circuit id/);
  });
  it('reads calibration files: one record, a list, or a setup file; refuses simulated ones', () => {
    expect(readCalibrations(JSON.stringify(CAL))).toEqual({ ok: true, value: [CAL] });
    expect(readCalibrations(JSON.stringify([CAL, { ...CAL, id: 'b' }])).ok).toBe(true);
    expect(readCalibrations(JSON.stringify({ profile: {}, calibrations: [CAL] })).ok).toBe(true);
    expect(readCalibrations('not json').ok).toBe(false);
    expect(readCalibrations(JSON.stringify({ hello: 1 })).ok).toBe(false);
    const sim = readCalibrations(JSON.stringify({ ...CAL, origin: 'simulated' }));
    expect(sim.ok).toBe(false);
  });
  it('warns when a calibration was made with a different circuit than the profile has', () => {
    const p = buildProfile(profile());
    if (!p.ok) throw new Error(p.reason);
    expect(mismatches(p.value, [CAL])).toEqual([]);
    expect(mismatches(p.value, [{ ...CAL, signalPath: { ...PATH, conditioningGain: 0.5 } }])[0]).toMatch(/gain 0.5/);
    expect(mismatches(p.value, [{ ...CAL, signalPath: { ...PATH, conditioningId: 'rev-z' } }])[0]).toMatch(/rev-z/);
  });
  it('the finished file is read back by the app, with or without calibrations, and round-trips into the form', () => {
    const r = buildSetupFile(profile(), [CAL]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(parseSetupFile(r.value.text)).toEqual(r.value.file);
    expect(r.value.file.calibrations).toHaveLength(1);
    expect(buildSetupFile(profile(), []).ok).toBe(true);
    expect(profileInput(r.value.file).channels.map((c) => c.id)).toEqual(['force', 'displacement']);
    const again = buildSetupFile(profileInput(r.value.file), r.value.file.calibrations);
    expect(again.ok && again.value.text).toBe(r.value.text);
  });
  it('refuses two records with the same id', () => {
    const r = buildSetupFile(profile(), [CAL, { ...CAL }]);
    expect(r.ok).toBe(false);
  });
  it('starts with the force and displacement channels', () => {
    expect(defaultChannels().map((c) => c.id)).toEqual(['force', 'displacement']);
  });
});
