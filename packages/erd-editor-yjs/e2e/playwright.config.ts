import { fileURLToPath } from 'node:url';

import { defineConfig, devices } from '@playwright/test';

import { ROOM, YJS_PORT } from './support/room';

const PORT = Number(process.env.E2E_PORT ?? 5181);
// Vite's dev server binds to localhost only; 127.0.0.1 is refused.
const BASE_URL = `http://localhost:${PORT}`;
// A web server starts in the config's folder unless told otherwise, and both
// of these run from the package.
const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  testDir: './specs',
  outputDir: './.results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One worker: the relay keeps one room with its compactor, which each spec
  // empties as it starts.
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: '.report' }]]
    : [['list']],
  use: {
    baseURL: BASE_URL,
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
  webServer: [
    {
      command: `node e2e/support/servers.mjs ${YJS_PORT} ${ROOM}`,
      cwd: PACKAGE_DIR,
      url: `http://localhost:${YJS_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `pnpm exec vp dev --port ${PORT} --strictPort`,
      cwd: PACKAGE_DIR,
      url: `${BASE_URL}/index.html`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
