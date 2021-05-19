import pkg from './package.json';
import config from './rollup.config.common';
import strip from '@rollup/plugin-strip';
import visualizer from 'rollup-plugin-visualizer';
import replace from '@rollup/plugin-replace';
import filesize from 'rollup-plugin-filesize';
import { terser } from 'rollup-plugin-terser';

const { plugins, banner, onwarn } = config();

export default {
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
    visualizer({
      filename: './dist/stats.html',
    }),
    filesize({
      showBrotliSize: true,
    }),
  ],
  onwarn,
};