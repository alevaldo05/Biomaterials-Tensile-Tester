/* The whole saved-test path without any device: a recording becomes a session file, the file is opened in Load test,
   exported as CSV and Excel, and summarised the way a report shows it. The recording comes from the test simulator
   (this test only), so it stands in for a real one; nothing here is data from a real tester. */
import { describe, expect, it } from 'vitest';
import { openTestFile, REJECT_SIMULATED } from '../src/load';
import { sessionDetails, testCsv, testXlsx, xlsxForRecord } from '../src/exports';
import { resultsFor } from '../src/results';
import { measuredSetup, move, ready, rig } from './helpers';

async function standIn() {
  const { dev, c } = rig();
  ready(c);
  await c.connect();
  c.useSetup(measuredSetup(c));
  await c.startRecording();
  move(dev, c);
  dev.step(2400);
  c.stopRecording();
  return { dev, c };
}

describe('replay rehearsal (test stand-in recording, no device)', () => {
  it('goes from a session file through Load test, exports, and report numbers', async () => {
    const { dev, c } = await standIn();
    const text = JSON.stringify(c.sessionFile());
    const before = dev.written.length;

    const loaded = await openTestFile('rehearsal.session.json', text);
    expect(loaded.kind).toBe('session');
    expect(loaded.record).not.toBeNull();
    expect(loaded.provenance).toContain('not independently verified');
    expect(loaded.original).toBe(text);

    const rec = loaded.record!;
    expect(rec.x.length).toBeGreaterThan(10);
    expect(rec.raw).toEqual(c.record!.raw);

    /* Excel for the loaded test is a zip file with the right name for each column */
    const xlsx = xlsxForRecord(rec, loaded.test, loaded.name, loaded.provenance);
    expect(xlsx.length).toBeGreaterThan(1000);
    expect(String.fromCharCode(xlsx[0]!, xlsx[1]!)).toBe('PK');
    expect(Buffer.from(xlsx).includes(Buffer.from('force_N'))).toBe(true);

    /* the test controller's own exports agree on the number of points */
    const csv = testCsv(c)!;
    expect(csv).not.toContain('simulated');
    const reopened = await openTestFile('rehearsal.csv', csv);
    expect(reopened.record!.x.length).toBe(rec.x.length);
    expect(testXlsx(c)!.length).toBeGreaterThan(1000);

    /* the numbers a printed report shows come from these two */
    const res = resultsFor(rec);
    expect(res.rows.length).toBeGreaterThan(0);
    expect(sessionDetails(c).length).toBeGreaterThan(0);

    /* replaying sends nothing to any device */
    expect(dev.written.length).toBe(before);
  });

  it('refuses the same file once it is marked simulated, as a file and as a CSV', async () => {
    const { c } = await standIn();
    const sim = { ...c.sessionFile()!, recordedFrom: 'simulated' };
    await expect(openTestFile('s.session.json', JSON.stringify(sim))).rejects.toThrow(REJECT_SIMULATED);
    const csv = '# Source,simulated (not measured)\n' + testCsv(c)!;
    await expect(openTestFile('s.csv', csv)).rejects.toThrow(REJECT_SIMULATED);
  });
});
