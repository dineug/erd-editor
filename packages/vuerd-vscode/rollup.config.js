import pkg from './package.json';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

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
  plugins: [resolve(), commonjs(), typescript()],
};
