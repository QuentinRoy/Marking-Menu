import path from 'node:path';
import { defineConfig } from 'vite';

// Kept as a bare specifier in the built output and resolved by the fixture's
// import map (see `e2e/fixture/index.html`) instead of being bundled, so the
// tests exercise the exact unchanged `dist/index.js`.
const importMapDependencies = new Set(['marking-menu']);

export default defineConfig({
  base: './',
  build: {
    emptyOutDir: true,
    outDir: path.resolve(import.meta.dirname, 'fixture-dist'),
    rolldownOptions: {
      external: (source: string) => importMapDependencies.has(source),
    },
  },
  // Copies `dist/index.js` (and its sourcemap and declaration file)
  // into the built fixture unmodified, the same way `vite.demo.config.ts`
  // does for the production demo.
  publicDir: path.resolve(import.meta.dirname, '../dist'),
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  root: path.resolve(import.meta.dirname, 'fixture'),
});
