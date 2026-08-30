import { defineConfig, devices } from '@playwright/test';

// 5174 is @dineug/erd-editor, 5175 is @dineug/erd-editor-app. Keeping a
// third port means all three suites can be running at the same time.
const PORT = Number(process.env.E2E_PORT ?? 5176);
// Vite's dev server binds to localhost only; 127.0.0.1 is refused.
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e/specs',
  outputDir: './e2e/.results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'e2e/.report' }]]
    : [['list']],
  use: {
    baseURL: BASE_URL,
    // Pinned so a computed length or a scrollbar rule never depends on the
    // window the runner happened to open.
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          // Playwright launches headless Chromium with --hide-scrollbars, which
          // leaves every scroller a zero-width gutter, killing the one
          // observable that proves a scrollbar rule matched.
          ignoreDefaultArgs: ['--hide-scrollbars'],
        },
      },
    },
  ],
  webServer: {
    // vite.config.ts opens a browser for pnpm dev. vp dev has no
    // --no-open flag, so E2E is what keeps this run headless.
    command: `pnpm exec vp dev --port ${PORT} --strictPort`,
    env: { E2E: '1' },
    url: `${BASE_URL}/e2e/fixture/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
