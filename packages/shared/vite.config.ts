import { join } from 'node:path';

import typescript from '@rollup/plugin-typescript';
import { defineConfig, lazyPlugins } from 'vite-plus';
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
      '@': join(import.meta.dirname, 'src'),
    },
  },
  plugins: lazyPlugins(() => [
    dts({
      tsconfigPath: './tsconfig.build.json',
      compilerOptions: { declarationMap: true },
    }),
    typescript({
      tsconfig: './tsconfig.build.json',
      noEmitOnError: true,
      noForceEmit: true,
    }),
  ]),
});
