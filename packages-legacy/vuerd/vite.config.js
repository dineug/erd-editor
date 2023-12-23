import { readFileSync } from 'node:fs';

import strip from '@rollup/plugin-strip';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      ...(isBuild
        ? { 'process.env.NODE_ENV': JSON.stringify('production') }
        : {}),
    },
    build: {
      lib: {
        entry: './src/index.ts',
        name: pkg.name,
        fileName: format => (format === 'es' ? 'vuerd.js' : 'vuerd.min.js'),
        formats: ['es', 'umd'],
      },
      rollupOptions: {
        output: {
          banner,
        },
      },
    },
    resolve: {
      dedupe: ['lit-html'],
    },
    plugins: [
      tsconfigPaths(),
      isBuild &&
        strip({
          debugger: true,
          include: '**/*.ts',
          functions: ['Logger.debug', 'Logger.log', 'console.log'],
        }),
    ].filter(Boolean),
    server: {
      open: true,
    },
  };
});
