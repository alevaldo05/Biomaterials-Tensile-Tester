import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markedNotRecorded, openTestFile, REJECT_SIMULATED } from '../src/load';
import { testCsv } from '../src/exports';
import { measuredSetup, move, ready, rig } from './helpers';

async function recorded() {
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

describe('Load test', () => {
  it('rebuilds a session file to the same record and sends nothing to any device', async () => {
    const { dev, c } = await recorded();
    const before = dev.written.length;
    const loaded = await openTestFile('t.session.json', JSON.stringify(c.sessionFile()));
    expect(loaded.kind).toBe('session');
    expect(loaded.record!.raw).toEqual(c.record!.raw);
    expect(loaded.setup!.L0).toBe('25');
    expect(loaded.provenance).toContain('not independently verified');
    expect(dev.written.length).toBe(before);
  });

  it('opens the CSV the app saves, with its dimensions', async () => {
    const { c } = await recorded();
    const csv = testCsv(c)!;
    expect(csv).not.toContain('simulated');
    const loaded = await openTestFile('t.csv', csv);
    expect(loaded.kind).toBe('csv');
    expect(loaded.record!.x.length).toBe(c.record!.x.length);
    expect(loaded.provenance).toContain('cannot be verified');
  });

  it('refuses files marked as simulated or sample data', async () => {
    const { c } = await recorded();
    const sim = { ...c.sessionFile()!, recordedFrom: 'simulated' };
    await expect(openTestFile('s.session.json', JSON.stringify(sim))).rejects.toThrow(REJECT_SIMULATED);
    await expect(openTestFile('p.csv', '# Source,simulated (not measured)\nTime (s),Force (N)\n0,0\n')).rejects.toThrow(REJECT_SIMULATED);
    await expect(openTestFile('q.csv', '# Source,sample data\nTime (s),Force (N)\n0,0\n')).rejects.toThrow(REJECT_SIMULATED);
  });

  it('refuses simulated or sample notes however the Source line is written', async () => {
    const body = 'Time (s),Force (N)\n0,0\n';
    for (const note of ['"# Source",simulated (not measured)', '# Source;Simulated data', '#Source\tsimulated', '# source , SIMULATED', '# Source,"Sample data, not measured"',
      '"# Source","simulated"', "'# Source,simulated", '# Source,Test run (simulated)', '# Source: simulated']) {
      await expect(openTestFile('n.csv', note + '\n' + body), note).rejects.toThrow(REJECT_SIMULATED);
    }
  });

  it('does not refuse a CSV whose Source note only mentions samples in passing', () => {
    expect(markedNotRecorded('# Source,Lab A, 3 samples of skin\nTime (s),Force (N)\n')).toBe(false);
    expect(markedNotRecorded('# Material,simulated skin\nTime (s),Force (N)\n')).toBe(false);
  });

  it('keeps the count of rows it could not read, for the Load test notice', async () => {
    const head = '# Gauge length L0 (mm),20\n# Width (mm),5\n# Thickness (mm),1\nDisplacement (mm),Force (N)\n';
    const rows = Array.from({ length: 20 }, (_, i) => (i / 10) + ',' + (i * 0.2)).join('\n');
    const loaded = await openTestFile('r.csv', head + rows + '\n3,oops\n0x1F,2\n');
    expect(loaded.record!.skippedRows).toBe(2);
  });

  it('refuses a CSV without dimensions, and text that is not a test file', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => i + ',' + i + ',' + (i / 10)).join('\n');
    await expect(openTestFile('x.csv', 'Time (s),Force (N),Displacement (mm)\n' + rows + '\n')).rejects.toThrow('no specimen dimensions');
    await expect(openTestFile('x.json', '{"a":1}')).rejects.toThrow('not a session file');
  });
});

describe('boundary', () => {
  it('nothing in the app source imports the simulator', () => {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');
    const files: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } };
    walk(root);
    expect(files.length).toBeGreaterThan(10);
    const bad = files.filter((f) => /SimulatedDevice|simulatedUniaxial|simulatedRelaxation|simulatedCalibrations|simulatedProfile|SIMULATED_SIGNAL/.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});
