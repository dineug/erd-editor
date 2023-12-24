import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import typescript from '@rollup/plugin-typescript';
import { visualizer } from 'rollup-plugin-visualizer';
import tspCompiler from 'ts-patch/compiler';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: pkg.name,
      fileName: 'shared',
      formats: ['es'],
    },
  },
  resolve: {
    alias: {
      '@': join(__dirname, 'src'),
    },
  },
  plugins: [
    visualizer({ filename: './dist/stats.html' }),
    typescript({
      typescript: tspCompiler,
      noEmitOnError: true,
      compilerOptions: {
        declaration: true,
        outDir: './dist',
        plugins: [
          {
            transform: 'typescript-transform-paths',
            afterDeclarations: true,
          },
        ],
      },
    }),
  ],
  server: {
    open: true,
  },
});
