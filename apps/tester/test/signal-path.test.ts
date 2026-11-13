import { describe, expect, it } from 'vitest';
import type { AcquisitionSettings, Channel, DeviceIdentity } from '@tensile/acquisition';
import { buildCalibration, pathFor, unitFor } from '../src/pages/signal-path';

const identity: DeviceIdentity = { deviceId: 'dev-1', deviceType: 'esp32', softwareVersion: '1', protocol: 'tensile-ndjson/1', bootId: 'b' };
const settings: AcquisitionSettings = { ref: 's1', adc: 'ads1115', bits: 16, fullScale_mV: 4096, dataRate_sps: 128, channelOrder: ['f', 'd'] };
const force: Channel = { id: 'f', quantity: 'force', mode: 'single-ended', input: 'A0', encoding: 'int16' };
const disp: Channel = { id: 'd', quantity: 'displacement', mode: 'differential', input: 'A2-A3', encoding: 'int16' };
const profile = { id: 'prof-1', channels: { f: { conditioning: { id: 'div-a', gain: 0.5, offset_V: 0.1 } }, d: { conditioning: { id: 'div-b', gain: 0.25, offset_V: 0 } } } };
const base = { identity, settings, profile, id: 'cal-1', slope: '20', offset: '-1.5', note: 'masses' };

describe('calibration request', () => {
  it('uses N for force and mm for displacement', () => {
    expect(unitFor('force')).toBe('N');
    expect(unitFor('displacement')).toBe('mm');
    const f = buildCalibration({ ...base, channel: force });
    const d = buildCalibration({ ...base, channel: disp });
    expect(f.ok && f.body.unit).toBe('N');
    expect(d.ok && d.body.unit).toBe('mm');
  });
  it('refuses a channel without conditioning in the profile', () => {
    const r = buildCalibration({ ...base, channel: { ...force, id: 'x' } });
    expect(r.ok).toBe(false);
    expect(pathFor({ identity, settings, profile, channel: { ...force, id: 'x' } }).ok).toBe(false);
  });
  it('copies the settings range and the conditioning gain into the signal path', () => {
    const r = buildCalibration({ ...base, channel: force });
    if (!r.ok) throw new Error(r.reason);
    expect(r.body.signalPath).toMatchObject({ fullScale_mV: 4096, conditioningGain: 0.5, conditioningId: 'div-a', conditioningOffset_V: 0.1, input: 'A0', mode: 'single-ended' });
    expect(r.body).toMatchObject({ profileId: 'prof-1', slope: 20, offset: -1.5, quantity: 'force' });
  });
  it('refuses bad numbers and ids, and a voltage channel', () => {
    expect(buildCalibration({ ...base, channel: force, slope: '' }).ok).toBe(false);
    expect(buildCalibration({ ...base, channel: force, slope: '0' }).ok).toBe(false);
    expect(buildCalibration({ ...base, channel: force, offset: 'abc' }).ok).toBe(false);
    expect(buildCalibration({ ...base, channel: force, id: 'Bad Id' }).ok).toBe(false);
    expect(buildCalibration({ ...base, channel: { ...force, quantity: 'voltage' } }).ok).toBe(false);
  });
});
