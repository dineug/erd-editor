import { defineConfig, devices } from '@playwright/test';

// Renders google-workspace/ for google-workspace:assets, never within e2e: the
// icons and the banner from the app's icon, each at its assets.json scale. It
// needs no server.
export default defineConfig({
  testDir: './assets',
  outputDir: '../.results/assets',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 1,
  reporter: [['list']],
  use: {
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
