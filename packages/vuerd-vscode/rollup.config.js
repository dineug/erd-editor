import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';
import filesize from 'rollup-plugin-filesize';

import pkg from './package.json';

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

export default {
  input: 'src/extension.ts',
  output: {
    file: pkg.main,
    format: 'cjs',
    banner,
  },
  external: [
    'vscode',
    'path',
    'fs',
    'url',
    'events',
    'stream',
    'util',
    'http',
    'https',
    'tls',
    'os',
    'zlib',
    'dns',
    'http2',
    'net',
  ],
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.VUERD_VSCODE_VERSION': JSON.stringify(pkg.version),
    }),
    resolve(),
    commonjs(),
    typescript(),
    filesize({
      showBrotliSize: true,
    }),
  ],
};
