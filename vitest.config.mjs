import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.{ts,tsx,mjs}', 'apps/**/*.test.{ts,tsx,mjs}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
