/* Replays a recorded session. The log is the list of valid protocol lines a source received (its "line" events).
   The replay answers the same requests a device would, from the log, so the app goes through the same steps.
   Nothing is written anywhere, and replayed data is labeled as replayed. */
import { LineFramer } from '@tensile/protocol';
import type { Transport } from '../types';

export interface ReplayOptions {
  lines: string[];
  /** Lines sent per timer tick when playing by itself. */
  linesPerTick?: number;
  tick_ms?: number;
  /** When false, call play() to send the next lines. */
  auto?: boolean;
}

function typeOf(line: string): string {
  try { const t = (JSON.parse(line) as { type?: unknown }).type; return typeof t === 'string' ? t : ''; } catch { return ''; }
}

export class ReplayTransport implements Transport {
  readonly label = 'Recorded-data replay';
  private dataListener: (chunk: Uint8Array) => void = () => undefined;
  private closeListener: (info: { unexpected: boolean; reason: string }) => void = () => undefined;
  private framer = new LineFramer();
  private enc = new TextEncoder();
  private dec = new TextDecoder();
  private first: Record<string, string> = {};
  private stream: string[] = [];
  private at = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private isOpen = false;

  constructor(private readonly o: ReplayOptions) {
    let streaming = false;
    for (const l of o.lines) {
      const t = typeOf(l);
      if (t === 'sample') streaming = true;
      /* a hello after the samples began is a device restart; it is replayed in place so the replay ends there too */
      if (streaming && (t === 'sample' || t === 'fault' || t === 'settings' || t === 'hello')) this.stream.push(l);
      else if (t && this.first[t] === undefined) this.first[t] = l;
    }
  }
  get remaining(): number { return this.stream.length - this.at; }

  onData(l: (chunk: Uint8Array) => void): void { this.dataListener = l; }
  onClose(l: (info: { unexpected: boolean; reason: string }) => void): void { this.closeListener = l; }
  async open(): Promise<void> {
    if (!this.first.hello) throw new Error('This file does not contain a recorded session that can be replayed.');
    this.isOpen = true; this.at = 0; this.framer.reset();
  }
  async close(): Promise<void> {
    if (!this.isOpen) return;
    this.isOpen = false; this.stop();
    this.closeListener({ unexpected: false, reason: 'closed' });
  }
  async write(bytes: Uint8Array): Promise<void> {
    for (const f of this.framer.push(this.dec.decode(bytes, { stream: true }))) {
      if (!('line' in f)) continue;
      const t = typeOf(f.line), answer = t === 'identify' ? this.first.hello : t === 'get_channels' ? this.first.channels : t === 'get_settings' ? this.first.settings : undefined;
      if (answer) this.send(answer + '\n');
      if (t === 'start_stream' && this.o.auto !== false) this.timer = setInterval(() => this.play(this.o.linesPerTick ?? 16), this.o.tick_ms ?? 50);
      if (t === 'stop_stream') this.stop();
    }
  }
  private send(text: string): void { if (this.isOpen) this.dataListener(this.enc.encode(text)); }
  private stop(): void { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  /** Sends the next n recorded lines. */
  play(n: number): void {
    const part = this.stream.slice(this.at, this.at + n);
    this.at += part.length;
    if (part.length) this.send(part.join('\n') + '\n');
    if (this.at >= this.stream.length) this.stop();
  }
}
