import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const { version } = require('./package.json');

const banner = `/*!
 * Marking Menu Javascript Library v${version}
 * https://github.com/QuentinRoy/Marking-Menu
 *
 * Released under the MIT license.
 * https://raw.githubusercontent.com/QuentinRoy/Marking-Menu/master/LICENSE
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
      entry: resolve(import.meta.dirname, 'src/index.js'),
      fileName: (format) =>
        format === 'es' ? 'marking-menu.mjs' : 'marking-menu.js',
      formats: ['es', 'umd'],
      name: 'MarkingMenu',
    },
    minify: false,
    rolldownOptions: {
      external: ['rxjs', 'rxjs/operators'],
      output: {
        banner,
        globals: {
          rxjs: 'rxjs',
          'rxjs/operators': 'rxjs.operators',
        },
      },
    },
    sourcemap: true,
  },
});
