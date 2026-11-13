import { describe, expect, it } from 'vitest';
import { analyzeUniaxial, buildTestCsv, recordFromCsv } from '@tensile/core';
import { TestController } from '../src/controller';
import { EXAMPLE_DIMENSIONS } from '../src/setup';
import { resultsFor } from '../src/results';

function ready(c: TestController) {
  c.setup = { ...c.setup, material: 'Test', ...EXAMPLE_DIMENSIONS, speed: '30' };
}

describe('session controller', () => {
  it('runs a simulated uniaxial test from connect to key results', async () => {
    const c = new TestController({ edition: 'lab', autoRun: false });
    expect(c.state).toBe('disconnected');
    expect(c.startProblem).toBe('Enter the material.');
    ready(c);
    expect(c.startProblem).toBe('Connect a source first.');
    await c.connect();
    expect(c.state).toBe('ready');
    c.simulator!.step(64);
    expect(c.recorder!.latest.force!.unit).toBe('N');
    c.startRecording();
    expect(c.state).toBe('recording');
    expect(c.locked).toBe(true);
    c.simulator!.step(2400);
    expect(c.live!.x.length).toBeGreaterThan(1000);
    c.stopRecording();
    expect(c.phase).toBe('done');
    expect(c.record!.source).toBe('simulated');
    const a = analyzeUniaxial(c.record!)!;
    expect(a.uts.x).toBeCloseTo(0.33, 1);
    expect(resultsFor(c.record).rows.map((r) => r.id)).toEqual(['E', 'uts', 'fail', 'tough']);
    expect(c.rate).toBeCloseTo(64, 1);
    expect(c.dataLabel).toBe('Simulated data, not measured');
    /* nothing but acquisition requests went to the device */
    const sent = c.simulator!.written.map((b) => (JSON.parse(new TextDecoder().decode(b)) as { type: string }).type);
    expect(sent).toEqual(['identify', 'get_channels', 'get_settings', 'start_stream']);
  });

  it('writes a CSV the website format reader opens, marked simulated', async () => {
    const c = new TestController({ edition: 'lab', autoRun: false });
    ready(c);
    c.setup.offsetOn = true; c.setup.offsetPct = '1';
    await c.connect();
    c.startRecording();
    c.simulator!.step(2400);
    c.stopRecording();
    const csv = buildTestCsv(c.record!, { spec: { mat: 'Test', matLabel: 'Test', id: '', temp: '', env: '', notes: '' }, kind: { slug: 'uniaxial-tension', name: 'Uniaxial tension' }, isRelax: false, startedAt: c.startedAt, endReason: c.session!.endReason, checks: {} });
    expect(csv).toContain('# Source,simulated (not measured)');
    expect(csv).toContain('# Offset yield (% strain),1');
    const back = recordFromCsv('x.csv', csv, 'uniaxial', { defaults: () => ({ specimen: { L0_mm: 1, width_mm: 1, thickness_mm: 1 } }) });
    expect(back.simulated).toBe(true);
    expect(back.params.offsetPct).toBe(1);
    expect(back.x.length).toBe(c.record!.x.length);
  });

  it('saves a session file and replays it to the same record, still labeled simulated', async () => {
    const c = new TestController({ edition: 'lab', autoRun: false });
    ready(c);
    await c.connect();
    c.startRecording();
    c.simulator!.step(2400);
    c.stopRecording();
    const file = JSON.stringify(c.sessionFile());
    const r = new TestController({ edition: 'learning', autoRun: false });
    r.loadReplay(file);
    expect(r.setup.L0).toBe('25');
    await r.connect();
    expect(r.state).toBe('ready');
    r.startRecording();
    for (let i = 0; i < 100 && r.phase === 'recording'; i++) r.tick();
    expect(r.phase).toBe('done');
    expect(r.session!.endReason).toContain('end of the file');
    expect(r.record!.raw).toEqual(c.record!.raw);
    expect(r.record!.simulated).toBe(true);
    expect(r.dataLabel).toContain('simulated data, not measured');
    expect(() => r.loadReplay('time,force\n1,2')).toThrow('not a session file');
  });

  it('keeps a real device without calibration to voltages only', async () => {
    const { SimulatedDevice } = await import('@tensile/acquisition');
    const dev = new SimulatedDevice({ auto: false });
    const c = new TestController({ edition: 'lab', autoRun: false, openReal: () => dev });
    expect(c.choices).toEqual(['real', 'simulated', 'replay']);
    c.choice = 'real';
    ready(c);
    await c.connect();
    expect(c.state).toBe('connected-uncalibrated');
    dev.step(10);
    expect(c.recorder!.latest.force).toMatchObject({ value: null, unit: null });
    expect(c.startProblem).toContain('not calibrated');
    c.startRecording();
    expect(c.phase).toBe('setup');
    c.voltagesOnly = true;
    c.startRecording();
    dev.step(200);
    c.stopRecording();
    expect(c.record).toBeNull();
    expect(c.recordProblem).toContain('voltages only');
    expect(c.sessionFile()!.calibrations).toEqual([]);
    expect(c.dataLabel).toBe('Measured');
  });

  it('the learning edition offers no hardware connection', async () => {
    const c = new TestController({ edition: 'learning', autoRun: false });
    expect(c.choices).toEqual(['simulated', 'replay']);
    c.choice = 'real';
    await c.connect();
    expect(c.state).toBe('disconnected');
    expect(c.message).toContain('cannot connect to hardware');
  });

  it('ends the recording and keeps the data when the connection is lost', async () => {
    const c = new TestController({ edition: 'lab', autoRun: false });
    ready(c);
    await c.connect();
    c.startRecording();
    c.simulator!.step(600);
    c.simulator!.unplug();
    expect(c.phase).toBe('done');
    expect(c.state).toBe('disconnected');
    expect(c.session!.interrupted).toBe(true);
    expect(c.record!.x.length).toBeGreaterThan(200);
    expect(c.message).toContain('connection was lost');
  });
});

describe('app preview (the build published with the website)', () => {
  it('connects its pretend board by itself and offers no real connection', async () => {
    const c = new TestController({ edition: 'learning', autoRun: false });
    await c.startPreview();
    expect(c.choices).toEqual(['simulated', 'replay']);
    expect(c.source?.kind).toBe('simulated');
    expect(c.state).toBe('ready');
    expect(c.dataLabel).toBe('Simulated data, not measured');
    await c.startPreview();   /* a second call changes nothing */
    expect(c.simulator!.written.filter((b) => new TextDecoder().decode(b).includes('identify'))).toHaveLength(1);
  });
  it('does nothing in the lab edition', async () => {
    const c = new TestController({ edition: 'lab', autoRun: false });
    await c.startPreview();
    expect(c.source).toBeNull();
  });
});
