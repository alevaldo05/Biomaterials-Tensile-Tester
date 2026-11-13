/* From a recorded session to the test record the calculations and exports use (force N, displacement mm, time s).
   Refused unless both channels were calibrated: an uncalibrated session is never given engineering units. */
import { recompute } from '@tensile/core';
import type { Specimen, TestParams, TestRecord, TestType } from '@tensile/core';
import type { ChannelColumns, Session } from './recorder';

export type RecordResult =
  | { ok: true; record: TestRecord; pairing: string; strainBasis: string }
  | { ok: false; reason: string };

export interface RecordOptions {
  test: TestType;
  specimen: Specimen;
  params?: Partial<TestParams>;
}

function column(session: Session, quantity: 'force' | 'displacement'): ChannelColumns | undefined {
  return Object.values(session.columns).find((c) => c.quantity === quantity);
}

export function sessionToTestRecord(session: Session, o: RecordOptions): RecordResult {
  const F = column(session, 'force'), D = column(session, 'displacement');
  if (!F || !D) return { ok: false, reason: 'The session has no ' + (!F ? 'force' : 'displacement') + ' samples, so stress and strain cannot be calculated.' };
  if (!session.calibrated || !session.calibrations.force || !session.calibrations.displacement || F.unit !== 'N' || D.unit !== 'mm') {
    return { ok: false, reason: 'The session was recorded without a compatible calibration. It holds voltages only; force, stress, and strain are not available.' };
  }
  if (!(o.specimen.L0_mm > 0 && o.specimen.width_mm > 0 && o.specimen.thickness_mm > 0)) return { ok: false, reason: 'Stress and strain need the gauge length, width, and thickness.' };
  /* The ADC converts one channel after another, so force and displacement are never sampled at the same instant.
     Each force sample is paired with the displacement at that same device time, interpolated between the displacement
     samples before and after it. Force samples outside the displacement samples' time span are left out of the record
     (they stay in the session). */
  const t: number[] = [], d: number[] = [], f: number[] = [];
  let j = 0;
  for (let i = 0; i < F.value.length; i++) {
    const ti = F.deviceTime_s[i] as number, fi = F.value[i] as number;
    if (!Number.isFinite(fi)) continue;
    while (j + 1 < D.deviceTime_s.length && (D.deviceTime_s[j + 1] as number) <= ti) j++;
    const t0 = D.deviceTime_s[j] as number, t1 = D.deviceTime_s[j + 1], d0 = D.value[j] as number, d1 = D.value[j + 1];
    if (ti < t0 || t1 === undefined || d1 === undefined || !Number.isFinite(d0) || !Number.isFinite(d1)) continue;
    const u = t1 > t0 ? (ti - t0) / (t1 - t0) : 0;
    t.push(ti); d.push(d0 + u * (d1 - d0)); f.push(fi - session.forceZero_N);
  }
  if (t.length < 2) return { ok: false, reason: 'Too few paired force and displacement samples were recorded.' };
  /* Time and displacement are measured from the first recorded pair, as on the website's test pages. */
  const tz = t[0] as number, dz = d[0] as number;
  const isRelax = o.test === 'relaxation';
  const record: TestRecord = {
    test: o.test,
    source: session.sourceKind === 'real' ? 'measured' : session.sourceKind === 'simulated' ? 'simulated' : 'loaded',
    ...(session.sourceKind === 'replayed' ? { fileName: 'replayed session', simulated: session.calibrations.force.origin === 'simulated' } : {}),
    params: { ...o.params, specimen: o.specimen },
    raw: { t: t.map((v) => v - tz), d: d.map((v) => v - dz), F: f },
    x: [], y: [], dimSource: 'typed',
  };
  recompute(record, isRelax);
  return {
    ok: true, record,
    pairing: 'Force and displacement are converted one after another; each force sample is paired with the displacement interpolated to the same device time.',
    strainBasis: 'Strain is crosshead-based (crosshead displacement divided by the gauge length), not measured on the specimen.',
  };
}
