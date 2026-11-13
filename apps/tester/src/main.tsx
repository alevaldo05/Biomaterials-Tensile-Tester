import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Shell } from './Shell';
import { TestController } from './controller';
import { openUsbSerial, usbSerialAvailable } from './real';
import type { SessionJournal } from './storage/journal';
import { IdbJournal, IdbMethods, openAppDb } from './storage/idb';
import { MemoryMethods } from './storage/methods';
import { DesktopJournal } from './storage/desktop-journal';
import { desktopBridge } from './desktop';
import type { MethodStore } from './storage/methods';
import './app.css';

async function start() {
  /* Recordings and methods are kept in the browser's own storage. Without it, recordings stay in memory only. */
  let journal: SessionJournal | null = null, methods: MethodStore = new MemoryMethods();
  try { const db = await openAppDb(); journal = new IdbJournal(db); methods = new IdbMethods(db); } catch { /* storage refused (for example a private window) */ }
  /* In the Windows app, recordings are kept as files in the app's data folder instead. */
  const d = desktopBridge();
  if (d?.journal) journal = new DesktopJournal(d.journal);
  const controller = new TestController({ openReal: openUsbSerial, journal });
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode><Shell controller={controller} serialAvailable={usbSerialAvailable()} journal={journal} methods={methods} /></StrictMode>);
}
void start();
