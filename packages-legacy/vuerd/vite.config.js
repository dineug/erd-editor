import { readFileSync } from 'node:fs';

import strip from '@rollup/plugin-strip';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
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
    strip({
      debugger: true,
      include: '**/*.ts',
      functions: ['Logger.debug', 'Logger.log', 'console.log'],
    })
  ],
  server: {
    open: true,
  },
});
