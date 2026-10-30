import { defineConfig, devices } from '@playwright/test';

// A port no other Playwright config here uses, so the bench can run beside
// any of them; E2E_PORT moves it.
const PORT = Number(process.env.E2E_PORT ?? 5179);
const TIMEOUT_MS = Number(process.env.E2E_BENCH_TIMEOUT) || 180_000;
// Vite's dev server binds to localhost only; 127.0.0.1 is refused.
const BASE_URL = `http://localhost:${PORT}`;
const VIEWPORT = { width: 1440, height: 900 };

export default defineConfig({
  testDir: './bench',
  testMatch: '**/*.bench.ts',
  outputDir: './bench/.results-bench',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: TIMEOUT_MS,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: VIEWPORT,
      },
    },
  ],
  webServer: {
    // vite.config.ts opens a browser for pnpm dev, and E2E is what keeps
    // this run headless, since vp dev has no --no-open flag.
    command: `pnpm exec vp dev --port ${PORT} --strictPort`,
    env: { E2E: '1' },
    url: `${BASE_URL}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
