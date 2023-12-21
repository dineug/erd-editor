import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'webview',
      fileName: 'webview',
      formats: ['iife'],
    },
    outDir: '../erd-editor-vscode/public',
  },
  plugins: [tsconfigPaths()],
});
