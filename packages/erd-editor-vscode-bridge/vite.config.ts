import { join } from 'node:path';

import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      fileName: 'index',
      formats: ['es'],
    },
  },
  resolve: {
    alias: {
      '@': join(__dirname, 'src'),
    },
  },
  plugins: [dts(), typescript({ noEmitOnError: true })],
});
