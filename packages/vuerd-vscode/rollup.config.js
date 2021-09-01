import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';
import filesize from 'rollup-plugin-filesize';
import { terser } from 'rollup-plugin-terser';

import pkg from './package.json';

const isProd = process.env.NODE_ENV === 'production';

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

const buildPlugins = [
  replace({
    preventAssignment: true,
    'process.env.NODE_ENV': JSON.stringify(
      isProd ? 'production' : 'development'
    ),
    'process.env.VUERD_VSCODE_VERSION': JSON.stringify(pkg.version),
  }),
  resolve(),
  commonjs(),
  typescript(),
];

if (isProd) {
  buildPlugins.push(
    terser(),
    filesize({
      showBrotliSize: true,
    })
  );
}

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
  plugins: buildPlugins,
};
