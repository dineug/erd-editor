import { join } from 'node:path';

import { defineConfig, lazyPlugins } from 'vite-plus';
import dts from 'vite-plugin-dts';
import { BROWSER_TARGET } from '../../build-target';
import {
  createLibraryTasks,
  createWorkerOptions,
} from '../../tools/vite/library-config.ts';
import {
  createExternal,
  loadLibraryMetadata,
} from '../../tools/vite/package-metadata.ts';
import { libraryWorkerUrls } from '../../tools/vite/worker-url.ts';

const packageDir = import.meta.dirname;
const { manifest } = loadLibraryMetadata(packageDir);
const external = createExternal(manifest);

export default defineConfig({
  run: {
    tasks: createLibraryTasks(packageDir, {
      build: ['vp build -c vite.umd.config.ts'],
    }),
  },
  define: {
    __APP_VERSION__: JSON.stringify(manifest.version),
  },
  build: {
    // 공개 라이브러리의 하한은 한 곳에서 온다 — 루트 build-target.ts.
    target: BROWSER_TARGET,
    lib: {
      entry: { index: './src/index.ts' },
      formats: ['es'],
    },
    rolldownOptions: {
      // Every dependencies entry stays a bare import for the consumer's bundler
      // to resolve; shiki and its grammars are among them now that the worker
      // is a file of its own rather than a data URL.
      external,
    },
  },
  worker: createWorkerOptions(external),
  resolve: {
    alias: {
      '@': join(import.meta.dirname, 'src'),
    },
  },
  plugins: lazyPlugins(() => [
    dts({ compilerOptions: { declarationMap: true } }),
    libraryWorkerUrls(),
  ]),
});
