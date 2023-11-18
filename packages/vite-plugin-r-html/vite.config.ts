// @ts-ignore
import { readFileSync } from 'node:fs';

import typescript from '@rollup/plugin-typescript';
import { visualizer } from 'rollup-plugin-visualizer';
// @ts-ignore
import tspCompiler from 'ts-patch/compiler';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

export default defineConfig({
  build: {
    minify: false,
    lib: {
      entry: './src/index.ts',
      name: pkg.name,
      fileName: 'vite-plugin-r-html',
      formats: ['cjs'],
    },
    rollupOptions: {
      output: {
        banner,
      },
      external: ['@babel/core', 'path'],
    },
  },
  plugins: [
    tsconfigPaths(),
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
