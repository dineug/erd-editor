import { join } from 'node:path';

import { rHtml } from '@dineug/vite-plugin-r-html';
import {
  defaultExclude,
  defineConfig,
  type UserWorkspaceConfig,
} from 'vite-plus';
import { playwright } from 'vite-plus/test/browser-playwright';

const browserSpecs = 'src/**/*.browser.test.{ts,tsx}';

/**
 * What both projects carry, since each extends this file for its projects and
 * coverage alone. A konva-host file compiles its tags against the host package
 * by name, the specifier vite.config.ts hands the build.
 */
const createSharedConfig = (): UserWorkspaceConfig => ({
  plugins: [
    rHtml({
      jsx: { konvaImportSource: '@dineug/r-html-konva' },
      refresh: false,
    }),
  ],
  resolve: {
    alias: {
      '@': join(import.meta.dirname, 'src'),
    },
  },
});

export default defineConfig({
  test: {
    projects: [
      {
        ...createSharedConfig(),
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          // A browser spec matches the unit glob too, so the split lives here,
          // and spreading the default keeps node_modules and .git out.
          exclude: [...defaultExclude, browserSpecs],
          environment: 'happy-dom',
        },
      },
      {
        ...createSharedConfig(),
        test: {
          name: 'browser',
          include: [browserSpecs],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            headless: true,
          },
        },
      },
    ],
    // Coverage is a root-only option, so this one block spans both projects.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.test-d.ts',
        'src/**/*.d.ts',
        'src/__test-utils__/**',
        // The demo page vp dev serves, which no build ships and no spec mounts.
        'src/index.dev.ts',
        // Types only; every line is erased before a runtime could execute it.
        'src/model/types.ts',
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
