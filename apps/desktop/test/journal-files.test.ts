/* Recordings kept as files by the Windows app (journal-files.cjs): the files themselves, the checks on what the
   screens send, recovery after a crash, and a whole recording through the app's controller. */
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { SessionJournal } from '../../tester/src/storage/journal';
import { DesktopJournal } from '../../tester/src/storage/desktop-journal';
import { sessionFileFromJournal } from '../../tester/src/controller';
import { openTestFile } from '../../tester/src/load';
import { EMPTY_SETUP } from '../../tester/src/setup';
import { measuredSetup, move, ready, rig } from '../../tester/test/helpers';
import { TestController } from '../../tester/src/controller';

const { createJournalFiles } = createRequire(import.meta.url)('../journal-files.cjs') as { createJournalFiles: (dir: string) => SessionJournal & { dir: string } };
const dirs: string[] = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-journal-')); dirs.push(d); return path.join(d, 'recordings'); };
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });
const meta = (id = 's-abc123-x1y2') => ({ id, test: 'uniaxial' as const, setup: { ...EMPTY_SETUP, material: 'Skin' }, profile: null, calibrations: [], appVersion: '0.2.0', deviceId: 'dev-1', startedAt: '2026-11-13T10:00:00.000Z' });
const batch = (n: number, from = 0) => ({ lines: Array.from({ length: n }, (_, i) => JSON.stringify({ v: 1, type: 'sample', seq: from + i })), receivedAt_ms: Array.from({ length: n }, (_, i) => 1000 + from + i) });

