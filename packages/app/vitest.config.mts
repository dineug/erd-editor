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
      // Scoped to the collaboration transport, the schema service with its
      // edit fingerprint, the Drive auth relay and client, and the pure
      // utilities they build on; the React shell and worker plumbing are not.
      include: [
        'src/server/**/*.ts',
        'src/services/collaborative/**/*.ts',
        'src/services/gdrive/**/*.ts',
        'src/services/indexeddb/modules/collaborative/**/*.ts',
        'src/services/indexeddb/modules/schema/**/*.ts',
        'src/utils/backup.ts',
        'src/utils/broadcastChannel.ts',
        'src/utils/convertSource.ts',
        'src/utils/crypto.ts',
        'src/utils/documentFingerprint.ts',
        'src/utils/importFile.ts',
        'src/utils/reportError.ts',
        'src/utils/schemaList.ts',
        'src/utils/sentryScrub.ts',
        'src/utils/theme.ts',
        'src/utils/trash.ts',
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
