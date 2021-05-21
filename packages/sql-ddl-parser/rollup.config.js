import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import visualizer from 'rollup-plugin-visualizer';
import filesize from 'rollup-plugin-filesize';
import { uglify } from 'rollup-plugin-uglify';
import pkg from './package.json';

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

export default {
  input: 'src/index.ts',
  output: [
    {
      file: pkg.module,
      format: 'es',
      banner,
    },
    {
      name: pkg.name,
      file: pkg.main,
      format: 'umd',
      banner,
    },
    {
      name: pkg.name,
      file: pkg.browser,
      format: 'umd',
      plugins: [uglify()],
      banner,
    },
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript(),
    visualizer({
      filename: './dist/stats.html',
    }),
    filesize({
      showBrotliSize: true,
    }),
  ],
};
