import { join } from 'node:path';

import { defineConfig } from 'vite-plus';
import { BROWSER_TARGET } from '../../build-target';
import { base64InlineWorkers } from '../../tools/vite/inline-worker.ts';
import { loadLibraryMetadata } from '../../tools/vite/package-metadata.ts';

const packageDir = import.meta.dirname;
const { manifest } = loadLibraryMetadata(packageDir);

// The script-tag build, run after the es one by the build task: one file with
// shiki, the grammars and the worker inside, exposed as
// window.ErdEditorShikiWorker. The exports map never points here.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(manifest.version),
  },
  build: {
    target: BROWSER_TARGET,
    emptyOutDir: false,
    lib: {
      entry: './src/index.ts',
      name: 'ErdEditorShikiWorker',
      formats: ['umd'],
      fileName: () => 'erd-editor-shiki-worker.umd.js',
    },
  },
  resolve: {
    alias: [
      {
        find: './spawn',
        replacement: join(packageDir, 'src/services/spawn.inline.ts'),
      },
      { find: '@', replacement: join(packageDir, 'src') },
    ],
  },
  plugins: [base64InlineWorkers()],
});
