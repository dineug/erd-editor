import { join } from 'node:path';

import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: ['./src/index.ts'],
      formats: ['es'],
    },
  },
  resolve: {
    alias: {
      '@': join(__dirname, 'src'),
    },
  },
  plugins: [
    dts({ compilerOptions: { declarationMap: true } }),
    typescript({ noEmitOnError: true, noForceEmit: true }),
  ],
});
