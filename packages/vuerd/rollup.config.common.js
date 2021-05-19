import pkg from './package.json';
import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { eslint } from 'rollup-plugin-eslint';

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
    plugins: [resolve(), commonjs(), eslint('./.eslintrc.json'), typescript()],
    banner,
    onwarn,
  };
}
