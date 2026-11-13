import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSiteData } from '../site-data';
import { TERM_FOR } from '../src/results';

describe('content shared with the website', () => {
  const data = loadSiteData(path.resolve(import.meta.dirname, '../../..'));
  it('reads the definitions and materials from the website data files', () => {
    expect(data.materials.length).toBeGreaterThan(20);
    expect(data.materials.find((m) => m.id === 'steel')?.name).toMatch(/steel/i);
    for (const t of Object.values(data.terms)) expect(t.def).not.toMatch(/<[a-z]/i);
  });
  it('has a definition for every key result the app shows', () => {
    for (const key of Object.values(TERM_FOR)) expect(data.terms[key]?.def, key).toBeTruthy();
  });
});
