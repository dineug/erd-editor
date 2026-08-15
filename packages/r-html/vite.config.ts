import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import typescript from '@rollup/plugin-typescript';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

/**
 * Runtime dependencies stay out of the bundle. Vite's library mode does not externalize them on
 * its own, so without this every consumer that bundles `dist/` would inline its own copy.
 * Derived from `package.json` so a new dependency is externalized without touching this file.
 */
const external = Object.keys(pkg.dependencies ?? {});

export default defineConfig({
  build: {
    lib: {
      entry: ['./src/index.ts'],
      formats: ['es'],
    },
    rolldownOptions: {
      external,
      output: {
        banner,
      },
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
  server: {
    open: true,
  },
});
