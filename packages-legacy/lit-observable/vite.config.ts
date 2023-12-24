import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: pkg.name,
      fileName: 'lit-observable',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['lit-html'],
    },
  },
  resolve: {
    alias: {
      '@': join(__dirname, 'src'),
    },
  },
  server: {
    open: true,
  },
});
