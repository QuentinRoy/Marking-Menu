import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const importMapDependencies = new Set([
  'marking-menu',
  'rxjs',
  'rxjs/operators',
]);

export default defineConfig({
  base: './',
  build: {
    emptyOutDir: true,
    outDir: resolve(import.meta.dirname, 'demo-dist'),
  },
  plugins: [
    {
      enforce: 'pre',
      name: 'externalize-import-map-dependencies',
      resolveId(source) {
        if (importMapDependencies.has(source)) {
          return { external: true, id: source };
        }
        return null;
      },
    },
  ],
  publicDir: resolve(import.meta.dirname, 'dist'),
  root: resolve(import.meta.dirname, 'demo'),
});
