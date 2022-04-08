import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import postcss from 'rollup-plugin-postcss';
import { version } from '../package.json';

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

export default {
  input: 'src/index.js',
  output: {
    name: 'MarkingMenu',
    globals: {
      rxjs: 'rxjs',
      'rxjs/operators': 'rxjs.operators',
    },
    sourcemap: true,
    file: './marking-menu.js',
    banner,
    format: 'umd',
  },
  plugins: [
    resolve(),
    postcss({ minimize: true }),
    babel({ exclude: 'node_modules/**', babelHelpers: 'runtime' }),
    commonjs(),
  ],
  external: ['rxjs', 'rxjs/operators'],
};
