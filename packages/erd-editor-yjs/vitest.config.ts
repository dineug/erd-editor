import { join } from 'node:path';

import {
  defaultExclude,
  defineConfig,
  type UserWorkspaceConfig,
} from 'vite-plus';
import { playwright } from 'vite-plus/test/browser-playwright';

const browserSpecs = 'src/**/*.browser.test.ts';

/** Both projects' alias, and one copy of yjs, since two break each other's constructor checks. */
const createSharedConfig = (): UserWorkspaceConfig => ({
  resolve: {
    alias: {
      '@': join(import.meta.dirname, 'src'),
    },
    dedupe: ['yjs'],
  },
});

export default defineConfig({
  test: {
    projects: [
      {
        ...createSharedConfig(),
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
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
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/__test-utils__/**',
        // The dev page vp dev serves, which no build ships and no spec mounts.
        'src/index.dev.ts',
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
