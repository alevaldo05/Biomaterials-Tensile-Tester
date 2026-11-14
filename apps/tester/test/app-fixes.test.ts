/* Fixes from the handoff's known-problem list: header lines stay one line, samples that cannot be interpreted are
   counted, New test right after Stop keeps the last journal batch, the raw-samples CSV guards every text cell, and
   setup text stays within the Windows journal's limit. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryJournal } from '../src/storage/journal';
import { SETUP_TEXT_LIMIT } from '../src/controller';
import { oneLine, samplesCsv, sessionDetails, testCsv } from '../src/exports';
import { openTestFile } from '../src/load';
import { measuredSetup, move, ready, rig } from './helpers';

async function finishedTest(o: { journal?: MemoryJournal } = {}) {
  const { dev, c } = rig(o);
  ready(c);
  await c.connect();
  c.useSetup(measuredSetup(c));
  await c.startRecording();
  move(dev, c);
  dev.step(2400);
  return { dev, c };
}

describe('known problems, fixed', () => {
  it('a line break in the notes or the end reason does not split the CSV header', async () => {
    const { c } = await finishedTest();
    c.setup = { ...c.setup, notes: 'first line\nsecond line\r\nthird' };
    c.stopRecording();
    c.session!.endReason = 'Stopped\nby the operator';
    const csv = testCsv(c)!;
    expect(csv).toContain('first line second line third');
    expect(csv).not.toMatch(/\nsecond line/);
    const loaded = await openTestFile('t.csv', csv);
    expect(loaded).toBeTruthy();
    expect(oneLine('a\r\n\nb c ')).toBe('a b c');
  });
  /* An unknown channel is already refused (and reported) by the connection; an unknown settings reference reached the
     recorder and was dropped without a count. */
  it('samples with an unknown settings reference are counted, not silently lost', async () => {
    const { dev, c } = await finishedTest();
    const boot = (dev as unknown as { bootId: string }).bootId;
    dev.injectText(JSON.stringify({ v: 1, type: 'sample', boot_id: boot, seq: 999999, t: 1, ch: 'force', raw: 5, ref: 'no-such-settings' }) + '\n');
    dev.step(10);
    c.stopRecording();
    expect(c.session!.unknownSamples).toBeGreaterThanOrEqual(1);
    expect(sessionDetails(c).find(([k]) => k.startsWith('Samples not understood'))?.[1]).not.toBe('0');
  });
  it('New test right after Stop keeps every recorded line in the journal', async () => {
    const journal = new MemoryJournal();
    const { c } = await finishedTest({ journal });
    const id = c.journalId!;
    const recorded = (c as unknown as { recorded: unknown[] }).recorded.length;
    c.stopRecording();
    c.newTest();                       /* at once, before the last write has finished */
    await new Promise((r) => setTimeout(r, 20));
    const { lines } = await journal.lines(id);
    expect(lines.length).toBeGreaterThanOrEqual(recorded);
    expect(c.journalId).toBeNull();
  });
  it('the raw-samples CSV guards every text cell against formulas', async () => {
    const { c } = await finishedTest();
    c.stopRecording();
    /* Text that comes from the device (channel id, settings reference, quality flags) shaped like formulas. */
    const real = c.session!, col = Object.values(real.columns)[0]!;
    const evil = { ...col, channelId: '=HYPERLINK("x")', settingsRef: col.settingsRef.map(() => '+cmd'), quality: col.quality.map(() => ['@SUM(1)']) };
    const csv = samplesCsv(c, { ...real, columns: { evil } });
    expect(csv).toContain("'=HYPERLINK");
    for (const line of csv.split('\n').filter((l) => l && !l.startsWith('#'))) expect(line).not.toMatch(/(^|,)[=+@]/);
  });
  it('setup text stays within the Windows journal’s limit', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const journalFiles = readFileSync(path.join(here, '../../desktop/journal-files.cjs'), 'utf8');
    expect(journalFiles).toContain('text: ' + SETUP_TEXT_LIMIT + ',');
    const app = readFileSync(path.join(here, '../src/App.tsx'), 'utf8');
    expect(app).toContain('maxLength={SETUP_TEXT_LIMIT}');
  });
  it('the open-file limits are 256 MB', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    expect(readFileSync(path.join(here, '../src/pages/LoadTest.tsx'), 'utf8')).toContain('256 * 1024 * 1024');
    expect(readFileSync(path.join(here, '../src/pages/Compare.tsx'), 'utf8')).toContain('256 * 1024 * 1024');
    expect(readFileSync(path.join(here, '../src/Shell.tsx'), 'utf8')).toContain('(limit 256 MB)');
  });
});
