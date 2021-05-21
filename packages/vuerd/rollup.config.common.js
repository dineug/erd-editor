import pkg from './package.json';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

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
