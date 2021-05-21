import pkg from './package.json';
import config from './rollup.config.common';
import visualizer from 'rollup-plugin-visualizer';
import filesize from 'rollup-plugin-filesize';
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
        name: pkg.name,
        file: pkg.main,
        format: 'umd',
        banner,
      },
      {
        name: pkg.name,
        file: pkg.browser,
        format: 'umd',
        banner,
        plugins: [terser()],
      },
    ],
    plugins: [
      ...plugins,
      visualizer({
        filename: './dist/stats.html',
      }),
      filesize({
        showBrotliSize: true,
      }),
    ],
    external: ['vuerd'],
  },
];
