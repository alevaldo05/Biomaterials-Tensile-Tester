/* What the Windows app gives the screens (apps/desktop/preload.cjs). Absent in a browser. */
export interface DesktopBridge {
  kind: 'windows-app';
  getLabServer: () => Promise<string>;
  setLabServer: (url: string) => Promise<{ url?: string; error?: string }>;
}
export function desktopBridge(): DesktopBridge | null {
  const d = typeof window !== 'undefined' ? (window as unknown as { tensileDesktop?: DesktopBridge }).tensileDesktop : undefined;
  return d && d.kind === 'windows-app' && typeof d.getLabServer === 'function' && typeof d.setLabServer === 'function' ? d : null;
}
