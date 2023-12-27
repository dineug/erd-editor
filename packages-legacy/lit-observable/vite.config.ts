import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

const external = new RegExp(
  `^(${Object.keys(pkg.dependencies || {}).join('|')})$`
);

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      fileName: 'lit-observable',
      formats: ['es'],
    },
    rollupOptions: {
      external,
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
