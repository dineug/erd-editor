import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { rHtml } from '@dineug/vite-plugin-r-html';
import { defineConfig } from 'vite-plus';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));

export default defineConfig({
  // Vitest does not read vite.config.ts, so the JSX transform repeats here or a
  // .tsx spec reaches oxc with its JSX intact. The HMR half is off: it would
  // switch on state recording in every component the specs never asked for.
  plugins: [rHtml({ refresh: false })],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@': join(import.meta.dirname, 'src'),
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/**/*.stories.{ts,tsx}',
        'src/internal-types/**',
        'src/__test-utils__/**',
        'src/**/*.worker.ts',
      ],
      thresholds: {
        perFile: true,
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
