import path from 'node:path';
import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { outDir: path.resolve(import.meta.dirname, 'dist') },
  plugins: [react(), tailwind()],
  root: path.resolve(import.meta.dirname),
  // `yarn serve:only` must run alongside for the page to reach Lightmill.
  server: { proxy: { '/api': 'http://localhost:8080' } },
});
