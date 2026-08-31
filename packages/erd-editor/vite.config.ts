import { join } from 'node:path';

import { defineConfig, lazyPlugins } from 'vite-plus';
import dts from 'vite-plugin-dts';
import { BROWSER_TARGET } from '../../build-target';
import { createLibraryTasks } from '../../tools/vite/library-config.ts';
import {
  createBanner,
  loadLibraryMetadata,
} from '../../tools/vite/package-metadata.ts';

const packageDir = import.meta.dirname;
const { manifest } = loadLibraryMetadata(packageDir);
const banner = createBanner(manifest);
const rHtmlPackage: string = '@dineug/vite-plugin-r-html';

export default defineConfig({
  run: {
    tasks: createLibraryTasks(packageDir),
  },
  define: {
    __APP_VERSION__: JSON.stringify(manifest.version),
  },
  build: {
    // 공개 라이브러리의 하한은 한 곳에서 온다 — 루트 build-target.ts.
    target: BROWSER_TARGET,
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
  // Task metadata resolves before workspace dependencies are built on a clean
  // checkout, so loading r-html's generated entry here would make that graph
  // impossible. dts stays eager because Storybook removes it from its copy.
  plugins: [
    lazyPlugins(async () => {
      const { rHtml } = await import(rHtmlPackage);
      return [rHtml({ jsx: { konvaImportSource: '@/konva/host' } })];
    }),
    dts({ tsconfigPath: './tsconfig.build.json' }),
  ],
});
