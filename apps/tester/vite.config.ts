import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

/* "vite build --mode learning" builds the learning edition: simulator and replay only.
   The base path is "./" so the built app works under any address (for example /app/ behind the gateway). */
/* The built app gets a Content Security Policy like the website's pages: only its own files, no inline scripts.
   (The development server needs inline code for live reloading, so the tag is added to builds only.) */
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; form-action 'none'; base-uri 'none'";
const csp = (): Plugin => ({
  name: 'content-security-policy', apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta name="viewport"', `<meta http-equiv="Content-Security-Policy" content="${CSP}">\n  <meta name="viewport"`),
});

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), csp()],
  define: { __EDITION__: JSON.stringify(mode === 'learning' ? 'learning' : 'lab') },
  build: { outDir: mode === 'learning' ? 'dist-learning' : 'dist', sourcemap: false },
  server: { port: 5173, strictPort: false },
}));
