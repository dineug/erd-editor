import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import rHtml from '@dineug/vite-plugin-r-html';
import typescript from '@rollup/plugin-typescript';
import { defineConfig, loadEnv } from 'vite';
import dts from 'vite-plugin-dts';

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
        entry: {
          'erd-editor': './src/index.ts',
          engine: './src/engine/index.ts',
        },
        formats: ['es'],
      },
      rolldownOptions: {
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
      isLib && isServe && rHtml(),
      isLib && isBuild && dts({ tsconfigPath: './tsconfig.build.json' }),
      isLib &&
        isBuild &&
        typescript({
          tsconfig: './tsconfig.build.json',
          noEmitOnError: true,
          noForceEmit: true,
        }),
    ].filter(Boolean),
    server: {
      // The Playwright `webServer` starts this same command; opening a browser
      // there would race the run.
      open: !process.env.E2E,
    },
  };
});
