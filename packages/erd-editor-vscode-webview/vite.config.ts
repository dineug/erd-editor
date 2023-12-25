import { join } from 'node:path';

import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const envDir = './environment';
  const env = loadEnv(mode, envDir);
  const isModern = env.VITE_TARGET === 'modern';
  const entry = isModern ? './src/index.ts' : './src/index-legacy.ts';
  const outDir = '../erd-editor-vscode/'.concat(
    isModern ? 'public' : 'public-legacy'
  );
  const isBuild = command === 'build';

  return {
    envDir,
    define: {
      ...(isBuild
        ? { 'process.env.NODE_ENV': JSON.stringify('production') }
        : {}),
    },
    build: {
      lib: {
        entry,
        name: 'webview',
        fileName: () => 'webview.js',
        formats: ['iife'],
      },
      outDir,
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': join(__dirname, 'src'),
      },
    },
  };
});
