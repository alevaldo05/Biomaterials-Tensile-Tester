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
import { MachineAccess, People } from './people';
import type { MethodStore } from './storage/methods';
import './app.css';

async function start() {
  /* Recordings and methods are kept in the browser's own storage. Without it, recordings stay in memory only. */
  let journal: SessionJournal | null = null, methods: MethodStore = new MemoryMethods();
  try { const db = await openAppDb(); journal = new IdbJournal(db); methods = new IdbMethods(db); } catch { /* storage refused (for example a private window) */ }
  /* In the Windows app, recordings are kept as files in the app's data folder instead. */
  const d = desktopBridge();
  if (d?.journal) journal = new DesktopJournal(d.journal);
  /* Running the machine needs a sign-in on the lab computer (the Windows app); a browser does not connect to the tester. */
  const access = new MachineAccess(d?.people ? new People(d.people) : null);
  const controller = new TestController({ openReal: openUsbSerial, journal, machine: () => access.check() });
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode><Shell controller={controller} serialAvailable={usbSerialAvailable()} journal={journal} methods={methods} access={access} /></StrictMode>);
}
void start();
