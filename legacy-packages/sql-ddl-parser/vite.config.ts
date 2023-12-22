import { readFileSync } from 'node:fs';

import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: pkg.name,
      fileName: 'sql-ddl-parser',
      formats: ['es'],
    },
  },
  plugins: [tsconfigPaths()],
  server: {
    open: true,
  },
});
