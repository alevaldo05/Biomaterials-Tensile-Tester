/* Number text shared by the exports. Display choices (stress unit, digits) belong to the interface, not here. */

/** A number written with n significant digits and no trailing zeros; a dash when there is no finite value. */
export function sig(v: unknown, n = 3): string {
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return '—';
  return String(parseFloat(Number(v).toPrecision(n || 3)));
}

export interface Ticks { ticks: number[]; step: number }

/** Round axis steps (1, 2, 5 × a power of ten) covering lo to hi in about n steps. */
export function niceTicks(lo: number, hi: number, n: number): Ticks {
  const raw = (hi - lo) / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-6; v += step) {
    ticks.push(parseFloat(v.toPrecision(12)));
  }
  return { ticks, step };
}

export function median(a: readonly number[]): number {
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)] as number;
}
export function maxOf(a: readonly number[]): number {
  let m = -Infinity;
  for (const v of a) if (v > m) m = v;
  return m;
}
