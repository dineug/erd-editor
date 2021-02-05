import pkg from './package.json';
import config from './rollup.config.common';
import strip from '@rollup/plugin-strip';
import { terser } from 'rollup-plugin-terser';

const { plugins, banner } = config();

export default [
  {
    input: 'src/ts/index.ts',
    output: [
      {
        name: 'vuerd',
        file: `../static/${pkg.browser}`,
        format: 'umd',
        banner,
        plugins: [terser()],
      },
    ],
    plugins: [
      strip({
        debugger: true,
        include: '**/*.ts',
        functions: ['Logger.debug', 'Logger.log'],
      }),
      ...plugins,
    ],
  },
];
