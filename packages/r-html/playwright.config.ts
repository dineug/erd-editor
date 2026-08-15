import { defineConfig, devices } from '@playwright/test';

// 5174 is `@dineug/erd-editor`, 5175 is `@dineug/erd-editor-app`. Keeping a
// third port means all three suites can be running at the same time.
const PORT = Number(process.env.E2E_PORT ?? 5176);
// Vite's dev server binds to `localhost` only; 127.0.0.1 is refused.
const BASE_URL = `http://localhost:${PORT}`;

/**
 * The suite drives r-html's own CSS pipeline in Chromium against the Vite dev
 * server, using the deterministic page in `e2e/fixture/`.
 *
 * Everything here is about questions a DOM emulation cannot answer:
 * `adoptedStyleSheets` mutability, whether an adopted sheet actually paints,
 * whether the real CSSOM keeps the declarations we emit, and what the cascade
 * does with them. See `e2e/README.md`.
 */
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
          // Playwright launches headless Chromium with `--hide-scrollbars`, which
          // leaves every scroller with a zero-width gutter — `offsetWidth -
          // clientWidth` is 0 whatever `::-webkit-scrollbar` says, so the one
          // observable that proves a scrollbar rule matched would be dead.
          ignoreDefaultArgs: ['--hide-scrollbars'],
        },
      },
    },
  ],
  webServer: {
    // `vite.config.ts` sets `server.open: true` for `pnpm dev`; `--no-open`
    // is the CLI override that keeps the e2e run headless.
    command: `pnpm exec vite serve --port ${PORT} --strictPort --no-open`,
    url: `${BASE_URL}/e2e/fixture/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
