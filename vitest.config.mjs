import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInfo } from './apps/tester/build-info.ts';

/* buildInfo gives the tests the same app version (__APP_VERSION__, from apps/desktop/package.json) and
   "virtual:build-info" as the built app. */
const ROOT = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [buildInfo(ROOT)],
  test: {
    include: ['packages/**/*.test.{ts,tsx,mjs}', 'apps/**/*.test.{ts,tsx,mjs}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
