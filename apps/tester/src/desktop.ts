/* What the Windows app gives the screens (apps/desktop/preload.cjs). Absent in a browser. */
import type { SessionJournal } from './storage/journal';
import type { PeopleBridge } from './people';
export interface DesktopBridge {
  kind: 'windows-app';
  getLabServer: () => Promise<string>;
  setLabServer: (url: string) => Promise<{ url?: string; error?: string }>;
  /** Recordings kept as files by the Windows app; the same calls as the journal interface. */
  journal?: SessionJournal;
  /** Asks GitHub once per start whether a newer published release exists (nothing when the setting is off). */
  checkForUpdate?: () => Promise<UpdateAnswer>;
  /** Opens this repository's release page in the computer's browser; any other address is refused. */
  openReleasePage?: (url: string) => Promise<boolean>;
  getUpdateCheck?: () => Promise<boolean>;
  setUpdateCheck?: (on: boolean) => Promise<{ on?: boolean; error?: string }>;
  /** Sign-in and the people who may run the machine (apps/desktop/people.cjs). */
  people?: PeopleBridge;
}
export interface UpdateAnswer { available: boolean; version?: string; pageUrl?: string }
export function desktopBridge(): DesktopBridge | null {
  const d = typeof window !== 'undefined' ? (window as unknown as { tensileDesktop?: DesktopBridge }).tensileDesktop : undefined;
  return d && d.kind === 'windows-app' && typeof d.getLabServer === 'function' && typeof d.setLabServer === 'function' ? d : null;
}
