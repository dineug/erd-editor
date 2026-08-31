import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 5175);
// A large corpus loads slowly on purpose — that load is one of the
// measurements — and the xlarge one is another order of magnitude again, so
// the ceiling is tunable instead of a number to come back and edit.
const TIMEOUT_MS = Number(process.env.E2E_BENCH_TIMEOUT) || 180_000;
// Vite's dev server binds to localhost only; 127.0.0.1 is refused.
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e/bench',
  // routing.bench.ts is the one that reports against a saved baseline. The
  // others are diagnostics that answer a specific question and are noise in a
  // before/after comparison, so they need E2E_BENCH_ALL=1 to run.
  testMatch: process.env.E2E_BENCH_ALL
    ? '**/*.bench.ts'
    : '**/routing.bench.ts',
  outputDir: './e2e/.results-bench',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: TIMEOUT_MS,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: `pnpm exec vp dev --port ${PORT} --strictPort`,
    url: `${BASE_URL}/e2e/fixture/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
    // vite.config.ts opens a browser on serve; this keeps the run headless.
    env: { E2E: '1' },
  },
});
