import replace from '@rollup/plugin-replace';
import strip from '@rollup/plugin-strip';
import { terser } from 'rollup-plugin-terser';

import pkg from './package.json';
import config from './rollup.config.common';

const { plugins, banner } = config();

export default {
  input: 'src/index.ts',
  output: {
    name: pkg.name,
    file: `../vuerd-vscode/static/generate-template.min.js`,
    format: 'umd',
    banner,
    plugins: [terser()],
  },
  plugins: [
    strip({
      debugger: true,
      include: '**/*.tsx',
      functions: ['Logger.debug', 'Logger.log', 'console.log'],
    }),
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify('production'),
    }),
    ...plugins,
  ],
  external: ['vuerd'],
};
