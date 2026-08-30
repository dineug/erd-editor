import { join } from 'node:path';

import { defineConfig } from 'vite-plus';

export default defineConfig({
  resolve: {
    alias: {
      // vite.config.ts marks vscode external, so the module does not exist
      // outside the Extension Host. The unit suite resolves it to a stub; the
      // real API is exercised by the suite under test/integration/.
      vscode: join(import.meta.dirname, 'test/mocks/vscode.ts'),
      '@': join(import.meta.dirname, 'src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
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
