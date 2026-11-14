/* Recording on this computer, independent of the lab server. While a test records, every line the device sends is
   committed here in small batches (about once a second), so a crash or a closed window loses at most the last
   second. When the app opens again, a recording that never finished is listed for recovery.

   This is an interface so the Windows app can later keep the journal in its own files (through a narrow bridge),
   with the same screens. The browser version keeps it in IndexedDB. Nothing here recreates samples that were
   not committed: a recovered recording ends where its last batch ends. */
import type { TestType } from '@tensile/core';
import type { CalibrationRecord, DeviceProfile } from '@tensile/recording';
import type { Setup } from '../setup';

export type JournalStatus = 'recording' | 'complete' | 'interrupted';

export interface JournalMeta {
  id: string;
  status: JournalStatus;
  test: TestType;
  setup: Setup;
  profile: DeviceProfile | null;
  calibrations: CalibrationRecord[];
  /** The software baseline subtracted from the force, N. Missing in entries from older versions: none. */
  forceZero_N?: number;
  appVersion: string;
  deviceId: string;
  /** Local time the recording started, ISO. */
  startedAt: string;
  /** Local time of the last committed batch, ISO. */
  lastCommitAt: string;
  endedAt: string | null;
  endReason: string;
  /** Lines committed after the header: the samples, plus any fault, restart, or settings line sent while recording. */
  sampleCount: number;
}

export interface JournalLines { lines: string[]; receivedAt_ms: number[] }

export interface SessionJournal {
  /** Starts a session with the device's identification lines. */
  begin(meta: Omit<JournalMeta, 'status' | 'lastCommitAt' | 'endedAt' | 'endReason' | 'sampleCount'>, header: JournalLines): Promise<void>;
  /** Commits a batch of sample lines; resolves only once they are stored. */
  append(id: string, batch: JournalLines): Promise<void>;
  finish(id: string, status: Exclude<JournalStatus, 'recording'>, endReason: string): Promise<void>;
  list(): Promise<JournalMeta[]>;
  /** Every committed line of one session, header first. */
  lines(id: string): Promise<JournalLines>;
  remove(id: string): Promise<void>;
  /** Space used and available, when the platform can tell. */
  estimate(): Promise<{ usage: number; quota: number } | null>;
}

const nowIso = () => new Date().toISOString();

/** Kept in memory: for tests, and as the fallback when the browser offers no storage. */
export class MemoryJournal implements SessionJournal {
  private metas = new Map<string, JournalMeta>();
  private data = new Map<string, JournalLines[]>();
  /** Tests set this to make the next append fail. */
  failNext = false;
  async begin(meta: Omit<JournalMeta, 'status' | 'lastCommitAt' | 'endedAt' | 'endReason' | 'sampleCount'>, header: JournalLines): Promise<void> {
    this.metas.set(meta.id, { ...meta, status: 'recording', lastCommitAt: nowIso(), endedAt: null, endReason: '', sampleCount: 0 });
    this.data.set(meta.id, [header]);
  }
  async append(id: string, batch: JournalLines): Promise<void> {
    if (this.failNext) { this.failNext = false; throw new Error('The storage refused the write.'); }
    const m = this.metas.get(id), d = this.data.get(id);
    if (!m || !d) throw new Error('No such session.');
    d.push({ lines: batch.lines.slice(), receivedAt_ms: batch.receivedAt_ms.slice() });
    m.sampleCount += batch.lines.length;
    m.lastCommitAt = nowIso();
  }
  async finish(id: string, status: Exclude<JournalStatus, 'recording'>, endReason: string): Promise<void> {
    const m = this.metas.get(id);
    if (m) { m.status = status; m.endReason = endReason; m.endedAt = nowIso(); }
  }
  async list(): Promise<JournalMeta[]> { return [...this.metas.values()].map((m) => ({ ...m })).sort((a, b) => b.startedAt.localeCompare(a.startedAt)); }
  async lines(id: string): Promise<JournalLines> {
    const d = this.data.get(id) ?? [];
    return { lines: d.flatMap((b) => b.lines), receivedAt_ms: d.flatMap((b) => b.receivedAt_ms) };
  }
  async remove(id: string): Promise<void> { this.metas.delete(id); this.data.delete(id); }
  async estimate(): Promise<null> { return null; }
}
