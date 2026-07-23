import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const importMapDependencies = new Set([
  'marking-menu',
  'rxjs',
  'rxjs/operators',
]);

export default defineConfig(({ command }) => ({
  base: './',
  build: {
    emptyOutDir: true,
    outDir: resolve(import.meta.dirname, 'demo-dist'),
  },
  plugins: [
    {
      // Only externalize for the production build: the demo's import map
      // (see demo/index.html) is what resolves these specifiers in the
      // browser, but it can only do so for URLs the dev server leaves
      // untouched, which is not the case for module specifiers. So instead,
      // during dev, resolve `marking-menu` straight to the source so Vite can
      // serve and transform it like any other import.
      apply: 'build',
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
  resolve:
    command === 'serve'
      ? { alias: { 'marking-menu': resolve(import.meta.dirname, 'src/index.js') } }
      : undefined,
  root: resolve(import.meta.dirname, 'demo'),
}));
