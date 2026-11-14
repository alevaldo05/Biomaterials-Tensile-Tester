/* Loads the website's own calculation scripts (the plain .js files at the repository root) into a
   sandbox, exactly as a page would, so their results can be recorded and compared with the
   TypeScript port in src/. Nothing here changes those files.
   Every website file is read through readShared, which refuses a file that is not on the list of shared website
   files (scripts/shared-files.js), so the app's build stamp covers everything these checks run. */
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const shared = createRequire(import.meta.url)(path.join(ROOT, 'scripts', 'shared-files.js'));
/** Reads a website file (path from the top of the project); throws if it is not in scripts/shared-files.js. */
export const readShared = (rel) => shared.readShared(rel, ROOT);
const read = readShared;

function slice(text, from, to, file) {
  const a = text.indexOf(from);
  const b = text.indexOf(to, a + 1);
  if (a < 0 || b < 0) throw new Error(`Could not find the expected part of ${file}; the reference loader needs updating.`);
  return text.slice(a, b);
}

export function loadLegacy() {
  const sandbox = {
    console,
    document: { documentElement: { getAttribute: () => null }, getElementById: () => null },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of ['data/device.js', 'data/samples.js', 'graph-core.js', 'live-csv.js']) {
    vm.runInContext(read(f), sandbox, { filename: f });
  }
  /* calibration.js and compare.js are page scripts; only their pure maths is taken. */
  const cal = slice(read('calibration.js'), 'var G0 = 9.80665;', '/* ---------- page ---------- */', 'calibration.js');
  const calibration = vm.runInContext(
    `(function () { ${cal}\n return { points: points, fit: fit, setRows: function (r) { rows = r; } }; })()`,
    sandbox, { filename: 'calibration.js (numbers)' });
  const st = slice(read('compare.js'), 'function stats(vals) {', '/* stress columns are shown', 'compare.js');
  const stats = vm.runInContext(`(function () { ${st}\n return stats; })()`, sandbox, { filename: 'compare.js (stats)' });
  const TG = sandbox.TensileGraphCore;
  /* graph.js adds this one helper to the page; it is repeated here from graph.js so the CSV header can be built. */
  const modulusFitText = (rec) => {
    const f = rec && rec.x && rec.x.length > 1 ? TG.loadingFit(rec.x, rec.y) : null;
    return f ? TG.fitText(rec.x, f, true).replace(/\.$/, '') : '';
  };
  return { TG, LiveCsv: sandbox.LiveCsv, DEVICE: sandbox.DEVICE, SAMPLE_DATA: sandbox.SAMPLE_DATA, calibration, stats, modulusFitText };
}
