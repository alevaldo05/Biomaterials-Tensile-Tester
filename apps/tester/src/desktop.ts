/* What the Windows app gives the screens (apps/desktop/preload.cjs). Absent in a browser. */
import type { SessionJournal } from './storage/journal';
export interface DesktopBridge {
  kind: 'windows-app';
  getLabServer: () => Promise<string>;
  setLabServer: (url: string) => Promise<{ url?: string; error?: string }>;
  /** Recordings kept as files by the Windows app; the same calls as the journal interface. */
  journal?: SessionJournal;
}
export function desktopBridge(): DesktopBridge | null {
  const d = typeof window !== 'undefined' ? (window as unknown as { tensileDesktop?: DesktopBridge }).tensileDesktop : undefined;
  return d && d.kind === 'windows-app' && typeof d.getLabServer === 'function' && typeof d.setLabServer === 'function' ? d : null;
}
