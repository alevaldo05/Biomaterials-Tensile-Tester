/* Key results: rows of text for the files (CSV, Excel, report), and plain rows for the Test screen (a name, a value and
   its unit, and an "about" text with the definition and its caveats; no equations). The numbers come from @tensile/core. */
import { analyzeRelaxation, analyzeUniaxial, sig } from '@tensile/core';
import type { TestRecord } from '@tensile/core';
import type { Marker, Pt } from '@tensile/ui';

export interface ResultRow { id: string; name: string; value: string; note: string }
/** A key result as the Test screen shows it: plain words, no symbols or equations. */
export interface ScreenRow { id: string; label: string; value: string; unit: string; about: string }
/** The website's definition (data/terms.js) for each key result. */
export const TERM_FOR: Record<string, string> = { E: 'modulus', yield: 'yield', uts: 'uts', fail: 'failstrain', tough: 'energy', s0: 's0', hs: 'holdstart', send: 'sfinal', relaxed: 'relaxed', E0: 'apparent', tau: 'tau' };
const mpaParts = (v: number | null | undefined): { value: string; unit: string } => (v === null || v === undefined || !Number.isFinite(v) ? { value: '—', unit: '' } : Math.abs(v) >= 1000 ? { value: sig(v / 1000, 4), unit: 'GPa' } : { value: sig(v, 4), unit: 'MPa' });
const stressRow = (id: string, label: string, v: number | null | undefined, about: string): ScreenRow => ({ id, label, ...mpaParts(v), about });
const mpa = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : Math.abs(v) >= 1000 ? sig(v / 1000, 4) + ' GPa' : sig(v, 4) + ' MPa');

export interface Results { rows: ResultRow[]; screen: ScreenRow[]; markers: Marker[]; fitLine: { from: Pt; to: Pt } | null }
export const NO_RESULTS: Results = { rows: [], screen: [], markers: [], fitLine: null };
const CROSSHEAD = ' Strain is from the crosshead movement divided by the gauge length, not measured on the specimen.';

export function resultsFor(rec: TestRecord | null): Results {
  const none: Results = NO_RESULTS;
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
    const screen: ScreenRow[] = [
      stressRow('s0', 'Ramp-peak stress', a.s0.y, 'The highest stress in the record, at ' + sig(a.s0.x) + ' s.'),
      a.hs ? stressRow('hs', 'Hold-start stress', a.hs.y, 'The stress at the first reading where the displacement reaches 98% of the hold displacement, at ' + sig(a.hs.x) + ' s.')
        : { id: 'hs', label: 'Hold-start stress', value: 'Not available', unit: '', about: 'Not available because ' + ('why' in a.holdStart ? a.holdStart.why : 'the hold start was not found') + '.' },
      stressRow('send', 'Final recorded stress', a.send.y, 'The last recorded point of the hold. It is not automatically an equilibrium value.'),
      { id: 'relaxed', label: 'Relaxed', value: sig(a.relaxed, 4), unit: '%', about: 'How much of the ramp-peak stress was lost by the end of the record.' },
      stressRow('E0', 'Apparent stress/strain ratio after ramp', a.E0, 'The ramp-peak stress divided by the hold strain (' + sig(a.e0, 4) + (a.e0Measured ? ', measured' : '') + '). It is not necessarily the relaxation modulus.' + CROSSHEAD),
      { id: 'tau', label: 'Decay time to 1/e (endpoint-referenced)', value: a.tau === null ? '—' : sig(a.tau, 4), unit: a.tau === null ? '' : 's', about: 'The time, from the ramp peak, for the decaying part of the stress to fall to about 37% of its starting size. It depends on how long the recording ran.' },
    ];
    return { rows, screen, markers, fitLine: null };
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
  const screen: ScreenRow[] = [
    stressRow('E', 'Modulus estimate', a.E, a.fit ? 'An automatic estimate: the steepest straight part of the loading curve, fitted from strain ' + sig(rec.x[a.fit.i0], 3) + ' to ' + sig(rec.x[a.fit.i1], 3) + ' (' + a.fit.w + ' points; the dashed line on the graph). It is not automatically a validated Young’s modulus; review the fitted interval.' : 'No fitting window was found up to the peak, so there is no estimate.'),
  ];
  if (off !== undefined && off > 0) {
    screen.push(a.offsetYield ? stressRow('yield', 'Offset yield (estimate)', a.offsetYield.y, 'Where the curve crosses the fitted line moved right by ' + sig(off, 4) + '% strain, starting from the fitted line’s own intercept (toe-compensated), at strain ' + sig(a.offsetYield.x, 4) + '. A method-dependent estimate; soft tissue has no standard yield point.')
      : { id: 'yield', label: 'Offset yield (estimate)', value: 'Not found', unit: '', about: 'The curve never crosses the fitted line moved right by ' + sig(off, 4) + '% strain. Soft tissue has no standard yield point.' });
  }
  screen.push(
    stressRow('uts', 'Ultimate tensile strength', a.uts.y, 'The highest stress in the record.'),
    { id: 'utsStrain', label: 'Strain at ultimate strength', value: sig(a.uts.x, 4), unit: 'mm/mm', about: 'The strain where the highest stress was reached.' + CROSSHEAD },
    a.fail ? { id: 'fail', label: 'Strain at failure (estimate)', value: sig(a.fail.x, 4), unit: 'mm/mm', about: 'The last point before the stress falls below half of the ultimate tensile strength (force-drop rule). An estimate, not a confirmed rupture.' + CROSSHEAD }
      : { id: 'fail', label: 'Strain at failure (estimate)', value: 'Not detected', unit: '', about: 'The stress never fell below half of the ultimate tensile strength in this record, so no failure was detected.' },
    { id: 'tough', label: a.detected ? 'Energy to failure' : 'Energy to recorded end', value: sig(a.tough, 4), unit: 'MJ/m³', about: 'Energy absorbed per unit volume: the area under the stress–strain curve up to ' + (a.detected ? 'the estimated failure strain.' : 'the last recorded point, because no failure was detected.') },
  );
  const fitLine = a.fit ? { from: { x: rec.x[a.fit.i0] as number, y: a.fit.slope * (rec.x[a.fit.i0] as number) + a.fit.b }, to: { x: rec.x[a.fit.i1] as number, y: a.fit.slope * (rec.x[a.fit.i1] as number) + a.fit.b } } : null;
  return { rows, screen, markers, fitLine };
}
