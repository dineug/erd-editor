import { readFileSync } from 'node:fs';

import strip from '@rollup/plugin-strip';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      ...(isBuild ? {'process.env.NODE_ENV': JSON.stringify('production')} : {}),
    },
    build: {
      lib: {
        entry: './src/index.ts',
        name: pkg.name,
        fileName: 'vuerd',
        formats: ['es'],
      },
    },
    resolve: {
      dedupe: ['lit-html']
    },
    plugins: [
      tsconfigPaths(),
      isBuild && strip({
        debugger: true,
        include: '**/*.ts',
        functions: ['Logger.debug', 'Logger.log', 'console.log'],
      })
    ].filter(Boolean),
    server: {
      open: true,
    },
  }
});
