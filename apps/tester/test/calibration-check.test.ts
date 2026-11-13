import { describe, expect, it } from 'vitest';
import { averageReading, checkCsv, computeCheck, DEFAULT_G, emptyRows, summaryText, usedPoints } from '../src/calibration-check';
import type { CheckInput } from '../src/calibration-check';

/* g = 10 m/s2 so the numbers are easy by hand: 100 g = 1 N, 200 g = 2 N, 300 g = 3 N. */
const base = (o: Partial<CheckInput> = {}): CheckInput => ({
  rows: [{ m: '100', r: '1.1' }, { m: '200', r: '2' }, { m: '300', r: '2.9' }], unit: 'g', g: '10', tol: '5', deviceId: 'dev-1', notes: '', ...o,
});

describe('calibration check', () => {
  it('computes expected force, errors, flags, and the line by hand', () => {
    const r = computeCheck(base());
    expect(r.problems).toEqual([]);
    const [a, b, c] = r.points;
    expect(a!.F).toBeCloseTo(1, 12);
    expect(a!.err).toBeCloseTo(0.1, 12);
    expect(a!.pct).toBeCloseTo(0.1 / 1.1 * 100, 9);
    expect(a!.out).toBe(true);
    expect(b!.err).toBeCloseTo(0, 12);
    expect(b!.out).toBe(false);
    expect(c!.err).toBeCloseTo(-0.1, 12);
    expect(c!.out).toBe(false);
    expect(r.fit.ok).toBe(true);
    expect(r.fit.a).toBeCloseTo(0.9, 12);
    expect(r.fit.b).toBeCloseTo(0.2, 12);
    expect(r.fit.r2).toBeCloseTo(1, 12);
    expect(r.fit.big).toBeCloseTo(0.1, 12);
  });
  it('uses kg when asked', () => {
    const r = computeCheck(base({ unit: 'kg', rows: [{ m: '1', r: '10' }, { m: '2', r: '20' }] }));
    expect(r.points[0]!.F).toBeCloseTo(10, 12);
    expect(r.fit.a).toBeCloseTo(1, 12);
  });
  it('flags nothing without a tolerance and reports a bad tolerance or gravity', () => {
    const none = computeCheck(base({ tol: '' }));
    expect(none.settings.tol).toBeNull();
    expect(none.points.some((q) => q.out)).toBe(false);
    expect(computeCheck(base({ tol: '-1' })).problems[0]).toMatch(/Tolerance/);
    const g = computeCheck(base({ g: '0' }));
    expect(g.problems[0]).toMatch(/gravity/i);
    expect(g.fit.ok).toBe(false);
    expect(computeCheck(base({ g: '9,8' })).settings.g).toBe(9.8);
  });
  it('ignores blank rows and reports invalid ones', () => {
    const r = computeCheck(base({ rows: [...emptyRows(2), { m: '100', r: '1' }, { m: 'abc', r: '1' }, { m: '-5', r: '1' }, { m: '200', r: 'x' }, { m: '200', r: '2' }] }));
    expect(r.rowProblems).toEqual({ 3: 'The mass is not a number.', 4: 'The mass cannot be negative.', 5: 'The reading is not a number.' });
    expect(r.fit.n).toBe(2);
    expect(r.fit.ok).toBe(true);
    expect(usedPoints(r).length).toBe(5);
  });
  it('says the fit is not possible with fewer than 2 points or equal masses', () => {
    expect(computeCheck(base({ rows: [{ m: '100', r: '1' }] })).fit.msg).toBe('Enter at least 2 points (a mass and its reading) to fit a line.');
    expect(computeCheck(base({ rows: [] })).fit.ok).toBe(false);
    expect(computeCheck(base({ rows: [{ m: '100', r: '1' }, { m: '100', r: '1.2' }] })).fit.msg).toMatch(/all the same/);
  });
  it('averages readings and ignores missing ones', () => {
    expect(averageReading([1, 2, 3])).toBe(2);
    expect(averageReading([1, null, undefined, NaN, 3])).toBe(2);
    expect(averageReading([])).toBeNull();
    expect(averageReading([null])).toBeNull();
  });
  it('writes the CSV header and rows', () => {
    const inp = base(), r = computeCheck(inp);
    const csv = checkCsv(inp, r, new Date(2026, 0, 2, 3, 4, 5));
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe('# Biomaterials Tensile Tester,calibration check');
    expect(lines.find((l) => l.startsWith('# Source'))).toMatch(/tester app: readings typed by hand or read from the connected device/);
    expect(lines.join('\n')).not.toContain('not measured by this site');
    expect(lines).toContain('# Date,2026-01-02 03:04:05');
    expect(lines).toContain('# Load cell,dev-1');
    expect(lines).toContain('# Gravity g (m/s2),10');
    expect(lines).toContain('# Tolerance (+/- % of reading),5');
    expect(lines).toContain('# Points,3');
    expect(lines.find((l) => l.startsWith('# Source'))).toMatch(/no calibration was changed/);
    const head = lines.indexOf('mass_g,force_N,reading_N,error_N,error_pct_of_reading,outside_tolerance');
    expect(head).toBeGreaterThan(0);
    expect(lines[head + 1]).toBe('100,1,1.1,0.1,9.090909,yes');
    expect(lines[head + 2]).toBe('200,2,2,0,0,no');
    expect(lines[head + 3]).toBe('300,3,2.9,-0.1,-3.448276,no');
  });
  it('writes the summary text with the check-only wording', () => {
    const inp = base(), t = summaryText(inp, computeCheck(inp), new Date(2026, 0, 1));
    expect(t).toMatch(/no calibration was changed/);
    expect(t).toMatch(/outside tolerance/);
    expect(t).toMatch(/1 point\(s\) outside/);
    expect(t).toMatch(/not a calibration/);
  });
  it('defaults gravity to standard gravity', () => { expect(DEFAULT_G).toBe('9.80665'); });
});
