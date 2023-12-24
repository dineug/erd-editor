import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import rHtml from '@dineug/vite-plugin-r-html';
import typescript from '@rollup/plugin-typescript';
import { visualizer } from 'rollup-plugin-visualizer';
// @ts-ignore
import tspCompiler from 'ts-patch/compiler';
import { defineConfig, loadEnv } from 'vite';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

export default defineConfig(({ command, mode }) => {
  const envDir = './environment';
  const env = loadEnv(mode, envDir);
  const isServe = command === 'serve';
  const isBuild = command === 'build';
  const isLib = env.VITE_TARGET === 'lib';

  return {
    envDir,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    build: {
      lib: {
        entry: './src/index.ts',
        name: pkg.name,
        fileName: format =>
          format === 'es' ? 'erd-editor.js' : 'erd-editor.min.js',
        formats: ['es', 'umd'],
      },
      rollupOptions: {
        output: {
          banner,
        },
      },
    },
    resolve: {
      alias: {
        '@': join(__dirname, 'src'),
      },
    },
    plugins: [
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
    server: {
      open: true,
    },
  };
});
