import path from 'node:path';
import { defineConfig } from 'vite';

const importMapDependencies = new Set(['marking-menu']);

export default defineConfig(({ command }) => ({
  base: './',
  build: {
    emptyOutDir: true,
    outDir: path.resolve(import.meta.dirname, 'demo-dist'),
    // Multi-page build: the demo at the root, and the playground page (see
    // `demo/playground`) alongside it. Vite only bundles `demo/index.html`
    // by default; nested pages need spelling out here, though the dev
    // server already serves `demo/playground/index.html` at `/playground/`
    // without it.
    rolldownOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'demo/index.html'),
        playground: path.resolve(
          import.meta.dirname,
          'demo/playground/index.html',
        ),
      },
    },
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
  publicDir: path.resolve(import.meta.dirname, 'dist'),
  ...(command === 'serve' && {
    resolve: {
      alias: {
        'marking-menu': path.resolve(import.meta.dirname, 'src/index.ts'),
      },
    },
  }),
  root: path.resolve(import.meta.dirname, 'demo'),
}));
