/* The version line on the Help screen: the app's version, the commit it was built from, and a short hash of the
   website files it shares (scripts/shared-files.js). The Windows app workflow prints the same line. Home shows the
   short form at its very bottom ("Version 0.3 (beta)"). Each new download raises the second number: 0.3, 0.4, 0.5. */
import info from 'virtual:build-info';

export const BUILD_INFO = info;

/** "0.3.0" -> "0.3": a version as people read it (a trailing .0 dropped); any other form is kept as it is. */
export function shortVersion(v: string): string { return /^\d+\.\d+\.0$/.test(v) ? v.slice(0, -2) : v; }
/** The small line at the very bottom of Home, for example "Version 0.3 (beta)". */
export function homeVersion(i: { appVersion: string } = info): string { return 'Version ' + shortVersion(i.appVersion) + ' (beta)'; }

export function versionLine(i: { appVersion: string; commit: string; sharedFilesHash: string } = info): string {
  return 'Version ' + i.appVersion + ' · built from ' + i.commit + ' · shared website files ' + i.sharedFilesHash.slice(0, 12);
}
