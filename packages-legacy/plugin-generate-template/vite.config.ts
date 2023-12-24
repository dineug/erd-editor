import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';

  return {
    define: {
      ...(isBuild
        ? { 'process.env.NODE_ENV': JSON.stringify('production') }
        : {}),
    },
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
    resolve: {
      alias: {
        '@': join(__dirname, 'src'),
      },
    },
    plugins: [preact()],
    server: {
      open: true,
    },
  };
});
