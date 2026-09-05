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
const rHtmlPackage: string = '@dineug/vite-plugin-r-html';

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
      // A key is the output path under dist, so each entry lands beside its
      // declarations and the exports map names one place per entry.
      entry: {
        index: './src/index.ts',
        'engine/index': './src/engine/index.ts',
      },
      formats: ['es'],
    },
    rolldownOptions: {
      // Runtime dependencies stay bare imports for the consumer's bundler to
      // resolve, dedupe and tree-shake by their own sideEffects fields. The
      // four private workspace libraries are not on npm, so they still inline.
      external,
    },
  },
  resolve: {
    alias: {
      '@': join(import.meta.dirname, 'src'),
    },
  },
  // A worker entry is bundled by a pass of its own, inheriting no plugin from
  // the block below. The export worker pulls the scene, which is jsx, so left
  // out this build dies on the first tsx module that pass reaches.
  worker: {
    ...createWorkerOptions(external),
    plugins: () => [
      lazyPlugins(async () => {
        const { rHtml } = await import(rHtmlPackage);
        return [rHtml({ jsx: { konvaImportSource: '@/konva/host' } })];
      }),
    ],
  },
  // Task metadata resolves before workspace dependencies are built on a clean
  // checkout, so loading r-html's generated entry here would make that graph
  // impossible. dts stays eager because Storybook removes it from its copy.
  plugins: [
    lazyPlugins(async () => {
      const { rHtml } = await import(rHtmlPackage);
      return [rHtml({ jsx: { konvaImportSource: '@/konva/host' } })];
    }),
    dts({
      tsconfigPath: './tsconfig.build.json',
      compilerOptions: { declarationMap: true },
    }),
    libraryWorkerUrls(),
  ],
});
