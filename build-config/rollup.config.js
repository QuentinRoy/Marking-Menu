/* eslint-disable */
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import pug from 'rollup-plugin-pug';
import babel from 'rollup-plugin-babel';
import sass from 'rollup-plugin-sass';
import sassTrigo from './sass-trigo';

export default {
  entry: 'src/index.js',
  format: 'umd',
  moduleName: 'MarkingMenu',
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
  external: ['rxjs'],
  globals: {
    'rxjs': 'Rx'
  },
  dest: './marking-menu.js',
  sourceMap: true
};
