import path from 'node:path';
import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Kept as a bare specifier in the built output and resolved by the page's
// import map (see `demo/playground/index.html`) instead of being bundled, the
// same way `e2e/vite.config.ts` does, so the playground exercises the exact
// unchanged `dist/marking-menu.js`.
const importMapDependencies = new Set(['marking-menu']);

export default defineConfig({
  base: './',
  build: {
    emptyOutDir: true,
    outDir: path.resolve(import.meta.dirname, 'playground-dist'),
    rolldownOptions: {
      external: (source: string) => importMapDependencies.has(source),
    },
  },
  plugins: [react(), tailwind()],
  // Copies `dist/marking-menu.js` (and its sourcemap and declaration file)
  // next to the built playground, unmodified, the same way
  // `e2e/vite.config.ts` does for its fixture.
  publicDir: path.resolve(import.meta.dirname, 'dist'),
  root: path.resolve(import.meta.dirname, 'demo/playground'),
});
