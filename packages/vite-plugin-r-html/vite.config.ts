import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import typescript from '@rollup/plugin-typescript';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

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
  resolve: {
    alias: {
      '@': join(__dirname, 'src'),
    },
  },
  plugins: [
    visualizer({ filename: './dist/stats.html' }),
    dts(),
    typescript({ noEmitOnError: true }),
  ],
  server: {
    open: true,
  },
});
