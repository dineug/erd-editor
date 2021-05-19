import pkg from './package.json';
import config from './rollup.config.common';
import strip from '@rollup/plugin-strip';
import replace from '@rollup/plugin-replace';
import { terser } from 'rollup-plugin-terser';

const { plugins, banner, onwarn } = config();

export default {
  input: 'src/index.ts',
  output: {
    name: 'vuerd',
    file: `../vuerd-vscode/static/vuerd.min.js`,
    format: 'umd',
    banner,
    plugins: [terser()],
  },
  plugins: [
    strip({
      debugger: true,
      include: '**/*.ts',
      functions: ['Logger.debug', 'Logger.log'],
    }),
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify('production'),
      'import.meta.env.SNOWPACK_PUBLIC_VUERD_VERSION': JSON.stringify(
        pkg.version
      ),
    }),
    ...plugins,
  ],
  onwarn,
};
