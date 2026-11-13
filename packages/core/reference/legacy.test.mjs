import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildReference } from './cases.mjs';

const saved = JSON.parse(fs.readFileSync(new URL('./fixtures/reference.json', import.meta.url), 'utf8'));

describe('website calculation code (graph-core.js, live-csv.js, calibration.js, compare.js)', () => {
  const now = buildReference();
  for (const part of Object.keys(saved)) {
    it(`still gives the saved reference results: ${part}`, () => {
      expect(now[part]).toEqual(saved[part]);
    });
  }
  it('has no part missing from the saved file', () => {
    expect(Object.keys(now).sort()).toEqual(Object.keys(saved).sort());
  });
});
