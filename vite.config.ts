import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { version } from './package.json' with { type: 'json' };

// `bundleTypes` runs `@microsoft/api-extractor`, and unplugin-dts points it at
// the resolved `typescript` package so that its `lib/` supplies the
// `lib.*.d.ts` files. That breaks here: our `typescript` dependency is the
// `@typescript/typescript6` shim, whose `lib/` merely re-exports the real
// compiler and ships no `lib.dom.d.ts` — leaving API Extractor unable to
// resolve DOM globals ("Unable to follow symbol for HTMLElement"). Point it at
// the package the shim delegates to, which has the actual libs.
const require = createRequire(import.meta.url);
const typescriptCompilerFolder = path.dirname(
  require.resolve('@typescript/old/package.json', {
    paths: [require.resolve('typescript/package.json')],
  }),
);

const banner = `/*!
 * Marking Menu Javascript Library v${version}
 * https://github.com/QuentinRoy/Marking-Menu
 *
 * Released under the MIT license.
 * https://raw.githubusercontent.com/QuentinRoy/Marking-Menu/main/LICENSE
 *
 * Marking Menus may be patented independently from this software.
 *
 * Date: ${new Date().toUTCString()}
 */
`;

export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: 'tsconfig.app.json',
      // The declaration rollup starts from package.json's `types`, so that
      // path must not collide with the per-file declaration of a source
      // module other than the entry: unplugin-dts leaves the existing file in
      // place rather than writing the entry re-export there, and API
      // Extractor then rolls up the wrong module, silently dropping whatever
      // `src/index.ts` adds on top of it. Hence the bundle is named after its
      // entry module, `index`, and not after the library.
      bundleTypes: { invokeOptions: { typescriptCompilerFolder } },
    }),
  ],
  build: {
    cssMinify: 'lightningcss',
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/index.ts'),
      fileName: 'index',
      formats: ['es'],
    },
    minify: false,
    rolldownOptions: {
      output: { banner },
    },
    sourcemap: true,
  },
});
