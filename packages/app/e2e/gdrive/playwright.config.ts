import { defineConfig, devices } from '@playwright/test';

import { GDRIVE_BASE_URL, gdriveWebServers } from '../support/gdrive/server';

// The second run of the app suite: /gdrive against a dev server with a client
// id, the real auth relay, and Google faked (the token server here, the rest by
// route). It runs after the first, never beside it, so one dev server is up.
export default defineConfig({
  testDir: './specs',
  outputDir: '../.results/gdrive',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { open: 'never', outputFolder: '../.report/gdrive' }],
      ]
    : [['list']],
  use: {
    baseURL: GDRIVE_BASE_URL,
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
  webServer: gdriveWebServers,
});
