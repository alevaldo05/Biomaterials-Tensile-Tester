/* The Windows app only: a small bar under the status line when a newer published release exists on GitHub.
   Download opens the release page in the computer's browser; installing is the person's own click. The bar can be
   dismissed, is hidden while recording, and sits in the page flow so it never covers the Test screen's controls.
   The question is asked a few seconds after the screens load, once, and only when the setting is on (Settings). */
import { useEffect, useState } from 'react';
import { desktopBridge } from '../desktop';
import type { DesktopBridge, UpdateAnswer } from '../desktop';

export const UPDATE_DELAY_MS = 4000;

/** Asks the Windows app, only when its setting is on. Resolves to a usable answer or null; never rejects. */
export async function askForUpdate(bridge: DesktopBridge | null): Promise<UpdateAnswer | null> {
  if (!bridge?.checkForUpdate || !bridge.openReleasePage) return null;
  try {
    if (bridge.getUpdateCheck && (await bridge.getUpdateCheck()) === false) return null;
    const a = await bridge.checkForUpdate();
    return a && a.available && typeof a.version === 'string' && typeof a.pageUrl === 'string' ? a : null;
  } catch {
    return null;
  }
}

export function UpdateNotice({ answer, recording, onDownload, onDismiss }: { answer: UpdateAnswer | null; recording: boolean; onDownload: () => void; onDismiss: () => void }) {
  if (!answer || recording) return null;
  return (
    <p className="update-bar" role="status">
      <span>Version {answer.version} is available.</span>
      <button type="button" className="link" onClick={onDownload}>Download</button>
      <button type="button" className="quiet update-close" aria-label="Dismiss the update notice" onClick={onDismiss}>✕</button>
    </p>
  );
}

export function UpdateBar({ recording, bridge = desktopBridge(), delayMs = UPDATE_DELAY_MS }: { recording: boolean; bridge?: DesktopBridge | null; delayMs?: number }) {
  const [answer, setAnswer] = useState<UpdateAnswer | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!bridge) return;
    let live = true;
    const t = setTimeout(() => { void askForUpdate(bridge).then((a) => { if (live) setAnswer(a); }); }, delayMs);
    return () => { live = false; clearTimeout(t); };
  }, [bridge, delayMs]);
  return <UpdateNotice answer={dismissed ? null : answer} recording={recording}
    onDownload={() => { if (answer?.pageUrl) void bridge?.openReleasePage?.(answer.pageUrl); }} onDismiss={() => setDismissed(true)} />;
}
