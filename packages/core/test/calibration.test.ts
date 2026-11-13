import { describe, expect, it } from 'vitest';
import { legacyCalibrationCsv } from '../reference/calibration-csv.mjs';
import { CAL_CASES } from '../reference/cases.mjs';
import saved from '../reference/fixtures/reference.json';
import { G0, calibrationCsv, calibrationCsvFileName, calibrationFit, calibrationPoints, parseNumber } from '../src/calibration';

const roundTrip = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

describe('calibration maths', () => {
  it('uses standard gravity', () => { expect(G0).toBe(9.80665); });
  it('reads typed numbers (comma as decimal point)', () => {
    expect(parseNumber('0,5')).toBe(0.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
  Object.entries(CAL_CASES).forEach(([name, c]) => {
    it(`matches the saved result: ${name}`, () => {
      const pts = calibrationPoints(c.rows, c.s);
      expect(roundTrip({ points: pts, fit: calibrationFit(pts) })).toEqual((saved.calibration as Record<string, unknown>)[name]);
    });
  });
  it('has a saved result for every case', () => {
    expect(Object.keys(saved.calibration).sort()).toEqual(Object.keys(CAL_CASES).sort());
  });
});

describe('calibration CSV record', () => {
  const date: [number, number, number, number, number, number] = [2026, 0, 15, 9, 30, 5];
  const extra = [
    { cell: 'LC-1 / "test"', notes: '=note, with comma', example: false },
    { cell: '', notes: '', example: true },
  ];
  Object.entries(CAL_CASES).forEach(([name, c]) => {
    extra.forEach((e, k) => {
      it(`gives the same text and file name as calibration.js: ${name}, variant ${k}`, () => {
        const settings = { ...c.s, cell: e.cell, notes: e.notes };
        const old = legacyCalibrationCsv(settings, c.rows, e.example, date);
        const pts = calibrationPoints(c.rows, settings);
        const d = new Date(...date);
        const text = calibrationCsv({ settings, points: pts, fit: calibrationFit(pts), example: e.example, date: d });
        expect(text).toBe(old.text);
        expect(calibrationCsvFileName(e.cell, d)).toBe(old.fileName);
      });
    });
  });
  it('starts with the expected header lines', () => {
    const c = CAL_CASES['good'];
    if (!c) throw new Error('missing case');
    const pts = calibrationPoints(c.rows, c.s);
    const text = calibrationCsv({ settings: { ...c.s, cell: '', notes: '' }, points: pts, fit: calibrationFit(pts), example: true, date: new Date(2026, 0, 15, 9, 30, 5) });
    const lines = text.split('\r\n');
    expect(lines[0]).toBe('﻿# Biomaterials Tensile Tester,calibration record');
    expect(lines[1]).toBe('# Source,example numbers (not measured)');
    expect(lines[3]).toBe('# Date,2026-01-15 09:30:05');
    expect(lines[15]).toBe('# Suggested correction (not applied),corrected force = (reading - offset) / gain');
    expect(lines[16]).toBe('mass_g,force_N,reading_N,error_N,error_pct_of_reading,outside_tolerance');
  });
});
