// @ts-ignore
import { readFileSync } from 'node:fs';

import rHtml from '@dineug/vite-plugin-r-html';
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

export default defineConfig(({ command }) => {
  const isServe = command === 'serve';

  return {
    build: {
      lib: {
        entry: './src/index.ts',
        name: pkg.name,
        fileName: 'erd-editor',
        formats: ['es', 'umd'],
      },
      rollupOptions: {
        output: {
          banner,
        },
      },
    },
    plugins: [
      tsconfigPaths(),
      isServe && rHtml(),
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
    ].filter(Boolean),
    server: {
      open: true,
    },
  };
});
