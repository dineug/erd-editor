import { readFileSync } from 'node:fs';

import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: pkg.name,
      fileName: 'generate-template',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vuerd'],
    },
  },
  plugins: [tsconfigPaths(), preact()],
  server: {
    open: true,
  },
});
