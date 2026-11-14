/* Records to fill in on the bench: the first-connection bench record and the Windows first-install checklist, as
   forms on the Help screen. Download CSV or Print (save as PDF from the print window). An unsent draft stays in this
   browser only, so a reload does not lose it; it is never sent anywhere. */
import { useEffect, useState } from 'react';
import { SHEETS, emptyEntries, filled, plain, recordCsv } from '../bench-record';
import type { Entries, Sheet } from '../bench-record';
import { save } from '../exports';
import { versionLine } from '../version';

const KEY = (s: Sheet) => 'bench-record-draft-' + s.id;
function loadDraft(s: Sheet): Entries {
  try {
    const j = JSON.parse(localStorage.getItem(KEY(s)) ?? 'null') as Entries | null;
    if (j && Array.isArray(j.header) && Array.isArray(j.checks)) {
      const e = emptyEntries(s);
      return { header: e.header.map((_, i) => String(j.header[i] ?? '')), checks: e.checks.map((_, i) => String(j.checks[i] ?? '')) };
    }
  } catch { /* no storage: start empty */ }
  return emptyEntries(s);
}

export function BenchRecord() {
  const [open, setOpen] = useState(false);
  const [sheetId, setSheetId] = useState<Sheet['id']>('bench');
  const sheet = SHEETS.find((s) => s.id === sheetId)!;
  const [e, setE] = useState<Entries>(() => loadDraft(sheet));
  useEffect(() => { setE(loadDraft(sheet)); }, [sheetId]);
  useEffect(() => { try { localStorage.setItem(KEY(sheet), JSON.stringify(e)); } catch { /* the draft is not kept */ } }, [e]);

  const print = () => {
    document.body.classList.add('printing-bench');
    window.addEventListener('afterprint', () => document.body.classList.remove('printing-bench'), { once: true });
    setTimeout(() => window.print(), 50);
  };
  const clear = () => { setE(emptyEntries(sheet)); };

  return (
    <section className="card-plain bench-record" aria-labelledby="br-title">
      <h2 id="br-title">Records to fill in</h2>
      <p className="hint">The bench record for the first connection of a board, and the Windows app's first-install checklist. Download or print what you wrote; the app sends it nowhere.</p>
      <p className="br-actions"><button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Open'} the records</button></p>
      {open ? (<>
        <fieldset className="choice-group br-actions">
          <legend>Record</legend>
          <div className="seg-choice">
            {SHEETS.map((s) => <label key={s.id} className={sheetId === s.id ? 'seg-on' : ''}><input type="radio" name="br-sheet" checked={sheetId === s.id} onChange={() => setSheetId(s.id)} />{s.title}</label>)}
          </div>
        </fieldset>
        <h3>{sheet.title}</h3>
        <p className="hint">{sheet.intro}</p>
        {sheet.header.map((h, i) => (
          <div key={i}><label className="field"><span className="field-label">{plain(h)}</span>
            <input type="text" value={e.header[i]} onChange={(ev) => setE({ ...e, header: e.header.map((x, j) => (j === i ? ev.target.value : x)) })} /></label><span className="br-print">{e.header[i]}</span></div>))}
        <div className="tablebox"><table className="list-table br-table">
          <thead><tr><th scope="col">#</th><th scope="col">Check</th><th scope="col">Result / notes</th></tr></thead>
          <tbody>{sheet.checks.map((c, i) => (
            <tr key={i}><th scope="row">{i + 1}</th><td>{plain(c)}</td>
              <td><textarea rows={2} aria-label={'Result for check ' + (i + 1)} value={e.checks[i]} onChange={(ev) => setE({ ...e, checks: e.checks.map((x, j) => (j === i ? ev.target.value : x)) })} /><span className="br-print">{e.checks[i]}</span></td></tr>))}
          </tbody></table></div>
        <p className="hint">{sheet.after}</p>
        <p className="row br-actions">
          <button type="button" className="primary" onClick={() => save(sheet.id + '-record-' + new Date().toISOString().slice(0, 10) + '.csv', [recordCsv(sheet, e, versionLine(), new Date())], 'text/csv;charset=utf-8')}>Download CSV</button>
          <button type="button" onClick={print}>Print</button>
          <button type="button" className="quiet" onClick={clear}>Clear</button>
          <span className="hint" role="status">{filled(e)} of {sheet.checks.length} checks filled in. The draft is kept in this browser until you clear it.</span>
        </p>
      </>) : null}
    </section>
  );
}
