import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import typescript from '@rollup/plugin-typescript';
import { visualizer } from 'rollup-plugin-visualizer';
// @ts-ignore
import tspCompiler from 'ts-patch/compiler';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

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
