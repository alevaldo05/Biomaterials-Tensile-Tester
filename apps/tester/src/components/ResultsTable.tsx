/* Key results: a name, a value and its unit. Each has an "i" button that shows what the number is and its caveats
   (estimates stay labeled as estimates). No equations on screen; the files keep their full wording. */
import { useState } from 'react';
import type { TestRecord } from '@tensile/core';
import { resultsFor } from '../results';

export function ResultsTable({ record, problem, note }: { record: TestRecord | null; problem: string; note: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const rows = resultsFor(record).screen;
  return (
    <div className="key-results">
      {note ? <p className="hint">{note}</p> : null}
      {rows.length ? (
        <dl className="kr-list">
          {rows.map((r) => (
            <div key={r.id} className="kr-row">
              <dt>{r.label}</dt>
              <dd className="kr-value">{r.value}{r.unit ? <span className="kr-unit"> {r.unit}</span> : null}</dd>
              <dd className="kr-info">
                <button type="button" className="info-button" aria-label={'About ' + r.label.toLowerCase()} aria-expanded={!!open[r.id]} aria-controls={'about-' + r.id}
                  onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}><span aria-hidden="true">i</span></button>
              </dd>
              <dd className="kr-about" id={'about-' + r.id} hidden={!open[r.id]}>{r.about}</dd>
            </div>
          ))}
        </dl>) : <p>{problem || 'Too few points for key results.'}</p>}
    </div>
  );
}
