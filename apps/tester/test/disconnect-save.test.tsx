/* Disconnect on the Device screen asks before losing a test that was not downloaded, like the Test screen does,
   and "Download and continue" offers the file before disconnecting. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadBeforeLeaving } from '../src/exports';
import { measuredSetup, move, ready, rig } from './helpers';

const src = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/pages/Device.tsx'), 'utf8');

/* A stand-in for the browser's download: records the file names offered. */
function downloads() {
  const names: string[] = [];
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined });
  vi.stubGlobal('document', { createElement: () => { const a = { download: '', click() { names.push(a.download); }, remove() {} }; return a; }, body: { appendChild: () => undefined } });
  return names;
}
afterEach(() => vi.unstubAllGlobals());

describe('Disconnect on the Device screen', () => {
  it('asks first when the data has not been saved, with the same three choices as the Test screen', () => {
    expect(src).toContain('const disconnect = () => (c.saved ? void c.disconnect() : setAsk(true));');
    expect(src).toContain('onClick={disconnect}>Disconnect</button>');
    /* The screen uses useSyncExternalStore, which React's server renderer cannot run, so the wording is read from the source. */
    expect(src).toContain('<h2 id="device-ask-title">Disconnect without saving?</h2>');
    expect(src).toContain("onClick={() => proceed('save')}>Download and continue</button>");
    expect(src).toContain("onClick={() => proceed('discard')}>Don’t save and continue</button>");
    expect(src).toContain('onClick={() => setAsk(false)}>Cancel</button>');
    expect(src).toContain("const proceed = (how: 'save' | 'discard') => { if (how === 'save') downloadBeforeLeaving(c); setAsk(false); void c.disconnect(); };");
  });
  it('Download and continue offers the CSV of a finished test and marks it saved', async () => {
    const { dev, c } = rig();
    ready(c);
    await c.connect();
    c.useSetup(measuredSetup(c));
    await c.startRecording();
    move(dev, c);
    dev.step(2400);
    c.stopRecording();
    expect(c.saved).toBe(false);
    const names = downloads();
    expect(downloadBeforeLeaving(c)).toBe(true);
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/\.(csv|session\.json)$/);
    expect(c.saved).toBe(true);
  });
  it('offers nothing when there is no test to save', () => {
    const { c } = rig();
    expect(c.sessionFile()).toBeNull();
    const names = downloads();
    expect(downloadBeforeLeaving(c)).toBe(false);
    expect(names).toHaveLength(0);
  });
});
