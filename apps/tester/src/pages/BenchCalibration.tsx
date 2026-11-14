/* Make a calibration from bench points: type the volts at the tester's output (as the app shows them with no
   calibration) for known loads or known displacements, and the app fits value = slope × volts + offset. It shows
   the line, each point's difference from it, and flags points against a tolerance you enter. It changes no reading
   and no calibration in use. "Download calibration record" gives a draft record tied to the connected device's
   signal path; the app uses it only after it is put in a setup file. Not a traceable calibration. */
import { useState, useSyncExternalStore } from 'react';
import type { TestController } from '../controller';
import { benchCsv, benchRecord, emptyBenchRows, fitBench, MIN_POINTS } from '../bench-fit';
import type { BenchResult, BenchRow, Quantity } from '../bench-fit';
import { save } from '../exports';
import { pathFor } from './signal-path';
import { showNumber } from '../calibration-check';

/* A small picture of the points and the line. Display only. */
function FitChart({ r }: { r: BenchResult }) {
  const pts = r.points.filter((p) => p.v !== null && p.x !== null) as { v: number; x: number; out: boolean }[];
  if (pts.length < 2) return null;
  const W = 320, H = 180, P = 28;
  const vs = pts.map((p) => p.v), xs = pts.map((p) => p.x);
  const v0 = Math.min(...vs), v1 = Math.max(...vs), x0 = Math.min(...xs), x1 = Math.max(...xs);
  const sx = (v: number) => P + ((v - v0) / (v1 - v0 || 1)) * (W - 2 * P), sy = (x: number) => H - P - ((x - x0) / (x1 - x0 || 1)) * (H - 2 * P);
  return (
    <svg className="bench-chart" viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label={'Known value against volts, ' + pts.length + ' points' + (r.ok ? ', with the fitted line' : '')}>
      <path d={'M' + P + ' ' + P + 'V' + (H - P) + 'H' + (W - P)} fill="none" stroke="currentColor" strokeOpacity="0.5" />
      {r.ok && r.slope !== undefined && r.offset !== undefined ? <line x1={sx(v0)} y1={sy(r.slope * v0 + r.offset)} x2={sx(v1)} y2={sy(r.slope * v1 + r.offset)} stroke="var(--accent)" strokeWidth="2" /> : null}
      {pts.map((p, i) => <circle key={i} cx={sx(p.v)} cy={sy(p.x)} r="4" fill={p.out ? 'var(--mark)' : 'currentColor'} />)}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="currentColor">Volts at the tester's output</text>
      <text x="10" y={H / 2} textAnchor="middle" fontSize="11" fill="currentColor" transform={'rotate(-90 10 ' + H / 2 + ')'}>Known value ({r.unit})</text>
    </svg>
  );
}

