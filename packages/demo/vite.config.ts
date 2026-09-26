import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Left external, resolved by the page's import map (`playground/index.html`)
// instead of bundled, so the playground runs the same `lib/marking-menu.js`
// as the demo page.
const importMapDependencies = new Set(['marking-menu']);

// Builds the playground only. The demo page has no build step (see
// `docs/adr/0002-demo-page-without-build-step.md`); the `build` script copies
// it into `dist/` as is.
export default defineConfig({
  base: './',
  build: {
    rolldownOptions: {
      input: 'playground/index.html',
      external: (source: string) => importMapDependencies.has(source),
    },
  },
  plugins: [react(), tailwind()],
});
