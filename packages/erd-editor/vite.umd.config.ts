import { join } from 'node:path';

import { defineConfig, lazyPlugins } from 'vite-plus';
import { BROWSER_TARGET } from '../../build-target';
import { base64InlineWorkers } from '../../tools/vite/inline-worker.ts';
import { loadLibraryMetadata } from '../../tools/vite/package-metadata.ts';

const packageDir = import.meta.dirname;
const { manifest } = loadLibraryMetadata(packageDir);
const rHtmlPackage: string = '@dineug/vite-plugin-r-html';
const rHtmlPlugins = lazyPlugins(async () => {
  const { rHtml } = await import(rHtmlPackage);
  return [rHtml({ jsx: { konvaImportSource: '@dineug/r-html-konva' } })];
});

/**
 * The two script-tag bundles: the build task runs the editor's after the es
 * build, then the viewer's under --mode viewer, as a umd build takes one entry.
 */
const UMD_BUILDS = {
  editor: {
    entry: './src/umd/erd-editor.umd.ts',
    name: 'ErdEditor',
    fileName: 'erd-editor.umd.js',
  },
  viewer: {
    entry: './src/umd/erd-viewer.umd.ts',
    name: 'ErdViewer',
    fileName: 'erd-viewer.umd.js',
  },
} as const;

// Each is one file with every dependency inside: window.ErdEditor with the
// three shared workers, or window.ErdViewer, which reaches none of them. The
// exports map never points here; a bundler takes the es modules instead.
export default defineConfig(({ mode }) => {
  const umd = mode === 'viewer' ? UMD_BUILDS.viewer : UMD_BUILDS.editor;

  return {
    define: {
      __APP_VERSION__: JSON.stringify(manifest.version),
    },
    build: {
      target: BROWSER_TARGET,
      // The es build owns dist and has already written it.
      emptyOutDir: false,
      lib: {
        entry: umd.entry,
        name: umd.name,
        formats: ['umd'],
        fileName: () => umd.fileName,
      },
    },
    worker: {
      plugins: () => [rHtmlPlugins],
    },
    resolve: {
      // The spawn alias goes first: alias entries match in order, and the bare
      // @ entry would otherwise claim these specifiers too.
      alias: [
        {
          find: /^@\/workers\/(\w+)\.spawn$/,
          replacement: join(packageDir, 'src/workers/$1.spawn.inline.ts'),
        },
        { find: '@', replacement: join(packageDir, 'src') },
      ],
    },
    plugins: [rHtmlPlugins, base64InlineWorkers()],
  };
});
