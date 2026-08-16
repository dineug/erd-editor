import { join } from 'node:path';

import { defineConfig } from 'vite-plus';

export default defineConfig({
  resolve: {
    alias: {
      '@': join(import.meta.dirname, 'src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // Scoped to the collaboration transport and the utilities it builds on —
      // the React shell and the Dexie/worker plumbing are verified by hand
      // (see AGENTS.md "Testing Requirements").
      include: [
        'src/services/collaborative/**/*.ts',
        'src/services/indexeddb/modules/collaborative/**/*.ts',
        'src/utils/broadcastChannel.ts',
        'src/utils/crypto.ts',
      ],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
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
