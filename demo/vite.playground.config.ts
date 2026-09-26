import path from 'node:path';
import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Left external, resolved by the page's import map (`index.html`) instead
// of bundled, so the playground runs the exact `dist/marking-menu.js`.
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
  // Copies `dist/` next to the built playground.
  publicDir: path.resolve(import.meta.dirname, 'dist'),
  root: path.resolve(import.meta.dirname, 'demo/playground'),
});
