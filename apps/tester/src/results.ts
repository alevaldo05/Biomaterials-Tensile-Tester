/* Key results as rows of text for the screen and the Excel file. The numbers come from @tensile/core. */
import { analyzeRelaxation, analyzeUniaxial, sig } from '@tensile/core';
import type { TestRecord } from '@tensile/core';
import type { Marker, Pt } from '@tensile/ui';

export interface ResultRow { id: string; name: string; value: string; note: string }
/** The website's definition (data/terms.js) for each key result. */
export const TERM_FOR: Record<string, string> = { E: 'modulus', yield: 'yield', uts: 'uts', fail: 'failstrain', tough: 'energy', s0: 's0', hs: 'holdstart', send: 'sfinal', relaxed: 'relaxed', E0: 'apparent', tau: 'tau' };
const mpa = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : Math.abs(v) >= 1000 ? sig(v / 1000, 4) + ' GPa' : sig(v, 4) + ' MPa');

export interface Results { rows: ResultRow[]; markers: Marker[]; fitLine: { from: Pt; to: Pt } | null }

export function resultsFor(rec: TestRecord | null): Results {
  const none: Results = { rows: [], markers: [], fitLine: null };
  if (!rec || rec.x.length < 2) return none;
  if (rec.test === 'relaxation') {
    const a = analyzeRelaxation(rec);
    if (!a) return none;
    const rows: ResultRow[] = [
      { id: 's0', name: 'Ramp-peak stress, σ0', value: mpa(a.s0.y), note: 'Highest stress in the record (t = ' + sig(a.s0.x) + ' s).' },
      { id: 'hs', name: 'Hold-start stress', value: a.hs ? mpa(a.hs.y) : 'not available', note: a.hs ? 'First reading at 98% of the hold displacement (t = ' + sig(a.hs.x) + ' s).' : 'Not available because ' + ('why' in a.holdStart ? a.holdStart.why : '') + '.' },
      { id: 'send', name: 'Final recorded stress', value: mpa(a.send.y), note: 'Last recorded point; not automatically an equilibrium value.' },
      { id: 'relaxed', name: 'Relaxed', value: sig(a.relaxed, 4) + ' %', note: 'Relative to the ramp-peak stress, at the end of the record.' },
      { id: 'E0', name: 'Apparent stress/strain ratio after ramp', value: mpa(a.E0), note: 'Ramp-peak stress divided by the hold strain (' + sig(a.e0, 4) + (a.e0Measured ? ', measured' : '') + '); crosshead-based.' },
      { id: 'tau', name: 'Endpoint-referenced 1/e decay time, τ', value: a.tau === null ? '—' : sig(a.tau, 4) + ' s', note: 'Depends on the recording duration. Measured from the ramp peak.' },
    ];
    const markers: Marker[] = [{ id: 's0', label: 'Ramp-peak stress', ...a.s0 }, { id: 'send', label: 'Final recorded stress', ...a.send }];
    if (a.hs) markers.push({ id: 'hs', label: 'Hold start', ...a.hs });
    if (a.tauPoint) markers.push({ id: 'tau', label: '1/e decay time', x: a.tauPoint.x, y: a.tauPoint.y });
    return { rows, markers, fitLine: null };
  }
  const a = analyzeUniaxial(rec);
  if (!a) return none;
  const off = rec.params.offsetPct;
  const rows: ResultRow[] = [
    { id: 'E', name: 'Automatic modulus estimate, E', value: mpa(a.E), note: a.fit ? 'Largest fitted loading slope, over ε = ' + sig(rec.x[a.fit.i0], 3) + ' to ' + sig(rec.x[a.fit.i1], 3) + ' (' + a.fit.w + ' points). Not automatically a validated Young’s modulus; review the fitted interval.' : 'No fitting window was found up to the peak.' },
  ];
  if (off !== undefined && off > 0) rows.push({ id: 'yield', name: 'Offset yield, ' + sig(off, 4) + '% offset, toe-compensated (estimate)', value: a.offsetYield ? mpa(a.offsetYield.y) + ' at ε = ' + sig(a.offsetYield.x, 4) : 'not found (the curve never crosses the offset line)', note: 'A method-dependent estimate; soft tissue has no standard yield point.' });
  rows.push(
    { id: 'uts', name: 'Ultimate tensile strength, UTS', value: mpa(a.uts.y) + ' at ε = ' + sig(a.uts.x, 4), note: 'Highest stress in the record.' },
    { id: 'fail', name: 'Estimated failure strain — force-drop rule', value: a.fail ? sig(a.fail.x, 4) : 'not detected', note: a.fail ? 'Last point before stress falls below 50% of UTS; not a confirmed rupture.' : 'No force drop below 50% of UTS was found in this record.' },
    { id: 'tough', name: 'Energy density to recorded endpoint, U', value: sig(a.tough, 4) + ' MJ/m³', note: a.detected ? 'Area under the curve to the estimated failure strain.' : 'Area under the curve to the last recorded point.' },
  );
  const markers: Marker[] = [{ id: 'uts', label: 'UTS', ...a.uts }];
  if (a.fail) markers.push({ id: 'fail', label: 'Estimated failure', ...a.fail });
  if (a.offsetYield) markers.push({ id: 'yield', label: 'Offset yield', x: a.offsetYield.x, y: a.offsetYield.y });
  const fitLine = a.fit ? { from: { x: rec.x[a.fit.i0] as number, y: a.fit.slope * (rec.x[a.fit.i0] as number) + a.fit.b }, to: { x: rec.x[a.fit.i1] as number, y: a.fit.slope * (rec.x[a.fit.i1] as number) + a.fit.b } } : null;
  return { rows, markers, fitLine };
}
