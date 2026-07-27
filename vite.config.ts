import path from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { version } from './package.json' with { type: 'json' };

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
    // Bundling declarations (`bundleTypes`) needs `@microsoft/api-extractor`,
    // whose internal TS engine doesn't support this project's TypeScript
    // version. The unbundled, per-module output below works fine even though
    // the build itself emits a single JS bundle: `.d.ts` resolution is purely
    // a compile-time concern, so `./model.js`-style relative specifiers in
    // the generated declarations resolve to their sibling `.d.ts` file
    // without the runtime `.js` file needing to exist.
    dts({ tsconfigPath: 'tsconfig.app.json' }),
  ],
  build: {
    cssMinify: 'lightningcss',
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/index.ts'),
      fileName: 'marking-menu',
      formats: ['es'],
    },
    minify: false,
    rolldownOptions: {
      external: ['rxjs'],
      output: { banner },
    },
    sourcemap: true,
  },
});
