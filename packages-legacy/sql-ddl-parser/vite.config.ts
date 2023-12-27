import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      fileName: 'sql-ddl-parser',
      formats: ['es'],
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
