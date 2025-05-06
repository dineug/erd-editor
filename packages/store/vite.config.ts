/// <reference types="vitest" />
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

const external = new RegExp(
  `^(${Object.keys({
    ...pkg.peerDependencies,
    ...pkg.dependencies,
  }).join('|')})$`
);

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';

  return {
    build: {
      lib: {
        entry: ['./src/index.ts'],
        formats: ['es'],
      },
      rollupOptions: {
        external,
        output: { banner },
      },
    },
    resolve: {
      alias: {
        '@': join(__dirname, 'src'),
      },
    },
    plugins: [
      isBuild &&
        dts({
          compilerOptions: { declarationMap: true },
          exclude: ['src/**/*.test.ts'],
        }),
      isBuild &&
        typescript({
          noEmitOnError: true,
          noForceEmit: true,
          exclude: ['src/**/*.test.ts'],
        }),
    ].filter(Boolean),
  };
});
