/* Runs the website's own calibration CSV code (the download function in calibration.js) in a sandbox
   with a stub page, and returns the text and file name it would have saved. The date is frozen. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './legacy.mjs';

export function legacyCalibrationCsv(settings, rows, example, dateParts) {
  const text = fs.readFileSync(path.join(ROOT, 'calibration.js'), 'utf8');
  const a = text.indexOf('function cell(v) {'), b = text.indexOf('/* ---------- printed report');
  const pts = text.slice(text.indexOf('function points(s) {'), text.indexOf('/* Least squares'));
  const fitSrc = text.slice(text.indexOf('/* Least squares'), text.indexOf('/* ---------- page ---------- */'));
  if (a < 0 || b < 0) throw new Error('Could not find the calibration CSV code; the reference loader needs updating.');
  const saved = {};
  class FixedDate extends Date {
    constructor(...x) { if (x.length) super(...x); else super(...dateParts); }
  }
  const anchor = { click() {} };
  const sandbox = {
    Date: FixedDate, setTimeout() {},
    Blob: class { constructor(p) { saved.text = p.join(''); } },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    document: { createElement: () => anchor, body: { appendChild() {}, removeChild() {} } },
  };
  vm.createContext(sandbox);
  const f = vm.runInContext(
    `(function (rows, example) { var dirty = true; function num(v) { var x = parseFloat(String(v).replace(',', '.')); return isFinite(x) ? x : null; }\n${pts}\n${fitSrc}\n${text.slice(a, b)}\n return function (s) { var p = points(s); download(s, p, fit(p)); }; })`,
    sandbox, { filename: 'calibration.js (csv)' });
  f(rows, example)(settings);
  return { text: saved.text, fileName: anchor.download };
}
