/* The version line on the Help screen: the app's version, the commit it was built from, and a short hash of the
   website files it shares (scripts/shared-files.js). The Windows app workflow prints the same line. */
import info from 'virtual:build-info';

export const BUILD_INFO = info;

export function versionLine(i: { appVersion: string; commit: string; sharedFilesHash: string } = info): string {
  return 'Version ' + i.appVersion + ' · built from ' + i.commit + ' · shared website files ' + i.sharedFilesHash.slice(0, 12);
}