export function BenchCalibration({ controller: c }: { controller: TestController }) {
  useSyncExternalStore(c.subscribe, c.snapshot);
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState<Quantity>('force');
  const [rows, setRows] = useState<BenchRow[]>(emptyBenchRows);
  const [tol, setTol] = useState('');
  const [id, setId] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const r = fitBench({ quantity, rows, tol });
  const setCell = (i: number, k: keyof BenchRow, v: string) => setRows((rs) => rs.map((row, j) => (j === i ? { ...row, [k]: v } : row)));

  /* The signal path of the connected device's channel for this quantity, from the loaded setup file's profile. */
  const src = c.source, identity = src?.identity ?? null, settings = src?.settings ?? null, profile = c.setupFile?.profile ?? null;
  const channel = (src?.channels ?? []).find((ch) => ch.quantity === quantity) ?? null;
  const path = src && src.kind === 'real' && c.connected && identity && settings && profile && channel ? pathFor({ identity, settings, profile, channel }) : null;
  const pathNote = !c.connected || src?.kind !== 'real' ? 'Connect the acquisition device to tie the record to its signal path.'
    : !profile ? 'Load a setup file with the device profile (the reviewed circuit’s gain and offset) to tie the record to its signal path.'
    : !channel ? 'The connected device has no ' + quantity + ' channel.'
    : path && !path.ok ? path.reason : '';

  const download = () => {
    setMsg('');
    if (!path || !path.ok) { setMsg(pathNote); return; }
    const out = benchRecord(r, quantity, path.path, id, note, new Date());
    if (!out.ok) { setMsg(out.reason); return; }
    save('calibration-' + out.record.id + '.json', [JSON.stringify(out.record, null, 2)], 'application/json');
    setMsg('Downloaded. Put it in a setup file to use it; nothing in use has changed.');
  };

  return (
    <section className="card-plain" aria-labelledby="bench-title">
      <h2 id="bench-title">Make a calibration from bench points</h2>
      <p className="hint">Type the volts at the tester's output for known loads or known displacements, as in the calibration plan. The app fits a line and gives you a draft record to download. It changes nothing in use and is not a traceable calibration.</p>
      <p><button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Open'} the bench fit</button></p>
      {open ? (<>
        <fieldset className="choice-group">
          <legend>Quantity</legend>
          <div className="seg-choice">
            {(['force', 'displacement'] as const).map((q) => (
              <label key={q} className={quantity === q ? 'seg-on' : ''}><input type="radio" name="bench-q" checked={quantity === q} onChange={() => setQuantity(q)} />{q === 'force' ? 'Force (N)' : 'Displacement (mm)'}</label>))}
          </div>
        </fieldset>
        <div className="tablebox"><table className="list-table">
          <thead><tr><th scope="col">Point</th><th scope="col">Volts at the tester's output (V)</th><th scope="col">Known value ({r.unit})</th><th scope="col">Line ({r.unit})</th><th scope="col">Difference ({r.unit})</th></tr></thead>
          <tbody>{rows.map((row, i) => {
            const p = r.points[i];
            return (
              <tr key={i} className={p?.out ? 'row-flag' : undefined}>
                <th scope="row">{i + 1}</th>
                <td><input className="bench-num" type="text" inputMode="decimal" aria-label={'Volts, point ' + (i + 1)} value={row.v} onChange={(e) => setCell(i, 'v', e.target.value)} /></td>
                <td><input className="bench-num" type="text" inputMode="decimal" aria-label={'Known value, point ' + (i + 1)} value={row.x} onChange={(e) => setCell(i, 'x', e.target.value)} />{r.rowProblems[i] ? <span className="error"> {r.rowProblems[i]}</span> : null}</td>
                <td className="num">{p?.fitted != null ? showNumber(p.fitted) : '—'}</td>
                <td className="num">{p?.residual != null ? <>{showNumber(p.residual)}{p.out ? <span className="bench-over"> over</span> : null}</> : '—'}</td>
              </tr>);
          })}</tbody></table></div>
        <p className="row"><button type="button" onClick={() => setRows((rs) => rs.concat({ v: '', x: '' }))}>Add a point</button>
          <button type="button" className="quiet" onClick={() => { setRows(emptyBenchRows()); setMsg(''); }}>Clear</button></p>
        <label className="field"><span className="field-label">Tolerance ({r.unit}, optional)</span><input type="text" inputMode="decimal" value={tol} onChange={(e) => setTol(e.target.value)} aria-describedby="bench-tol-hint" /></label>
        <p className="hint" id="bench-tol-hint">Points further from the line than this are flagged. You set it; the app does not.</p>
        {r.tolProblem ? <p className="error" role="alert">{r.tolProblem}</p> : null}
        <p role="status">{r.ok ? 'Line: ' + r.unit + ' = ' + showNumber(r.slope) + ' × V ' + ((r.offset ?? 0) < 0 ? '− ' : '+ ') + showNumber(Math.abs(r.offset ?? 0)) + ' · r² ' + (r.r2 != null ? r.r2.toFixed(5) : '—') + ' · largest difference ' + (r.maxResidual != null ? showNumber(Math.abs(r.maxResidual)) + ' ' + r.unit : '—') + ' · ' + r.n + ' points' + (r.n < MIN_POINTS ? ' (' + MIN_POINTS + ' or more recommended)' : '') : r.msg}</p>
        <FitChart r={r} />
        <label className="field"><span className="field-label">Record id</span><input type="text" autoComplete="off" spellCheck={false} value={id} onChange={(e) => setId(e.target.value)} placeholder={quantity + '-' + new Date().toISOString().slice(0, 10)} /></label>
        <label className="field"><span className="field-label">Note (equipment, who, conditions)</span><input type="text" value={note} onChange={(e) => setNote(e.target.value)} /></label>
        {pathNote ? <p className="hint">{pathNote}</p> : null}
        <p className="row">
          <button type="button" className="primary" disabled={!r.ok || !path || !path.ok} onClick={download}>Download calibration record</button>
          <button type="button" disabled={r.n === 0} onClick={() => save('bench-points-' + quantity + '.csv', [benchCsv(r, quantity, new Date())], 'text/csv;charset=utf-8')}>Download points (CSV)</button>
        </p>
        {msg ? <p className="hint" role="status">{msg}</p> : null}
      </>) : null}
    </section>
  );
}
