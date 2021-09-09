import vue from '@vitejs/plugin-vue';
import path from 'path';
import { defineConfig } from 'vite';
import WindiCSS from 'vite-plugin-windicss';

const resolvePath = (p: string) => path.resolve(__dirname, `./${p}`);

export default defineConfig({
  envDir: resolvePath('environment'),
  resolve: {
    alias: {
      '@': resolvePath('src'),
    },
  },
  plugins: [WindiCSS(), vue()],
  server: {
    open: true,
  },
});
