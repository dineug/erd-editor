import pkg from './package.json';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

export default function config() {
  return {
    plugins: [
      alias({
        entries: [
          { find: 'react', replacement: 'preact/compat' },
          { find: 'react-dom', replacement: 'preact/compat' },
        ],
      }),
      resolve(),
      commonjs(),
      typescript(),
    ],
    banner,
  };
}
