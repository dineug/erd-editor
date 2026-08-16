import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 5175);
const RELAY_PORT = Number(process.env.E2E_RELAY_PORT ?? 5176);
// The dev server binds to `localhost`; 127.0.0.1 is refused.
const BASE_URL = `http://localhost:${PORT}`;
// Export `ERD_EDITOR_NOSTR_RELAY_URLS=''` to run the suite against the public
// relay pool instead — a slow, network-dependent smoke test of the real thing.
const RELAY_URL =
  process.env.ERD_EDITOR_NOSTR_RELAY_URLS ?? `ws://localhost:${RELAY_PORT}`;

/**
 * The suite drives the real app in Chromium against the Vite dev server, with
 * `e2e/support/relay.mjs` standing in for the public nostr relay pool.
 *
 * That substitution is the whole point: collaboration is peer-to-peer, so the
 * only parts a unit test cannot reach are the ones that need two real browser
 * contexts, a real `RTCPeerConnection`, and a real `navigator.locks` handover.
 * Pointing at a local relay makes all three deterministic and offline.
 */
export default defineConfig({
  testDir: './e2e/specs',
  outputDir: './e2e/.results',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One worker: every spec drives several browser contexts at once, and a
  // handover test is easier to read when nothing else is racing the relay.
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: 'e2e/.report' }]]
    : [['list']],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      args: [
        // Chromium hides local IPs behind `.local` mDNS candidates, which never
        // resolve between two contexts of a headless browser. Without this the
        // signalling succeeds and ICE then fails, every time.
        '--disable-features=WebRtcHideLocalIpsWithMdns',
        '--force-webrtc-ip-handling-policy=default',
      ],
    },
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
      command: `node e2e/support/relay.mjs ${RELAY_PORT}`,
      url: `http://localhost:${RELAY_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `pnpm exec vp dev --port ${PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
      // `E2E` keeps the dev server from opening a browser of its own —
      // `vp dev` has no `--no-open` flag, so this is the way to say it.
      env: { E2E: '1', ERD_EDITOR_NOSTR_RELAY_URLS: RELAY_URL },
    },
  ],
});
