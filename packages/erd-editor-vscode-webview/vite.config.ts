import { join } from 'node:path';

import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const envDir = './environment';
  const env = loadEnv(mode, envDir);

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
    legacy: {
      entry: './src/legacy/index.ts',
      name: 'webview',
      fileName: () => 'webview.js',
      outDir: '../erd-editor-vscode/public-legacy',
      emptyOutDir: true,
    },
    'legacy-lazy': {
      entry: './src/legacy/lazy.ts',
      name: 'lazy',
      fileName: () => 'lazy.js',
      outDir: '../erd-editor-vscode/public-legacy',
      emptyOutDir: false,
    },
  };

  const entry = targetMap[env.VITE_TARGET].entry;
  const name = targetMap[env.VITE_TARGET].name;
  const fileName = targetMap[env.VITE_TARGET].fileName;
  const outDir = targetMap[env.VITE_TARGET].outDir;
  const emptyOutDir = targetMap[env.VITE_TARGET].emptyOutDir;
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
