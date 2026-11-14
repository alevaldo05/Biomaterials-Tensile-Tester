/* Values added when the app is built or tested (apps/tester/build-info.ts, used by apps/tester/vite.config.ts and
   vitest.config.mjs). */

/** The version in apps/desktop/package.json. */
declare const __APP_VERSION__: string;

declare module 'virtual:build-info' {
  const info: { appVersion: string; commit: string; sharedFilesHash: string };
  export default info;
}
