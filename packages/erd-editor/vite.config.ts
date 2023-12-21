import { readFileSync } from 'node:fs';

import rHtml from '@dineug/vite-plugin-r-html';
import typescript from '@rollup/plugin-typescript';
import { visualizer } from 'rollup-plugin-visualizer';
import tspCompiler from 'ts-patch/compiler';
import { defineConfig, loadEnv } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

export default defineConfig(({ command, mode }) => {
  const envDir = './environment';
  process.env = {
    ...process.env,
    ...loadEnv(mode, envDir),
  };
  const isServe = command === 'serve';
  const isBuild = command === 'build';
  const isLib = process.env.VITE_TARGET === 'lib';

  return {
    envDir,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
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
      isLib && isServe && rHtml(),
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
    worker: {
      plugins: () => [tsconfigPaths()],
    },
    server: {
      open: true,
    },
  };
});
