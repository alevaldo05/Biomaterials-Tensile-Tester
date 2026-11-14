/* The tests finished in this run of the app, for the Specimens strip on the Test screen. Each row is made from the
   finished test itself (its setup and its key results); nothing is invented, and a missing value is a dash. */
import type { TestType } from '@tensile/core';
import type { TestController } from './controller';
import { resultsFor } from './results';

export interface RunTest { id: string; specimenId: string; material: string; test: TestType; status: 'Done' | 'Interrupted'; modulus: string; peak: string; saved: string }

export function savedText(c: TestController): string {
  return c.saved ? 'Downloaded or on the lab server' : c.localSave === 'saved' ? 'On this computer' : c.localSave === 'error' ? 'Save error' : 'Not saved yet';
}

/** The finished test the controller holds, as a row; null before a test has ended. */
export function runTestFrom(c: TestController): RunTest | null {
  if (c.phase !== 'done' || !c.startedAt) return null;
  const rows = resultsFor(c.record).screen;
  const cell = (id: string) => { const r = rows.find((x) => x.id === id); return r && r.value !== '—' ? (r.value + (r.unit ? ' ' + r.unit : '')) : '—'; };
  return {
    id: c.startedAt.toISOString(), specimenId: c.setup.specimenId, material: c.setup.material, test: c.test,
    status: c.session?.interrupted ? 'Interrupted' : 'Done',
    modulus: c.test === 'relaxation' ? '—' : cell('E'), peak: cell(c.test === 'relaxation' ? 's0' : 'uts'), saved: savedText(c),
  };
}

/** Adds the row, or replaces the earlier row of the same test (for example after it was downloaded). */
export function upsertRunTest(list: RunTest[], t: RunTest): RunTest[] {
  const i = list.findIndex((x) => x.id === t.id);
  if (i < 0) return [...list, t];
  const old = list[i] as RunTest;
  if ((Object.keys(t) as (keyof RunTest)[]).every((k) => old[k] === t[k])) return list;
  const next = list.slice(); next[i] = t;
  return next;
}
