/* The recording journal kept as files by the Windows app (apps/desktop/journal-files.cjs), reached through its bridge.
   The same interface as the browser's IndexedDB journal, so the screens do not change. */
import type { JournalLines, JournalMeta, JournalStatus, SessionJournal } from './journal';

export class DesktopJournal implements SessionJournal {
  constructor(private readonly j: SessionJournal) {}
  begin(meta: Omit<JournalMeta, 'status' | 'lastCommitAt' | 'endedAt' | 'endReason' | 'sampleCount'>, header: JournalLines): Promise<void> {
    /* Plain data only crosses the bridge. */
    return this.j.begin(JSON.parse(JSON.stringify(meta)) as typeof meta, { lines: [...header.lines], receivedAt_ms: [...header.receivedAt_ms] });
  }
  append(id: string, batch: JournalLines): Promise<void> { return this.j.append(id, { lines: [...batch.lines], receivedAt_ms: [...batch.receivedAt_ms] }); }
  finish(id: string, status: Exclude<JournalStatus, 'recording'>, endReason: string): Promise<void> { return this.j.finish(id, status, endReason); }
  list(): Promise<JournalMeta[]> { return this.j.list(); }
  lines(id: string): Promise<JournalLines> { return this.j.lines(id); }
  remove(id: string): Promise<void> { return this.j.remove(id); }
  estimate(): Promise<{ usage: number; quota: number } | null> { return this.j.estimate(); }
}