describe('recording files', () => {
  it('begins, appends, finishes, lists, reads back, and removes', async () => {
    const j = createJournalFiles(tmp());
    await j.begin(meta(), { lines: ['{"v":1,"type":"hello"}'], receivedAt_ms: [999] });
    await j.append('s-abc123-x1y2', batch(3));
    await j.append('s-abc123-x1y2', batch(2, 3));
    let [m] = await j.list();
    expect(m).toMatchObject({ id: 's-abc123-x1y2', status: 'recording', sampleCount: 5, endedAt: null });
    await j.finish('s-abc123-x1y2', 'complete', 'Stopped by the user.');
    [m] = await j.list();
    expect(m).toMatchObject({ status: 'complete', endReason: 'Stopped by the user.' });
    const l = await j.lines('s-abc123-x1y2');
    expect(l.lines).toHaveLength(6);
    expect(l.receivedAt_ms).toEqual([999, 1000, 1001, 1002, 1003, 1004]);
    expect(JSON.parse(l.lines[5] as string).seq).toBe(4);
    expect((await j.estimate())!.usage).toBeGreaterThan(0);
    await expect(j.append('s-abc123-x1y2', batch(1))).rejects.toThrow('has ended');
    await j.remove('s-abc123-x1y2');
    expect(await j.list()).toEqual([]);
    expect(fs.readdirSync(j.dir)).toEqual([]);
  });

  it('keeps batches in order when appends overlap', async () => {
    const j = createJournalFiles(tmp());
    await j.begin(meta(), { lines: [], receivedAt_ms: [] });
    await Promise.all(Array.from({ length: 20 }, (_, k) => j.append('s-abc123-x1y2', batch(5, k * 5))));
    const seqs = (await j.lines('s-abc123-x1y2')).lines.map((l) => JSON.parse(l).seq);
    expect(seqs).toEqual(Array.from({ length: 100 }, (_, i) => i));
    expect((await j.list())[0]!.sampleCount).toBe(100);
  });

  it('after a crash mid-write, reads every complete line and skips the cut-off one', async () => {
    const j = createJournalFiles(tmp());
    await j.begin(meta(), { lines: [], receivedAt_ms: [] });
    await j.append('s-abc123-x1y2', batch(4));
    fs.appendFileSync(path.join(j.dir, 's-abc123-x1y2.lines.ndjson'), '[1005,"{\\"v\\":1,\\"type\\":\\"sam');   /* power lost here */
    fs.writeFileSync(path.join(j.dir, 's-abc123-x1y2.meta.json.tmp'), '{"half');                            /* and here */
    const j2 = createJournalFiles(j.dir);   /* the app starts again */
    const [m] = await j2.list();
    expect(m!.status).toBe('recording');   /* offered for recovery */
    expect((await j2.lines('s-abc123-x1y2')).lines).toHaveLength(4);
    await j2.remove('s-abc123-x1y2');
    expect(fs.readdirSync(j.dir)).toEqual([]);
  });

  it('refuses anything the screens send that is not a recording', async () => {
    const j = createJournalFiles(tmp());
    for (const id of ['../escape', '..\\\\escape', 's-abc/../../x', 'S-ABC-1', '', 'x'.repeat(80)]) {
      await expect(j.begin(meta(id), { lines: [], receivedAt_ms: [] }), id).rejects.toThrow('Not a recording id');
      await expect(j.lines(id), id).rejects.toThrow('Not a recording id');
      await expect(j.remove(id), id).rejects.toThrow('Not a recording id');
    }
    await j.begin(meta(), { lines: [], receivedAt_ms: [] });
    await expect(j.begin(meta(), { lines: [], receivedAt_ms: [] })).rejects.toThrow('exists');
    await expect(j.append('s-abc123-x1y2', { lines: ['a'], receivedAt_ms: [] })).rejects.toThrow('one arrival time');
    await expect(j.append('s-abc123-x1y2', { lines: ['a\nb'], receivedAt_ms: [1] })).rejects.toThrow('single device line');
    await expect(j.append('s-abc123-x1y2', { lines: ['x'.repeat(5000)], receivedAt_ms: [1] })).rejects.toThrow('single device line');
    await expect(j.append('s-abc123-x1y2', { lines: ['a'], receivedAt_ms: [Number.NaN] })).rejects.toThrow('not a number');
    await expect(j.finish('s-abc123-x1y2', 'recording' as never, '')).rejects.toThrow('Unknown status');
    await expect(j.begin({ ...meta('s-abc123-zz'), test: 'fatigue' as never }, { lines: [], receivedAt_ms: [] })).rejects.toThrow('Unknown test type');
    await expect(j.begin({ ...meta('s-abc123-zz'), setup: { material: { a: 1 } } as never }, { lines: [], receivedAt_ms: [] })).rejects.toThrow('not text');
    await expect(j.lines('s-nothere-1')).rejects.toThrow('No such recording');
    expect(fs.readdirSync(path.dirname(j.dir)).sort()).toEqual(['recordings']);   /* nothing written outside the folder */
  });
});

describe('a whole recording through the app onto files', () => {
  it('records, recovers after the app closes, and opens the result in Load test', async () => {
    const files = createJournalFiles(tmp());
    const journal = new DesktopJournal(files);
    const { dev } = rig();   /* only its stand-in device; the controller below uses the Windows app's journal */
    /* the same controller as the screens use, with the Windows app's journal */
    const c2 = new TestController({ openReal: () => dev, journal, commitEvery_ms: 0 });
    ready(c2);
    await c2.connect();
    c2.useSetup(measuredSetup(c2));
    await c2.startRecording();
    move(dev, c2);
    dev.step(1200);
    await c2.flushed();
    /* the app closes here, without stopping */
    const [m] = await createJournalFiles(files.dir).list();
    expect(m!.status).toBe('recording');
    const f = await sessionFileFromJournal(new DesktopJournal(createJournalFiles(files.dir)), m!.id);
    expect(f.lines.filter((l) => l.includes('"type":"sample"')).length).toBeGreaterThan(1000);
    const loaded = await openTestFile('recovered.session.json', JSON.stringify(f));
    expect(loaded.record!.x.length).toBeGreaterThan(400);
  });
});
