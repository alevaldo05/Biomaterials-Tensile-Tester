/* For a signed-in student who has not done the training yet, before their first test: the training items, ticked,
   and approved by any operator or the admin with their own password. The main process checks it again (people.cjs),
   saves it once, and writes who approved it into every test file. */
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Field } from '@tensile/ui';
import type { Me, People, ResponsibleChoice } from '../people';

const msgOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function TrainingCheck(p: { people: People; me: Me; locked: boolean; onChange: (me: Me) => void }): JSX.Element {
  const [items, setItems] = useState<string[] | null>(null), [ticked, setTicked] = useState<boolean[]>([]);
  const [choices, setChoices] = useState<ResponsibleChoice[] | null>(null);
  const [pick, setPick] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    p.people.trainingItems().then((i) => { if (live) { setItems(i); setTicked(i.map(() => false)); } }, (e: unknown) => { if (live) setErr(msgOf(e)); });
    p.people.responsibleChoices().then((c) => { if (live) { setChoices(c); setPick((c.find((x) => x.gaveAccess) ?? c[0])?.id ?? ''); } }, (e: unknown) => { if (live) { setChoices([]); setErr(msgOf(e)); } });
    return () => { live = false; };
  }, [p.people, p.me.username]);
  const ready = !!items && ticked.length === items.length && ticked.every(Boolean) && !!pick && !!pw;
  const approve = () => {
    setBusy(true); setErr('');
    p.people.completeTraining(ticked, pick, pw).then((me) => { setPw(''); p.onChange(me); }, (e: unknown) => setErr(msgOf(e))).finally(() => setBusy(false));
  };
  return (
    <form className="training-check" onSubmit={(e) => { e.preventDefault(); if (ready) approve(); }}>
      <fieldset className="checks-box">
        <legend>Training</legend>
        {items?.map((t, i) => (
          <label key={t} className="check"><input type="checkbox" checked={!!ticked[i]} disabled={p.locked || busy} onChange={(e) => setTicked(ticked.map((v, j) => (j === i ? e.target.checked : v)))} /> {t}</label>
        ))}
      </fieldset>
      <Field label="Operator" required>
        <select value={pick} disabled={p.locked || busy || !choices?.length} onChange={(e) => { setPick(e.target.value); setPw(''); setErr(''); }}>
          {choices === null ? <option value="">Loading…</option> : null}
          {choices?.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.kindName.toLowerCase()})</option>)}
        </select>
      </Field>
      <Field label="Operator password">
        <input type="password" autoComplete="off" value={pw} disabled={p.locked || busy} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <p className="row"><button type="submit" className="primary" disabled={p.locked || busy || !ready}>Approve</button></p>
      {err ? <p className="error" role="alert">{err}</p> : null}
    </form>
  );
}
