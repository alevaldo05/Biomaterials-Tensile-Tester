/* For a signed-in student, before Connect: the operator responsible for their tests. It starts on the person who gave
   them access (no password needed); choosing anyone else shows a box for that person's own password, with no other
   text. The main process checks it again (people.cjs) and writes the name into every test file. */
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Field } from '@tensile/ui';
import type { Me, People, ResponsibleChoice } from '../people';

export function ResponsibleOperator(p: { people: People; me: Me; locked: boolean; onChange: (me: Me) => void }): JSX.Element {
  const [choices, setChoices] = useState<ResponsibleChoice[] | null>(null);
  const [pick, setPick] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    p.people.responsibleChoices().then((c) => {
      if (!live) return;
      setChoices(c);
      const current = p.me.responsible ? c.find((x) => x.username === p.me.responsible!.username) : null;
      setPick((current ?? c.find((x) => x.gaveAccess) ?? c[0])?.id ?? '');
    }, (e: unknown) => { if (live) { setChoices([]); setErr(e instanceof Error ? e.message : String(e)); } });
    return () => { live = false; };
  }, [p.people, p.me.username]);

  const chosen = choices?.find((c) => c.id === pick) ?? null;
  const needsPassword = !!chosen && !chosen.gaveAccess;
  const confirmed = !!p.me.responsible && chosen?.username === p.me.responsible.username;
  const confirm = () => {
    if (!chosen) return;
    setBusy(true); setErr('');
    p.people.confirmResponsible(chosen.id, needsPassword ? pw : undefined).then((me) => { setPw(''); p.onChange(me); }, (e: unknown) => setErr(e instanceof Error ? e.message : String(e))).finally(() => setBusy(false));
  };

  return (
    <div className="responsible">
      <Field label="Responsible operator" required>
        <select value={pick} disabled={p.locked || busy || !choices?.length} onChange={(e) => { setPick(e.target.value); setPw(''); setErr(''); }}>
          {choices === null ? <option value="">Loading…</option> : null}
          {choices?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.kindName.toLowerCase()})</option>)}
        </select>
      </Field>
      {needsPassword && !confirmed ? (
        <Field label="Operator password">
          <input type="password" autoComplete="off" value={pw} disabled={p.locked || busy} onChange={(e) => setPw(e.target.value)} />
        </Field>
      ) : null}
      {confirmed ? <p className="hint conn-ok">Responsible operator: <strong>{p.me.responsible!.name}</strong></p>
        : <p className="row"><button type="button" className="primary" disabled={p.locked || busy || !chosen || (needsPassword && !pw)} onClick={confirm}>Confirm responsible operator</button></p>}
      {err ? <p className="error" role="alert">{err}</p> : null}
    </div>
  );
}
