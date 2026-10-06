import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 5174);
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
        // The descriptor pins a Windows user agent. Cleared, the page names the
        // host it runs on, as navigator.platform, which decides $mod, already
        // does, so nothing in a spec can pick Ctrl on a mac — see e2e/README.md.
        userAgent: undefined,
      },
    },
  ],
  webServer: {
    command: `pnpm exec vp dev --port ${PORT} --strictPort`,
    url: `${BASE_URL}${'/e2e/fixture/index.html'}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
