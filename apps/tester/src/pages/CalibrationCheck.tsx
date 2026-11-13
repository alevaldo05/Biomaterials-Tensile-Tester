/* Check the calibration with known weights: type the mass on the load cell and the force the app shows, or press
   "Read force" to copy the app's own calibrated reading. It compares readings with F = m g, fits a line, and flags
   points against a tolerance you enter. It changes no reading or calibration, saves nothing (the rows live only in
   this screen), and makes no claim of traceability. A software baseline or a tare is not a calibration. */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { calibrationCsvFileName } from '@tensile/core';
import type { TestController } from '../controller';
import { averageReading, checkCsv, computeCheck, DEFAULT_G, emptyRows, fitSummary, MIN_ROWS, showNumber, summaryText, usedPoints } from '../calibration-check';
import type { CheckInput } from '../calibration-check';
import { save } from '../exports';
import { usePrintReport } from '../components/usePrintReport';

const READ_MS = 1000, POLL_MS = 50;

export function CalibrationCheck({ controller: c }: { controller: TestController }) {
  useSyncExternalStore(c.subscribe, c.snapshot);
  const [rows, setRows] = useState(emptyRows);
  const [unit, setUnit] = useState<'g' | 'kg'>('g');
  const [g, setG] = useState(DEFAULT_G);
  const [tol, setTol] = useState('');
  const [notes, setNotes] = useState('');
  const [reading, setReading] = useState<number | null>(null);
  const [readMsg, setReadMsg] = useState('');
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { ref, print } = usePrintReport<HTMLElement>();

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const deviceId = c.connected ? c.source?.identity?.deviceId ?? '' : '';
  const force = c.readiness?.channels.force;
  const canRead = c.connected && !!force?.calibrated;
  const whyNot = canRead ? '' : 'Connect a calibrated device to read the force; you can also type the readings.';
  const input: CheckInput = { rows, unit, g, tol, deviceId, notes };
  const res = computeCheck(input);
  const used = usedPoints(res);
  const hasTol = res.settings.tol !== null;

  const setRow = (i: number, k: 'm' | 'r', v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  /* The mean of the newest readings over one second, as the app shows the force (software baseline subtracted). */
  function readForce(i: number) {
    if (timer.current || !c.recorder) return;
    setReading(i); setReadMsg(''); setStatus('Reading…');
    const rec = c.recorder, seen = new Set<number>(), vals: number[] = [], t0 = Date.now();
    const take = () => {
      const f = rec.latest.force;
      if (f && f.value !== null && f.unit === 'N' && !seen.has(f.receivedAt_ms)) { seen.add(f.receivedAt_ms); vals.push(f.value - rec.forceZero_N); }
    };
    take();
    timer.current = setInterval(() => {
      take();
      if (Date.now() - t0 < READ_MS) return;
      clearInterval(timer.current!); timer.current = null;
      const avg = averageReading(vals);
      setReading(null);
      if (avg === null) { setReadMsg('No calibrated force reading arrived. Check that the device is sending data, or type the reading.'); setStatus(''); return; }
      setRow(i, 'r', showNumber(avg, 6));
      setStatus('Row ' + (i + 1) + ': mean of ' + vals.length + ' readings over about 1 second, ' + showNumber(avg, 5) + ' N.');
    }, POLL_MS);
  }

  const download = () => {
    const d = new Date();
    save(calibrationCsvFileName(deviceId, d), [checkCsv(input, res, d)], 'text/csv;charset=utf-8');
    setStatus('Check downloaded as a CSV file.');
  };
  const copy = () => {
    void navigator.clipboard?.writeText(summaryText(input, res, new Date())).then(() => setStatus('Results copied.'), () => setStatus('Could not copy; use Download check (CSV) instead.'));
  };
  const doPrint = () => {
    document.body.classList.add('printing-check');
    window.addEventListener('afterprint', () => document.body.classList.remove('printing-check'), { once: true });
    print();
  };

  const flagText = (q: { out: boolean; pct: number | null }) => (!hasTol || q.pct === null ? '' : q.out ? 'Outside tolerance' : 'Within tolerance');
  const fitOk = res.fit.ok;

  return (
    <section className="card-plain check-section" aria-labelledby="check-title" ref={ref}>
      <h2 id="check-title">Check the calibration with known weights</h2>
      <p className="notice"><strong>Check only.</strong> This compares the force the app shows with the force expected from known weights (F = m g). It changes no reading and no calibration, makes no claim of traceability, and saves nothing: the rows stay on this screen. A software baseline or a tare is not a calibration.</p>

      <div className="print-only print-head">
        <p><strong>Calibration check · Draft</strong> · printed {new Date().toLocaleString()}</p>
        <p>Check only; no calibration was changed. No claim of traceability. Device: {deviceId || 'not recorded'}. Readings typed by hand or read from the connected device.</p>
        <p>Mass unit {unit}; gravity {res.settings.g ?? 'not set'} m/s2; tolerance {hasTol ? res.settings.tol + ' % of reading' : 'none'}.{notes.trim() ? ' Notes: ' + notes.trim() : ''}</p>
      </div>

      <div className="check-screen">
        <div className="check-settings">
          <label className="field"><span className="field-label">Mass unit</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value as 'g' | 'kg')}><option value="g">g</option><option value="kg">kg</option></select></label>
          <label className="field"><span className="field-label">Gravity g <span className="field-unit">(m/s²)</span></span>
            <input type="text" inputMode="decimal" value={g} onChange={(e) => setG(e.target.value)} /></label>
          <label className="field"><span className="field-label">Tolerance <span className="field-unit">(% of reading, optional)</span></span>
            <input type="text" inputMode="decimal" value={tol} onChange={(e) => setTol(e.target.value)} /></label>
        </div>
        {res.problems.map((p) => <p key={p} className="error" role="alert">{p}</p>)}

        <p className="hint">The check uses the force reading as the app shows it (calibrated, with any software baseline subtracted). Read force takes the mean over about 1 second.</p>
        {!canRead ? <p className="hint" id="read-why">{whyNot}</p> : null}

        <div className="tablebox"><table className="list-table check-table">
          <caption className="sr">Known weights and force readings</caption>
          <thead><tr>
            <th scope="col">Row</th><th scope="col">Mass ({unit})</th><th scope="col">Expected F (N)</th><th scope="col">Reading (N)</th><th scope="col"><span className="sr">Read force</span></th>
            <th scope="col">Error (N)</th><th scope="col">Error (% of reading)</th><th scope="col">Flag</th><th scope="col"><span className="sr">Remove row</span></th>
          </tr></thead>
          <tbody>{rows.map((r, i) => {
            const q = res.points[i]!, bad = res.rowProblems[i];
            return (
              <tr key={i}>
                <th scope="row">{i + 1}</th>
                <td><input type="text" inputMode="decimal" aria-label={'Row ' + (i + 1) + ' mass in ' + unit} value={r.m} onChange={(e) => setRow(i, 'm', e.target.value)} aria-invalid={bad ? true : undefined} /></td>
                <td>{showNumber(q.F)}</td>
                <td><input type="text" inputMode="decimal" aria-label={'Row ' + (i + 1) + ' reading in newtons'} value={r.r} onChange={(e) => setRow(i, 'r', e.target.value)} aria-invalid={bad ? true : undefined} /></td>
                <td><button type="button" disabled={!canRead || reading !== null} aria-describedby={canRead ? undefined : 'read-why'} onClick={() => readForce(i)}>{reading === i ? 'Reading…' : 'Read force'}</button></td>
                <td>{showNumber(q.err)}</td>
                <td>{showNumber(q.pct, 4)}</td>
                <td className={q.out ? 'error' : undefined}>{flagText(q)}{bad ? <span className="error" role="alert">{bad}</span> : null}</td>
                <td><button type="button" aria-label={'Remove row ' + (i + 1)} disabled={rows.length <= 2} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Remove</button></td>
              </tr>);
          })}</tbody>
        </table></div>
        {readMsg ? <p className="error" role="alert">{readMsg}</p> : null}

        <p className="row">
          <button type="button" onClick={() => setRows((rs) => [...rs, { m: '', r: '' }])}>Add row</button>
          <button type="button" onClick={() => { setRows(emptyRows(MIN_ROWS)); setStatus('Rows cleared.'); }}>Clear rows</button>
        </p>
        <label className="field"><span className="field-label">Notes <span className="field-unit">(optional, written to the CSV and the printed check)</span></span>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      </div>

      <div className="print-only">
        <table className="list-table">
          <thead><tr><th scope="col">Mass ({unit})</th><th scope="col">Expected F (N)</th><th scope="col">Reading (N)</th><th scope="col">Error (N)</th><th scope="col">Error (%)</th><th scope="col">Flag</th></tr></thead>
          <tbody>{used.map((q) => <tr key={q.i}><td>{showNumber(q.m)}</td><td>{showNumber(q.F)}</td><td>{showNumber(q.r)}</td><td>{showNumber(q.err)}</td><td>{showNumber(q.pct, 4)}</td><td>{flagText(q)}</td></tr>)}</tbody>
        </table>
      </div>

      <h3>Fitted line</h3>
      <p className="notice" aria-live="polite">{fitOk ? 'reading = slope × force + offset (least squares). ' : ''}{fitSummary(res.fit)}</p>
      {fitOk && res.fit.big !== null && res.fit.big !== undefined ? <p className="hint">Largest error {showNumber(res.fit.big)} N.{hasTol ? ' ' + res.points.filter((q) => q.out).length + ' point(s) outside the tolerance you entered.' : ' Enter a tolerance to flag points.'}</p> : null}

      <p className="row check-actions">
        <button type="button" className="primary" onClick={download}>Download check (CSV)</button>
        <button type="button" onClick={copy}>Copy results</button>
        <button type="button" onClick={doPrint}>Print check</button>
        <span className="hint" role="status">{status}</span>
      </p>
      <p className="hint">Draft. Nothing is sent anywhere.</p>
    </section>
  );
}
