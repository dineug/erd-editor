import { readFileSync } from 'node:fs';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import filesize from 'rollup-plugin-filesize';
import { terser } from 'rollup-plugin-terser';
import typescript from 'rollup-plugin-typescript2';
import { visualizer } from 'rollup-plugin-visualizer';
import ttypescript from 'ttypescript';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

export default {
  input: 'src/index.ts',
  context: 'globalThis',
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
      banner,
      plugins: [terser()],
    },
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      typescript: ttypescript,
      useTsconfigDeclarationDir: true,
      importHelpers: false,
    }),
    visualizer({
      filename: './dist/stats.html',
    }),
    filesize({
      showBrotliSize: true,
    }),
  ],
  onwarn: warning => {
    if (warning.code !== 'CIRCULAR_DEPENDENCY') {
      console.warn(`(!) ${warning.message}`);
    }
  },
};
