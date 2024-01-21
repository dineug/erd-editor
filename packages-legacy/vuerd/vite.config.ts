import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import strip from '@rollup/plugin-strip';
import { defineConfig } from 'vite';

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
        fileName: pkg.name,
        formats: ['es'],
      },
      rollupOptions: {
        output: {
          banner,
        },
      },
    },
    resolve: {
      alias: {
        '@': join(__dirname, 'src'),
      },
      dedupe: ['lit-html'],
    },
    plugins: [
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
