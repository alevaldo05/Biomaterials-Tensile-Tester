import { describe, expect, it } from 'vitest';
import { analyzeUniaxial } from '@tensile/core';
import { sessionFileFromJournal } from '../src/controller';
import { resultsFor } from '../src/results';
import { MemoryJournal } from '../src/storage/journal';
import { MemoryMethods, methodFromSetup } from '../src/storage/methods';
import { measuredSetup, move, ready, rig } from './helpers';

const sentTypes = (bytes: Uint8Array[]) => bytes.map((b) => (JSON.parse(new TextDecoder().decode(b)) as { type: string }).type);

describe('test controller (real acquisition only)', () => {
  it('records a calibrated uniaxial test and sends only acquisition requests', async () => {
    const { dev, c } = rig();
    expect(c.state).toBe('disconnected');
    expect(c.startProblem).toBe('Enter the material.');
    ready(c);
    expect(c.startProblem).toBe('Connect the acquisition device first.');
    await c.connect();
    expect(c.source!.kind).toBe('real');
    expect(c.state).toBe('connected-uncalibrated');
    c.useSetup(measuredSetup(c));
    expect(c.state).toBe('ready');
    dev.step(64);
    expect(c.recorder!.latest.force!.unit).toBe('N');
    await c.startRecording();
    expect(c.phase).toBe('recording');
    expect(c.locked).toBe(true);
    move(dev, c);
    dev.step(2400);
    expect(c.live!.x.length).toBeGreaterThan(1000);
    c.stopRecording();
    expect(c.phase).toBe('done');
    expect(c.record!.source).toBe('measured');
    expect(analyzeUniaxial(c.record!)!.uts.x).toBeCloseTo(0.33, 1);
    expect(resultsFor(c.record).rows.map((r) => r.id)).toEqual(['E', 'uts', 'fail', 'tough']);
    expect(c.dataLabel).toBe('Measured');
    expect(sentTypes(dev.written)).toEqual(['identify', 'get_channels', 'get_settings', 'start_stream']);
    expect(c.sessionFile()!.recordedFrom).toBe('real');
  });

  it('keeps an uncalibrated device to voltages only', async () => {
    const { dev, c } = rig();
    ready(c);
    await c.connect();
    dev.step(10);
    expect(c.recorder!.latest.force).toMatchObject({ value: null, unit: null });
    expect(c.startProblem).toContain('not calibrated');
    await c.startRecording();
    expect(c.phase).toBe('setup');
    c.voltagesOnly = true;
    await c.startRecording();
    dev.step(200);
    c.stopRecording();
    expect(c.record).toBeNull();
    expect(c.recordProblem).toContain('voltages only');
    expect(c.sessionFile()!.calibrations).toEqual([]);
  });

  it('ends the recording and keeps the data when the connection is lost', async () => {
    const { dev, c } = rig();
    ready(c);
    await c.connect();
    c.useSetup(measuredSetup(c));
    await c.startRecording();
    move(dev, c);
    dev.step(600);
    dev.unplug();
    expect(c.phase).toBe('done');
    expect(c.session!.interrupted).toBe(true);
    expect(c.record!.x.length).toBeGreaterThan(200);
    expect(c.message).toContain('connection was lost');
  });

  it('refuses a calibration change while recording, and a software baseline is labeled as such', async () => {
    const { dev, c } = rig();
    ready(c);
    await c.connect();
    const setup = measuredSetup(c);
    c.useSetup(setup);
    dev.step(20);
    c.zeroForce();
    expect(c.message).toContain('not a machine tare and not a calibration');
    await c.startRecording();
    expect(() => c.useSetup(setup)).toThrow('cannot be changed while recording');
  });
});

describe('recording on this computer', () => {
  it('commits batches while recording and finishes the entry', async () => {
    const journal = new MemoryJournal();
    const { dev, c } = rig({ journal });
    ready(c);
    await c.connect();
    c.useSetup(measuredSetup(c));
    await c.startRecording();
    move(dev, c);
    dev.step(300);
    await c.flushed();
    expect(c.localSave).toBe('saved');
    const mid = (await journal.list())[0]!;
    expect(mid.status).toBe('recording');
    const midLines = (await journal.lines(mid.id)).lines.length;
    dev.step(300);
    c.stopRecording();
    await c.flushed();
    await new Promise((r) => setTimeout(r, 0));
    const end = (await journal.list())[0]!;
    expect(end.status).toBe('complete');
    expect((await journal.lines(end.id)).lines.length).toBeGreaterThan(midLines);
    /* the journal holds the same lines as the session file */
    const fromJournal = await sessionFileFromJournal(journal, end.id);
    expect(fromJournal.lines).toEqual(c.sessionFile()!.lines);
    expect(fromJournal.recordedFrom).toBe('real');
  });

  it('a recording cut off by a closed app stays "recording" and can be rebuilt', async () => {
    const journal = new MemoryJournal();
    const { dev, c } = rig({ journal });
    ready(c);
    await c.connect();
    c.useSetup(measuredSetup(c));
    await c.startRecording();
    move(dev, c);
    dev.step(400);
    await c.flushed();
    /* the app closes here: no stop, no finish */
    const [m] = await journal.list();
    expect(m!.status).toBe('recording');
    const f = await sessionFileFromJournal(journal, m!.id);
    expect(f.lines.filter((l) => l.includes('"type":"sample"')).length).toBeGreaterThan(300);
    await journal.finish(m!.id, 'interrupted', 'closed');
    expect((await journal.list())[0]!.status).toBe('interrupted');
  });

  it('a failed write is reported, recording continues, and the next write catches up', async () => {
    const journal = new MemoryJournal();
    const { dev, c } = rig({ journal });
    ready(c);
    await c.connect();
    c.useSetup(measuredSetup(c));
    await c.startRecording();
    move(dev, c);
    dev.step(100);
    journal.failNext = true;
    await c.flushed();
    expect(c.localSave).toBe('error');
    expect(c.localError).toContain('continues in memory');
    expect(c.phase).toBe('recording');
    dev.step(100);
    await c.flushed();
    expect(c.localSave).toBe('saved');
    const [m] = await journal.list();
    const samples = (await journal.lines(m!.id)).lines.filter((l) => l.includes('"type":"sample"')).length;
    expect(samples).toBe(c.sessionFile()!.lines.filter((l) => l.includes('"type":"sample"')).length);
  });

  it('without storage the app says so and records in memory', async () => {
    const { c } = rig({ journal: null });
    expect(c.localSave).toBe('off');
  });
});

describe('test methods', () => {
  it('saves revisions and fills the setup from a method without the specimen ID', async () => {
    const store = new MemoryMethods();
    const { c } = rig();
    ready(c);
    c.setup.specimenId = 'S-1';
    const m1 = await store.save(methodFromSetup('Skin strip', 'uniaxial', c.setup, 'Clamp gently.'));
    expect(m1.revision).toBe(1);
    const m2 = await store.save({ ...methodFromSetup('Skin strip', 'uniaxial', { ...c.setup, speed: '10' }) }, m1);
    expect(m2.revision).toBe(2);
    expect((await store.list()).map((m) => m.revision)).toEqual([2]);
    c.newTest();
    c.useMethod(m2);
    expect(c.setup.speed).toBe('10');
    expect(c.setup.specimenId).toBe('');
  });
});
