import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

const external = new RegExp(
  `^(${Object.keys({
    ...pkg.peerDependencies,
    ...pkg.dependencies,
  }).join('|')})(?:/.+)*$`
);

export default defineConfig({
  build: {
    lib: {
      entry: ['./src/index.ts'],
      formats: ['es'],
    },
    rolldownOptions: {
      external,
    },
  },
  resolve: {
    alias: {
      '@': join(import.meta.dirname, 'src'),
    },
  },
  plugins: [
    dts({
      tsconfigPath: './tsconfig.build.json',
      compilerOptions: { declarationMap: true },
    }),
    typescript({
      tsconfig: './tsconfig.build.json',
      noEmitOnError: true,
      noForceEmit: true,
    }),
  ],
});
