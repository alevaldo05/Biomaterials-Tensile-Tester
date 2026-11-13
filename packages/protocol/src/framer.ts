/* Cuts a stream of text into lines. A serial read can end in the middle of a message or hold several messages;
   this keeps the unfinished part until the rest arrives. A line longer than the limit is dropped (and reported)
   instead of growing without end. */
import { MAX_LINE_LENGTH } from './messages';

export type Framed = { line: string } | { oversize: true; length: number };

export class LineFramer {
  private buffer = '';
  private skipping = false;
  private skipped = 0;
  constructor(private readonly maxLength = MAX_LINE_LENGTH) {}

  /** Adds received text and returns the complete lines it finishes, in order. Blank lines are ignored. */
  push(chunk: string): Framed[] {
    const out: Framed[] = [];
    let rest = chunk;
    for (;;) {
      const nl = rest.search(/[\r\n]/);
      if (nl < 0) break;
      const part = rest.slice(0, nl);
      rest = rest.slice(nl + 1);
      if (this.skipping) {
        out.push({ oversize: true, length: this.skipped + part.length });
        this.skipping = false; this.skipped = 0;
      } else {
        const line = this.buffer + part;
        if (line.length > this.maxLength) out.push({ oversize: true, length: line.length });
        else if (line.trim() !== '') out.push({ line });
      }
      this.buffer = '';
    }
    if (this.skipping) this.skipped += rest.length;
    else {
      this.buffer += rest;
      if (this.buffer.length > this.maxLength) { this.skipping = true; this.skipped = this.buffer.length; this.buffer = ''; }
    }
    return out;
  }

  /** Characters waiting for the end of their line. */
  get pending(): number { return this.skipping ? this.skipped : this.buffer.length; }

  /** Forgets any unfinished line (used when the connection closes: half a message is never delivered). */
  reset(): void { this.buffer = ''; this.skipping = false; this.skipped = 0; }
}
