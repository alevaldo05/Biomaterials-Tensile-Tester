/* Mean and sample standard deviation (n - 1), as on the comparison page (compare.js). */
export interface SampleStats {
  n: number;
  mean: number | null;
  sd: number | null;
}

export function sampleStats(values: number[]): SampleStats {
  const n = values.length;
  if (!n) return { n: 0, mean: null, sd: null };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  let sd: number | null = null;
  if (n > 1) {
    sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (n - 1));
    /* Identical values can leave rounding noise (for example 8.9e-14) instead of exactly 0; treat spread below one trillionth of the data's size as 0. */
    const size = Math.max(...values.map((v) => Math.abs(v)));
    if (sd <= 1e-12 * size) sd = 0;
  }
  return { n, mean, sd };
}
