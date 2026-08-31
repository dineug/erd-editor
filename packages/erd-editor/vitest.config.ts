import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { rHtml } from '@dineug/vite-plugin-r-html';
import {
  defaultExclude,
  defineConfig,
  type UserWorkspaceConfig,
} from 'vite-plus';
import { playwright } from 'vite-plus/test/browser-playwright';

const pkg = JSON.parse(readFileSync('package.json', { encoding: 'utf8' }));
const browserSpecs = 'src/**/*.browser.test.{ts,tsx}';

/**
 * What both projects carry and inherit from nowhere: Vitest reads neither
 * vite.config.ts nor the root config a project sits in. A missing define
 * leaves __APP_VERSION__ undefined and kills every spec reaching schema-gc.
 */
const createSharedConfig = (): UserWorkspaceConfig => ({
  // The JSX transform repeats here or a .tsx spec reaches oxc with its JSX
  // intact. The HMR half is off, and the konva specifier is what a @jsxHost
  // konva spec compiles against; the plugin refuses the pragma without it.
  plugins: [
    rHtml({ jsx: { konvaImportSource: '@/konva/host' }, refresh: false }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
          // A browser spec matches the unit glob too, so the split lives here.
          // Spreading the default keeps node_modules and .git out, which naming
          // an exclude at all would otherwise drop.
          exclude: [...defaultExclude, browserSpecs],
          environment: 'happy-dom',
          setupFiles: ['./vitest.setup.ts'],
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
    // Coverage is a root-only option, so the one block below still spans both
    // projects and the perFile floor keeps the meaning it had before the split.
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
        // The stage registry the e2e fixture installs. Its guard keeps it out
        // of a production build and its consumer lives under e2e, which no
        // coverage run reaches.
        'src/konva/testHandle.ts',
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
