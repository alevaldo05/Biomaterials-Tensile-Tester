/* USB serial through the browser's Web Serial feature (Chrome on a computer). The person always picks the port
   in the browser's own box; this never opens a port by itself. It only moves bytes.
   Untested with real hardware so far. */
import { TransportError } from '../types';
import type { Transport } from '../types';

/* The few parts of Web Serial used here (the project's TypeScript setting has no browser types). */
interface SerialPortLike {
  open(options: { baudRate: number; bufferSize?: number }): Promise<void>;
  close(): Promise<void>;
  readonly readable: { getReader(): { read(): Promise<{ value?: Uint8Array; done: boolean }>; cancel(): Promise<void>; releaseLock(): void } } | null;
  readonly writable: { getWriter(): { write(data: Uint8Array): Promise<void>; releaseLock(): void } } | null;
}
export interface SerialLike { requestPort(options?: object): Promise<SerialPortLike> }

export interface WebSerialOptions {
  baudRate?: number;
  /** The browser's navigator.serial. Passed in so this file does not reach for browser globals itself. */
  serial: SerialLike | undefined;
}

function nameOf(e: unknown): string { return e && typeof e === 'object' && 'name' in e ? String((e as { name: unknown }).name) : ''; }

export class WebSerialTransport implements Transport {
  readonly label = 'USB serial';
  private port: SerialPortLike | null = null;
  private reader: ReturnType<NonNullable<SerialPortLike['readable']>['getReader']> | null = null;
  private closing = false;
  private loop: Promise<void> | null = null;
  private queue: Promise<void> = Promise.resolve();
  private dataListener: (chunk: Uint8Array) => void = () => undefined;
  private closeListener: (info: { unexpected: boolean; reason: string }) => void = () => undefined;

  constructor(private readonly o: WebSerialOptions) {}

  onData(l: (chunk: Uint8Array) => void): void { this.dataListener = l; }
  onClose(l: (info: { unexpected: boolean; reason: string }) => void): void { this.closeListener = l; }

  /** Must be called from a click, because the browser shows its port chooser. */
  async open(): Promise<void> {
    if (!this.o.serial) throw new TransportError('unsupported-browser', 'Web Serial is not available in this browser.');
    let port: SerialPortLike;
    try { port = await this.o.serial.requestPort(); }
    catch (e) {
      const n = nameOf(e);
      throw new TransportError(n === 'NotFoundError' ? 'no-port-selected' : n === 'SecurityError' || n === 'NotAllowedError' ? 'permission-denied' : 'port-unavailable', String(e));
    }
    try { await port.open({ baudRate: this.o.baudRate ?? 115200 }); }
    catch (e) {
      const n = nameOf(e);
      /* Chrome reports a port held by another program as NetworkError, and one already open in this tab as InvalidStateError. */
      throw new TransportError(n === 'NetworkError' || n === 'InvalidStateError' ? 'port-in-use' : n === 'SecurityError' || n === 'NotAllowedError' ? 'permission-denied' : 'port-unavailable', String(e));
    }
    this.port = port; this.closing = false;
    this.loop = this.readLoop(port);
  }

  private async readLoop(port: SerialPortLike): Promise<void> {
    let reason = 'The USB connection was lost.';
    while (port.readable && !this.closing) {
      const reader = port.readable.getReader();
      this.reader = reader;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value && value.length) this.dataListener(value);
        }
      } catch (e) { reason = 'The USB connection was lost (' + (nameOf(e) || 'read error') + ').'; }
      finally { reader.releaseLock(); this.reader = null; }
      if (this.closing) break;
    }
    if (!this.closing) {
      this.port = null;
      await port.close().catch(() => undefined);
      this.closeListener({ unexpected: true, reason });
    }
  }

  write(bytes: Uint8Array): Promise<void> {
    const run = this.queue.then(async () => {
      if (!this.port || !this.port.writable) throw new TransportError('disconnected', 'The port is not open.');
      const w = this.port.writable.getWriter();
      try { await w.write(bytes); } finally { w.releaseLock(); }
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async close(): Promise<void> {
    const port = this.port;
    if (!port) return;
    this.closing = true; this.port = null;
    await this.reader?.cancel().catch(() => undefined);
    await this.loop?.catch(() => undefined);
    await this.queue;
    await port.close().catch(() => undefined);
    this.closeListener({ unexpected: false, reason: 'closed' });
  }
}
