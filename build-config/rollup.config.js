import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import pug from 'rollup-plugin-pug';
import babel from 'rollup-plugin-babel';
import sass from 'rollup-plugin-sass';
import sassTrigo from './sass-trigo';
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
      rxjs: 'Rx'
    },
    sourcemap: true,
    file: './marking-menu.js',
    banner,
    format: 'umd'
  },
  plugins: [
    resolve(),
    commonjs(),
    sass({
      output: true,
      options: {
        sourceMap: true,
        functions: sassTrigo
      }
    }),
    pug(),
    babel({ exclude: 'node_modules/**' })
  ],
  external: ['rxjs']
};
