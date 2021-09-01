import replace from '@rollup/plugin-replace';
import strip from '@rollup/plugin-strip';
import { terser } from 'rollup-plugin-terser';

import pkg from './package.json';
import config from './rollup.config.common';

const { plugins, banner, onwarn } = config();

const isProd = process.env.NODE_ENV === 'production';

const buildPlugins = [
  replace({
    preventAssignment: true,
    'process.env.NODE_ENV': JSON.stringify(
      isProd ? 'production' : 'development'
    ),
    'import.meta.env.VITE_VUERD_VERSION': JSON.stringify(pkg.version),
  }),
  ...plugins,
];

if (isProd) {
  buildPlugins.unshift(
    strip({
      debugger: true,
      include: '**/*.ts',
      functions: ['Logger.debug', 'Logger.log', 'console.log'],
    })
  );
  buildPlugins.push(terser());
}

export default {
  input: 'src/index.ts',
  output: {
    name: 'vuerd',
    file: `../vuerd-vscode/static/vuerd.min.js`,
    format: 'umd',
    banner,
  },
  plugins: buildPlugins,
  onwarn,
};
