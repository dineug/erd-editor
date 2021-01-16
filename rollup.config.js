import pkg from './package.json';
import config from './rollup.config.common';
import strip from '@rollup/plugin-strip';
import visualizer from 'rollup-plugin-visualizer';
import { terser } from 'rollup-plugin-terser';

const { plugins, banner } = config();

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: pkg.module,
        format: 'es',
        banner,
      },
      {
        name: 'vuerd',
        file: pkg.main,
        format: 'umd',
        banner,
      },
      {
        name: 'vuerd',
        file: pkg.browser,
        format: 'umd',
        banner,
        plugins: [terser()],
      },
    ],
    plugins: [
      strip({
        debugger: true,
        include: '**/*.ts',
        functions: ['Logger.debug'],
      }),
      ...plugins,
      visualizer({
        filename: './dist/stats.html',
      }),
    ],
  },
];
