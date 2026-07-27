import path from 'node:path';
import { defineConfig } from 'vite';
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
  build: {
    cssMinify: 'lightningcss',
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/index.ts'),
      // Using a callback so vite does not add the .js extension to the file name.
      fileName: () => 'marking-menu.mjs',
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
