import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    emptyOutDir: true,
    outDir: resolve(import.meta.dirname, '../demo-dist'),
  },
  resolve: {
    alias: {
      'marking-menu': resolve(import.meta.dirname, '../src/index.js'),
    },
  },
  root: resolve(import.meta.dirname, '../demo'),
});
