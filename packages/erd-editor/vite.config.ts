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
      build: [
        'vp build -c vite.umd.config.ts',
        'vp build -c vite.umd.config.ts --mode viewer',
      ],
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
        'erd-editor': './src/erd-editor.ts',
        'erd-viewer': './src/erd-viewer.ts',
        'engine/index': './src/engine/index.ts',
        'peer/index': './src/peer/index.ts',
      },
      formats: ['es'],
    },
    // One file per module, unminified, so a consumer prunes by the package's
    // sideEffects list and minifies once, as with the private libraries.
    minify: false,
    rolldownOptions: {
      // Runtime dependencies stay bare imports for the consumer's bundler to
      // resolve, dedupe and tree-shake by their own sideEffects fields. The
      // private workspace libraries are not on npm, so they still inline.
      external,
      output: {
        preserveModules: true,
        preserveModulesRoot: join(packageDir, 'src'),
        // The declarations keep the JSDoc. pnpm peer-graph reads this text, so
        // only the pure annotations a consumer prunes by and licences stay.
        comments: { jsdoc: false, annotation: true, legal: true },
      },
    },
  },
  resolve: {
    alias: {
      '@': join(import.meta.dirname, 'src'),
    },
  },
  // ELK is a commonjs bundle a browser cannot load as it stands, so a dev
  // server pre-bundles it. Named here rather than discovered, because Vite's
  // scanner does not walk a worker entry and a discovery mid-page reloads it.
  optimizeDeps: {
    include: ['elkjs/lib/elk.bundled.js'],
  },
  // A worker entry is bundled by a pass of its own, inheriting no plugin from
  // the block below. The export worker pulls the scene, which is jsx, so left
  // out this build dies on the first tsx module that pass reaches.
  worker: {
    ...createWorkerOptions(external),
    plugins: () => [
      lazyPlugins(async () => {
        const { rHtml } = await import(rHtmlPackage);
        return [rHtml({ jsx: { konvaImportSource: '@dineug/r-html-konva' } })];
      }),
    ],
  },
  // Task metadata resolves before workspace dependencies are built on a clean
  // checkout, so loading r-html's generated entry here would make that graph
  // impossible. dts stays eager because Storybook removes it from its copy.
  plugins: [
    lazyPlugins(async () => {
      const { rHtml } = await import(rHtmlPackage);
      return [rHtml({ jsx: { konvaImportSource: '@dineug/r-html-konva' } })];
    }),
    dts({
      tsconfigPath: './tsconfig.build.json',
      compilerOptions: { declarationMap: true },
    }),
    libraryWorkerUrls(),
  ],
});
