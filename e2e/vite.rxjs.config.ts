import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'vite';

// The published `dist/index.js` imports the bare specifier `rxjs`,
// which the browser resolves through the fixture's import map (see
// `e2e/fixture/index.html`). RxJS's own package exports are not directly
// loadable by a browser without bundler resolution (internal, extensionless,
// directory imports), so this bundles the package's ES2015 build into a
// single self-contained ESM file the import map can point at, instead of
// depending on an external CDN such as esm.sh.
const require = createRequire(import.meta.url);
const rxjsEntry = path.join(
  path.dirname(require.resolve('rxjs/package.json')),
  'dist/esm/index.js',
);

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: rxjsEntry,
      fileName: 'rxjs',
      formats: ['es'],
    },
    minify: false,
    outDir: path.resolve(import.meta.dirname, 'fixture-dist'),
  },
});
