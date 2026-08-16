import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 5174);
// Vite's dev server binds to `localhost` only; 127.0.0.1 is refused.
const BASE_URL = `http://localhost:${PORT}`;

/**
 * The suite drives the real `<erd-editor>` element in Chromium against the Vite
 * dev server, using the deterministic page in `e2e/fixture/`.
 *
 * `--mode lib` is what loads `environment/.env.lib`, which sets `VITE_TARGET`
 * and in turn enables the `@dineug/vite-plugin-r-html` transform the components
 * are authored against.
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
    // Table coordinates, the minimap scale and the marquee rectangle are all
    // relative to the viewport, so it is pinned rather than inherited.
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
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
    command: `pnpm exec vp dev --mode lib --port ${PORT} --strictPort`,
    url: `${BASE_URL}${'/e2e/fixture/index.html'}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
    // `vite.config.ts` opens a browser on serve; this keeps the e2e run headless.
    env: { E2E: '1' },
  },
});
