/* The browser's own storage (IndexedDB) for the journal and the methods. Only the browser build uses this file;
   the Windows app can provide its own versions of the same two interfaces. */
import type { JournalLines, JournalMeta, JournalStatus, SessionJournal } from './journal';
import type { MethodStore, TestMethod } from './methods';

const nowIso = () => new Date().toISOString();
const newId = () => 'm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);


const DB_NAME = 'tensile-tester-app', DB_VERSION = 1;

export function openAppDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks', { autoIncrement: true }).createIndex('session', 'sessionId');
      if (!db.objectStoreNames.contains('methods')) db.createObjectStore('methods', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('The browser storage could not be opened.'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('The browser storage refused the write.'));
    tx.onabort = () => reject(tx.error ?? new Error('The browser storage refused the write (it may be full).'));
  });
}
function result<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}

export class IdbJournal implements SessionJournal {
  constructor(private readonly db: IDBDatabase) {}
  async begin(meta: Omit<JournalMeta, 'status' | 'lastCommitAt' | 'endedAt' | 'endReason' | 'sampleCount'>, header: JournalLines): Promise<void> {
    const tx = this.db.transaction(['sessions', 'chunks'], 'readwrite');
    tx.objectStore('sessions').put({ ...meta, status: 'recording', lastCommitAt: nowIso(), endedAt: null, endReason: '', sampleCount: 0 } satisfies JournalMeta);
    tx.objectStore('chunks').add({ sessionId: meta.id, ...header });
    await done(tx);
  }
  async append(id: string, batch: JournalLines): Promise<void> {
    const tx = this.db.transaction(['sessions', 'chunks'], 'readwrite');
    const sessions = tx.objectStore('sessions');
    tx.objectStore('chunks').add({ sessionId: id, lines: batch.lines, receivedAt_ms: batch.receivedAt_ms });
    const m = await result(sessions.get(id) as IDBRequest<JournalMeta | undefined>);
    if (m) sessions.put({ ...m, sampleCount: m.sampleCount + batch.lines.length, lastCommitAt: nowIso() });
    await done(tx);
  }
  async finish(id: string, status: Exclude<JournalStatus, 'recording'>, endReason: string): Promise<void> {
    const tx = this.db.transaction('sessions', 'readwrite'), s = tx.objectStore('sessions');
    const m = await result(s.get(id) as IDBRequest<JournalMeta | undefined>);
    if (m) s.put({ ...m, status, endReason, endedAt: nowIso() });
    await done(tx);
  }
  async list(): Promise<JournalMeta[]> {
    const all = await result(this.db.transaction('sessions').objectStore('sessions').getAll() as IDBRequest<JournalMeta[]>);
    return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }
  async lines(id: string): Promise<JournalLines> {
    const idx = this.db.transaction('chunks').objectStore('chunks').index('session');
    const chunks = await result(idx.getAll(IDBKeyRange.only(id)) as IDBRequest<(JournalLines & { sessionId: string })[]>);
    return { lines: chunks.flatMap((c) => c.lines), receivedAt_ms: chunks.flatMap((c) => c.receivedAt_ms) };
  }
  async remove(id: string): Promise<void> {
    const tx = this.db.transaction(['sessions', 'chunks'], 'readwrite');
    tx.objectStore('sessions').delete(id);
    const idx = tx.objectStore('chunks').index('session');
    const keys = await result(idx.getAllKeys(IDBKeyRange.only(id)));
    for (const k of keys) tx.objectStore('chunks').delete(k);
    await done(tx);
  }
  async estimate(): Promise<{ usage: number; quota: number } | null> {
    try { const e = await navigator.storage?.estimate?.(); return e && e.quota ? { usage: e.usage ?? 0, quota: e.quota } : null; } catch { return null; }
  }
}

export class IdbMethods implements MethodStore {
  constructor(private readonly db: IDBDatabase) {}
  private all(): Promise<TestMethod[]> {
    return new Promise((resolve, reject) => {
      const r = this.db.transaction('methods').objectStore('methods').getAll() as IDBRequest<TestMethod[]>;
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
  }
  private put(items: TestMethod[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('methods', 'readwrite');
      for (const i of items) tx.objectStore('methods').put(i);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  }
  async list(): Promise<TestMethod[]> { return (await this.all()).filter((m) => !m.archived).sort((a, b) => a.name.localeCompare(b.name)); }
  async save(m: Omit<TestMethod, 'id' | 'revision' | 'createdAt' | 'archived'>, replaces?: TestMethod): Promise<TestMethod> {
    if (!m.name) throw new Error('Give the method a name.');
    const item: TestMethod = { ...m, id: newId(), revision: replaces ? replaces.revision + 1 : 1, createdAt: new Date().toISOString(), archived: false };
    await this.put(replaces ? [{ ...replaces, archived: true }, item] : [item]);
    return item;
  }
  async archive(id: string): Promise<void> { const m = (await this.all()).find((x) => x.id === id); if (m) await this.put([{ ...m, archived: true }]); }
}
