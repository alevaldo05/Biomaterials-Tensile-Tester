/* Calibration from bench points: the line fit, the per-point differences, the tolerance flags, and the draft record. */
import { describe, expect, it } from 'vitest';
import { benchCsv, benchRecord, emptyBenchRows, fitBench } from '../src/bench-fit';
import type { SignalPath } from '@tensile/recording';

const rows = (pairs: [string, string][]) => pairs.map(([v, x]) => ({ v, x }));
const PATH: SignalPath = { deviceType: 'esp32-ads1115', adc: 'ADS1115', bits: 16, fullScale_mV: 4096, mode: 'single-ended', input: 'AIN0', conditioningId: 'rev-a', conditioningGain: 0.6, conditioningOffset_V: 0 };

describe('bench fit', () => {
  it('fits value = slope × volts + offset exactly for points on a line', () => {
    const r = fitBench({ quantity: 'force', tol: '', rows: rows([['0.5', '50'], ['1', '150'], ['1.5', '250'], ['2', '350'], ['2.5', '450']]) });
    expect(r.ok).toBe(true);
    expect(r.unit).toBe('N');
    expect(r.slope).toBeCloseTo(200, 9);
    expect(r.offset).toBeCloseTo(-50, 9);
    expect(r.r2).toBeCloseTo(1, 12);
    expect(Math.abs(r.maxResidual!)).toBeLessThan(1e-9);
    expect(r.n).toBe(5);
  });
  it('shows each point’s difference and flags those outside the tolerance', () => {
    const r = fitBench({ quantity: 'displacement', tol: '0.05', rows: rows([['0', '0'], ['1', '10'], ['2', '20.2'], ['3', '30'], ['4', '40']]) });
    expect(r.ok).toBe(true);
    expect(r.unit).toBe('mm');
    const out = r.points.filter((p) => p.out).map((p) => p.i);
    expect(out).toContain(2);
    expect(r.points[2]!.residual!).toBeGreaterThan(0.05);
  });
  it('accepts a decimal comma, ignores empty rows, and names bad rows', () => {
    const r = fitBench({ quantity: 'force', tol: '', rows: [...rows([['0,5', '10'], ['1,5', '30'], ['abc', '5'], ['2', '']]), ...emptyBenchRows(2)] });
    expect(r.ok).toBe(true);
    expect(r.n).toBe(2);
    expect(r.slope).toBeCloseTo(20, 9);
    expect(r.rowProblems[2]).toMatch(/numbers/);
    expect(r.rowProblems[3]).toMatch(/both/);
  });
  it('says why no line can be fitted', () => {
    expect(fitBench({ quantity: 'force', tol: '', rows: rows([['1', '10']]) }).msg).toMatch(/at least 2 points/);
    expect(fitBench({ quantity: 'force', tol: '', rows: rows([['1', '10'], ['1', '20']]) }).msg).toMatch(/volts are all the same/);
    expect(fitBench({ quantity: 'force', tol: '', rows: rows([['1', '10'], ['2', '10']]) }).ok).toBe(false);
    expect(fitBench({ quantity: 'force', tol: '-1', rows: rows([['1', '10'], ['2', '20']]) }).tolProblem).toMatch(/above 0/);
  });
});

describe('draft calibration record', () => {
  const r = fitBench({ quantity: 'force', tol: '', rows: rows([['0', '0'], ['1', '100'], ['2', '200']]) });
  it('is measured, tied to the signal path, and keeps the fit in the note', () => {
    const out = benchRecord(r, 'force', PATH, 'force-bench-1', 'Known masses, room 20 C', new Date('2026-11-14T12:00:00Z'));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.record).toMatchObject({ id: 'force-bench-1', quantity: 'force', unit: 'N', origin: 'measured', signalPath: PATH, createdAt: '2026-11-14T12:00:00.000Z' });
    expect(out.record.slope).toBeCloseTo(100, 9);
    expect(out.record.note).toMatch(/^Known masses, room 20 C Bench fit of 3 points, r² 1\.00000/);
  });
  it('refuses a bad id or a missing fit', () => {
    expect(benchRecord(r, 'force', PATH, 'Bad Id', '', new Date()).ok).toBe(false);
    expect(benchRecord(fitBench({ quantity: 'force', tol: '', rows: [] }), 'force', PATH, 'ok-id', '', new Date()).ok).toBe(false);
  });
  it('the record can be loaded by the app’s setup-file check (measured origin, finite numbers)', async () => {
    const { parseSetupFile } = await import('../src/controller');
    const out = benchRecord(r, 'force', PATH, 'force-bench-1', '', new Date());
    if (!out.ok) throw new Error(out.reason);
    const file = { profile: { id: 'lab-rev-a', name: 'Lab', channels: { force: { conditioning: { id: 'rev-a', gain: 0.6, offset_V: 0 } } } }, calibrations: [out.record] };
    expect(parseSetupFile(JSON.stringify(file)).calibrations[0]!.id).toBe('force-bench-1');
  });
  it('the points download as CSV with the fit in its header', () => {
    const csv = benchCsv(r, 'force', new Date('2026-11-14T12:00:00Z'));
    expect(csv).toContain('# Slope (N/V),');
    expect(csv.split('\r\n').filter((l) => /^\d/.test(l))).toHaveLength(3);
  });
});
