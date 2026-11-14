/* Records to fill in: the rows match the docs word for word, the CSV is safe in Excel, and the Help screen shows it. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { SHEETS, emptyEntries, filled, plain, recordCsv } from '../src/bench-record';
import { HelpPage } from '../src/pages/HelpPage';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
/* The rows of the first markdown table after a heading: [first cell, second cell]. */
function tableAfter(file: string, heading: string, skipTables = 0): string[][] {
  const text = readFileSync(path.join(ROOT, file), 'utf8');
  const lines = text.slice(text.indexOf(heading)).split('\n');
  const tables: string[][][] = [];
  let cur: string[][] | null = null;
  for (const l of lines) {
    if (l.startsWith('|')) { if (!cur) { cur = []; tables.push(cur); } if (!/^\|[-| ]+\|$/.test(l)) cur.push(l.split('|').slice(1, -1).map((c) => c.trim())); }
    else if (cur) { cur = null; if (tables.length > skipTables) break; }
  }
  return (tables[skipTables] ?? []).slice(1);
}
const sheet = (id: string) => SHEETS.find((s) => s.id === id)!;

describe('records to fill in', () => {
  it('the bench record has the same rows as docs/app/SETUP.md', () => {
    const top = tableAfter('docs/app/SETUP.md', '## First connection: bench record', 0).map((r) => r[0]);
    const checks = tableAfter('docs/app/SETUP.md', '## First connection: bench record', 1).map((r) => r[1]);
    expect(sheet('bench').header).toEqual(top);
    expect(sheet('bench').checks).toEqual(checks);
  });
  it('the Windows checklist has the same checks as docs/app/WINDOWS-APP.md', () => {
    const checks = tableAfter('docs/app/WINDOWS-APP.md', '## First install checklist', 0).map((r) => r[1]);
    expect(sheet('windows').checks).toEqual(checks);
  });
  it('downloads as CSV with every row, in plain words, safe from formulas', () => {
    const s = sheet('bench');
    const e = emptyEntries(s);
    e.header[0] = '2026-11-14, A. Person';
    e.checks[4] = '=1.234 V shown, 1.236 V meter';
    const csv = recordCsv(s, e, 'Version 1.0.0-beta.1', new Date('2026-11-14T12:00:00Z'));
    expect(csv).toContain('"First connection: bench record"');
    expect(csv).toContain('"Date, person","2026-11-14, A. Person"');
    expect(csv).toContain('"\'=1.234 V shown, 1.236 V meter"');
    expect(csv).not.toContain('**');
    expect(csv).not.toContain('`');
    expect(csv.split('\r\n').filter((l) => /^"\d+",/.test(l))).toHaveLength(s.checks.length);
    expect(filled(e)).toBe(1);
  });
  it('plain words drop the docs marks', () => {
    expect(plain('**not** done (`hello`)')).toBe('not done (hello)');
  });
  it('is on the Help screen, closed at first', () => {
    const html = renderToStaticMarkup(<HelpPage />);
    expect(html).toContain('Records to fill in');
    expect(html).toContain('Open the records');
  });
});
