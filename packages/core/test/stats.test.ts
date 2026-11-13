import { describe, expect, it } from 'vitest';
import { STATS_CASES } from '../reference/cases.mjs';
import saved from '../reference/fixtures/reference.json';
import { sampleStats } from '../src/stats';


describe('sampleStats', () => {
  STATS_CASES.forEach((values, i) => {
    it(`matches the saved result for case ${i} (${JSON.stringify(values)})`, () => {
      expect(JSON.parse(JSON.stringify(sampleStats(values)))).toEqual((saved.stats as unknown[])[i]);
    });
  });
  it('has one saved result per case', () => {
    expect(saved.stats).toHaveLength(STATS_CASES.length);
  });
});
