import { describe, expect, it } from 'vitest';
import { DeviceSource, NdjsonAdapter, WebSerialTransport } from '../src/index';
import type { SerialLike } from '../src/index';

function named(name: string) { return Object.assign(new Error(name), { name }); }

/* A stand-in for the browser's serial port, so the transport's handling can be checked without hardware. */
function fakePort(o: { openError?: string } = {}) {
  let push: (r: { value?: Uint8Array; done: boolean }) => void = () => undefined;
  let fail: (e: unknown) => void = () => undefined;
  const queue: { value?: Uint8Array; done: boolean }[] = [];
  const written: Uint8Array[] = [];
  let readable: object | null = {
    getReader: () => ({
      read: () => new Promise<{ value?: Uint8Array; done: boolean }>((res, rej) => { const q = queue.shift(); if (q) res(q); else { push = res; fail = rej; } }),
      cancel: async () => { push({ done: true }); },
      releaseLock: () => undefined,
    }),
  };
  const port = {
    open: async () => { if (o.openError) throw named(o.openError); },
    close: async () => undefined,
    get readable() { return readable; },
    writable: { getWriter: () => ({ write: async (b: Uint8Array) => { written.push(b); }, releaseLock: () => undefined }) },
  };
  return { port, written, feed: (text: string) => { const r = { value: new TextEncoder().encode(text), done: false }; const p = push; push = (x) => { queue.push(x); }; p(r); },
    yank: () => { readable = null; fail(named('NetworkError')); } };
}
const serialWith = (port: object | Error): SerialLike => ({ requestPort: async () => { if (port instanceof Error) throw port; return port as never; } });

describe('USB serial transport (with a stand-in port; real hardware is untested)', () => {
  it.each([
    ['no Web Serial in the browser', undefined, 'unsupported-browser'],
    ['the chooser is closed without a choice', serialWith(named('NotFoundError')), 'no-port-selected'],
    ['the browser blocks access', serialWith(named('SecurityError')), 'permission-denied'],
    ['another program holds the port', serialWith(fakePort({ openError: 'NetworkError' }).port), 'port-in-use'],
    ['the port is already open in this tab', serialWith(fakePort({ openError: 'InvalidStateError' }).port), 'port-in-use'],
    ['the port cannot be opened', serialWith(fakePort({ openError: 'UnknownError' }).port), 'port-unavailable'],
  ] as const)('explains it when %s', async (_n, serial, code) => {
    const source = new DeviceSource({ transport: new WebSerialTransport({ serial }), adapter: new NdjsonAdapter(), kind: 'real' });
    await expect(source.connect()).rejects.toMatchObject({ code });
    expect(source.state).toBe('disconnected');
    expect(source.diagnostics.at(-1)?.code).toBe(code);
  });

  it('passes bytes both ways and reports a pulled cable', async () => {
    const f = fakePort(), t = new WebSerialTransport({ serial: serialWith(f.port) });
    const got: string[] = [], closed: { unexpected: boolean }[] = [];
    t.onData((c) => got.push(new TextDecoder().decode(c)));
    t.onClose((i) => closed.push(i));
    await t.open();
    await t.write(new TextEncoder().encode('a\n'));
    await t.write(new TextEncoder().encode('b\n'));
    expect(f.written.map((b) => new TextDecoder().decode(b))).toEqual(['a\n', 'b\n']);
    f.feed('{"v":1,');
    await new Promise((r) => setTimeout(r, 0));
    expect(got).toEqual(['{"v":1,']);
    f.yank();
    await new Promise((r) => setTimeout(r, 0));
    expect(closed).toEqual([expect.objectContaining({ unexpected: true })]);
    await expect(t.write(new Uint8Array([1]))).rejects.toMatchObject({ code: 'disconnected' });
  });

  it('closes on request without calling it a lost connection', async () => {
    const f = fakePort(), t = new WebSerialTransport({ serial: serialWith(f.port) });
    const closed: { unexpected: boolean }[] = [];
    t.onClose((i) => closed.push(i));
    await t.open();
    await t.close();
    expect(closed).toEqual([expect.objectContaining({ unexpected: false })]);
  });
});
