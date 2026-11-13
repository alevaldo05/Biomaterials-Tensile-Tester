/* Small shared pieces of the screen. They show what they are given and hold no test logic. */
import type { ReactNode } from 'react';

export type Tone = 'idle' | 'busy' | 'warn' | 'ok' | 'live' | 'bad';

export function StatusBar(p: { tone: Tone; state: string; detail: string; children?: ReactNode }) {
  return (
    <div className={'status status-' + p.tone} role="status">
      <span className="status-dot" aria-hidden="true" />
      <strong className="status-state">{p.state}</strong>
      <span className="status-detail">{p.detail}</span>
      <span className="status-actions">{p.children}</span>
    </div>
  );
}

export interface Reading { label: string; value: string | null; unit?: string; note?: string }
/** A missing value is shown as a dash. It is never shown as zero. */
export function MeasurementStrip(p: { readings: Reading[] }) {
  return (
    <dl className="strip">
      {p.readings.map((r) => (
        <div className="strip-cell" key={r.label}>
          <dt>{r.label}</dt>
          <dd>
            <span className="strip-value">{r.value === null || r.value === '' ? '—' : r.value}</span>
            {r.value !== null && r.value !== '' && r.unit ? <span className="strip-unit"> {r.unit}</span> : null}
            {r.note ? <span className="strip-note">{r.note}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Panel(p: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="panel" open={p.open}>
      <summary>{p.title}</summary>
      <div className="panel-body">{p.children}</div>
    </details>
  );
}

export function Field(p: { label: string; unit?: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className={'field' + (p.error ? ' field-bad' : '')}>
      <span className="field-label">{p.label}{p.unit ? <span className="field-unit"> ({p.unit})</span> : null}{p.required ? <span className="req"><span aria-hidden="true"> *</span><span className="sr-only"> (required)</span></span> : null}</span>
      {p.children}
      {p.error ? <span className="field-error">{p.error}</span> : p.hint ? <span className="field-hint">{p.hint}</span> : null}
    </label>
  );
}
