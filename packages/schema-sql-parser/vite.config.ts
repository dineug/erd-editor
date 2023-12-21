import { readFileSync } from 'node:fs';

import typescript from '@rollup/plugin-typescript';
import { visualizer } from 'rollup-plugin-visualizer';
import tspCompiler from 'ts-patch/compiler';
import { loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

export default defineConfig(({ command, mode }) => {
  const envDir = './environment';
  process.env = { ...process.env, ...loadEnv(mode, envDir) };
  const isBuild = command === 'build';
  const isLib = process.env.VITE_TARGET === 'lib';

  return {
    envDir,
    build: {
      lib: {
        entry: './src/index.ts',
        name: pkg.name,
        fileName: 'schema-sql-parser',
        formats: ['es'],
      },
    },
    plugins: [
      tsconfigPaths(),
      isLib && visualizer({ filename: './dist/stats.html' }),
      isLib &&
        isBuild &&
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
    ].filter(Boolean),
    server: {
      open: true,
    },
  };
});
