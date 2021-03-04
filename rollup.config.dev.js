import pkg from './package.json';
import config from './rollup.config.common';
import html from 'rollup-plugin-generate-html-template';
import browsersync from 'rollup-plugin-browsersync';
import replace from '@rollup/plugin-replace';

const { plugins, banner, onwarn } = config();

export default {
  input: 'src/index.dev.ts',
  output: {
    name: 'vuerd',
    file: pkg.main,
    format: 'umd',
    banner,
  },
  plugins: [
    replace({
      'process.env.NODE_ENV': JSON.stringify('development'),
      'import.meta.env.SNOWPACK_PUBLIC_VUERD_VERSION': JSON.stringify(
        pkg.version
      ),
    }),
    ...plugins,
    html({
      template: 'public/index.rollup.html',
      target: 'dist/index.html',
    }),
    browsersync({ server: 'dist', open: true, port: 8090 }),
  ],
  onwarn,
};
