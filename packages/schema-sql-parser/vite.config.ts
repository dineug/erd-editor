/// <reference types="vitest" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import typescript from '@rollup/plugin-typescript';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, loadEnv } from 'vite';
import dts from 'vite-plugin-dts';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

export default defineConfig(({ command, mode }) => {
  const envDir = './environment';
  const env = loadEnv(mode, envDir);
  const isBuild = command === 'build';
  const isLib = env.VITE_TARGET === 'lib';

  return {
    envDir,
    build: {
      lib: {
        entry: './src/index.ts',
        fileName: 'schema-sql-parser',
        formats: ['es'],
      },
    },
    resolve: {
      alias: {
        '@': join(__dirname, 'src'),
      },
    },
    plugins: [
      isLib && visualizer({ filename: './dist/stats.html' }),
      isLib && isBuild && dts(),
      isLib && isBuild && typescript({ noEmitOnError: true }),
    ].filter(Boolean),
    server: {
      open: true,
    },
  };
});
