import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

const banner = `/*!
 * ${pkg.name}
 * @version ${pkg.version} | ${new Date().toDateString()}
 * @author ${pkg.author}
 * @license ${pkg.license}
 */`;

const external = new RegExp(
  `^(${Object.keys(pkg.dependencies || {}).join('|')})$`
);

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';

  return {
    define: {
      ...(isBuild
        ? { 'process.env.NODE_ENV': JSON.stringify('production') }
        : {}),
    },
    build: {
      lib: {
        entry: './src/index.ts',
        fileName: 'generate-template',
        formats: ['es'],
      },
      rollupOptions: {
        external: [external, /^highlight.js\/lib/],
        output: {
          banner,
        },
      },
    },
    resolve: {
      alias: {
        '@': join(__dirname, 'src'),
      },
    },
    plugins: [preact()],
    server: {
      open: true,
    },
  };
});
