/* Key results with optional definitions (from the website's data/terms.js). */
import { useState } from 'react';
import type { TestRecord } from '@tensile/core';
import site from 'virtual:site-data';
import { resultsFor, TERM_FOR } from '../results';

export function ResultsTable({ record, problem, note }: { record: TestRecord | null; problem: string; note: string }) {
  const [showDefs, setShowDefs] = useState(false);
  const rows = resultsFor(record).rows;
  return (
    <>
      <p className="row"><span className="hint">{note}</span><label className="check defs-switch"><input type="checkbox" checked={showDefs} onChange={(e) => setShowDefs(e.target.checked)} /> Show definitions</label></p>
      {rows.length ? (
        <table className="results"><tbody>
          {rows.map((r) => { const t = site.terms[TERM_FOR[r.id] ?? '']; return (
            <tr key={r.id}><th scope="row">{r.name}{showDefs && t ? <span className="def">{t.def}{t.eq ? ' ' + t.eq + '.' : ''}</span> : null}</th><td className="num">{r.value}</td><td className="hint">{r.note}</td></tr>); })}
        </tbody></table>) : <p>{problem || 'Too few points for key results.'}</p>}
      {rows.length ? <p className="hint">Strain is crosshead-based (crosshead displacement divided by the gauge length), not measured on the specimen.</p> : null}
    </>
  );
}
