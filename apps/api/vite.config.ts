import { defineConfig } from 'vite';

/* Bundles the API and the shared packages it uses into dist/ for Node. The packages in node_modules
   (fastify, pg, argon2, zod) stay outside the bundle and are installed in the container. */
export default defineConfig({
  build: {
    ssr: true,
    target: 'node22',
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: { input: { server: 'src/server.ts', cli: 'src/cli.ts' }, output: { format: 'es', entryFileNames: '[name].js' } },
  },
  ssr: { noExternal: [/^@tensile\//] },
});
