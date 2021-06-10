import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

import pkg from './package.json';

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

function onwarn(warning) {
  if (warning.code === 'CIRCULAR_DEPENDENCY') return;
  console.warn(`(!) ${warning.message}`);
}

export default function config() {
  return {
    plugins: [
      resolve({
        dedupe: ['lit-html'],
      }),
      commonjs(),
      typescript(),
    ],
    banner,
    onwarn,
  };
}
