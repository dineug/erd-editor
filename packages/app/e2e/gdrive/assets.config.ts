import { defineConfig, devices } from '@playwright/test';

import { GDRIVE_BASE_URL, gdriveWebServers } from '../support/gdrive/server';

// Renders google-workspace/ for google-workspace:assets, never within e2e: the
// icons and banner from the app's icon, the screenshot from /gdrive against the
// second run's servers and fake Google.
export default defineConfig({
  testDir: './assets',
  outputDir: '../.results/assets',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: GDRIVE_BASE_URL,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: gdriveWebServers,
});
