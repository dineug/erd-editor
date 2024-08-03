import { join } from 'node:path';

import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const envDir = './environment';
  const env = loadEnv(mode, envDir);
  const target = env.VITE_TARGET;

  const targetMap = {
    modern: {
      entry: './src/index.ts',
      name: 'webview',
      fileName: () => 'webview.js',
      outDir: '../erd-editor-vscode/public',
      emptyOutDir: true,
    },
    'modern-lazy': {
      entry: './src/lazy.ts',
      name: 'lazy',
      fileName: () => 'lazy.js',
      outDir: '../erd-editor-vscode/public',
      emptyOutDir: false,
    },
  };

  const entry = targetMap[target].entry;
  const name = targetMap[target].name;
  const fileName = targetMap[target].fileName;
  const outDir = targetMap[target].outDir;
  const emptyOutDir = targetMap[target].emptyOutDir;
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
        name,
        fileName,
        formats: ['iife'],
      },
      outDir,
      emptyOutDir,
    },
    resolve: {
      alias: {
        '@': join(__dirname, 'src'),
      },
    },
  };
});
