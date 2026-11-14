import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInfo } from './build-info';
import { siteData } from './site-data';

/* The base path is "./" so the built app works under any address (for example /app/ behind the gateway). */
/* The built app gets a Content Security Policy like the website's pages: only its own files, no inline scripts.
   (The development server needs inline code for live reloading, so the tag is added to builds only.) */
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; form-action 'none'; base-uri 'none'";
const csp = (): Plugin => ({
  name: 'content-security-policy', apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta name="viewport"', `<meta http-equiv="Content-Security-Policy" content="${CSP}">\n  <meta name="viewport"`),
});

/* siteData: the website's definitions and materials. buildInfo: the version (from apps/desktop/package.json), the
   commit, and the hash of the shared website files, shown on the Help screen. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig(() => ({
  base: './',
  plugins: [react(), csp(), siteData(ROOT), buildInfo(ROOT)],
  build: { outDir: 'dist', sourcemap: false },
  /* In development the API runs on its own port; the app reaches it at the same /api address it uses behind the gateway. */
  server: { port: 5173, strictPort: false, proxy: { '/api': process.env.API_URL || 'http://localhost:3000' } },
  preview: { proxy: { '/api': process.env.API_URL || 'http://localhost:3000' } },
}));
