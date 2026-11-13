/* Builds two .xlsx files with the website's own excel-export.js (loaded in a sandbox, as in legacy.mjs).
   The time stamp stored in the zip is frozen, so the bytes are the same on every run.
   The values below are made up (synthetic sample numbers). None of it is measured data. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './legacy.mjs';

/* Local time, so the stored zip time is the same in every time zone. Seconds are even (the zip keeps 2-second steps). */
export const XLSX_DATE_PARTS = [2026, 0, 15, 9, 30, 6];
export const XLSX_DATE = () => new Date(...XLSX_DATE_PARTS);

export const XLSX_INFO = {
  details: [
    ['Biomaterials Tensile Tester', 'test data'],
    ['Test', 'Uniaxial tension'],
    ['Source', 'Sample data, not measured'],
    ['Material / specimen', 'Synthetic sample <A> & "B"'],
    ['Gauge length L0 (mm)', 25],
    ['Width (mm)', 5],
    ['Thickness (mm)', 1.2],
    ['Area A0 (mm2)', 6],
    ['Temperature (C)', ''],
    ['Notes', 'Synthetic record for a file-format check; not measured.\u0001 =check'],
    ['Points', 6],
  ],
  results: [
    ['Peak stress', '12.3 MPa', 'Highest stress in the record (sample value).'],
    ['Young’s modulus', '45.6 MPa', 'Slope of the loading fit (sample value).'],
    ['Failure strain', '', ''],
  ],
  columns: [
    { name: 'time_s', values: [0, 0.1, 0.2, 0.3, 0.4, 0.5] },
    { name: 'force_N', values: [0, 0.25, 0.9, 1.9, Number.NaN, 3.1] },
    { name: 'displacement_mm', values: [0, 0.0167, 0.0333, 0.05, 0.0667, 0.0833] },
    { name: 'strain', values: [0, 0.000667, 0.001333, 0.002, 0.002667, 0.003333] },
    { name: 'stress_MPa', values: [0, 0.0417, 0.15, 0.3167, 0.4, 0.5167] },
  ],
  chart: { title: 'Stress-strain (Sample data, not measured)', xName: 'strain', yName: 'stress_MPa', xTitle: 'Engineering strain (mm/mm)', yTitle: 'Engineering stress (MPa)', seriesName: 'Sample data, not measured' },
  note: 'Synthetic sample values for a file-format check. Not measured data.',
};

export const XLSX_COMPARE_INFO = {
  details: [
    ['Test', 'Uniaxial tension'],
    ['Source', 'Simulated data, not measured'],
    ['Date', '2026-01-15 09:30'],
    ['Specimens', 2],
    ['Standard deviation', 'sample standard deviation (n - 1)'],
    ['Values', 'base units (see column names)'],
  ],
  header: ['specimen', 'file', 'source', 'material', 'peak_stress_MPa', 'modulus_MPa', 'failure_strain'],
  rows: [
    ['Specimen 1', 'one.csv', 'simulated (not measured)', 'Synthetic A', 12.5, 45.25, 0.31],
    ['Specimen 2', 'two.csv', 'simulated (not measured)', '', 11.75, '', 0.28],
    ['Mean', '', '', '', 12.125, 45.25, 0.295],
    ['Standard deviation', '', '', '', 0.5303301, '', 0.02121320],
    ['n', '', '', '', 2, 1, 2],
  ],
};

function loadExcelExport() {
  const parts = [];
  class FixedDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(...XLSX_DATE_PARTS); }
  }
  class Blob {   /* keeps the byte parts so the file can be read back */
    constructor(p) { parts.push(...p); }
  }
  const sandbox = { console, TextEncoder, Uint32Array, DataView, ArrayBuffer, Date: FixedDate, Blob };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  const file = 'excel-export.js';
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
  const bytes = () => {
    const chunks = parts.splice(0).map((p) => (p instanceof Uint8Array ? Buffer.from(p.buffer, p.byteOffset, p.byteLength) : Buffer.from(new Uint8Array(p))));
    return Buffer.concat(chunks);
  };
  return { api: sandbox.window.TensileExcel, bytes };
}

export function buildXlsxReference() {
  const { api, bytes } = loadExcelExport();
  api.build(XLSX_INFO);
  const single = bytes().toString('base64');
  api.buildCompare(XLSX_COMPARE_INFO);
  const compare = bytes().toString('base64');
  return { single, compare };
}
