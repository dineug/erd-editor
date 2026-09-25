import { join } from 'node:path';

import type { PlaywrightTestConfig } from '@playwright/test';

/** The app package, where both servers run; a config's own folder is Playwright's default. */
export const PACKAGE_ROOT = join(__dirname, '..', '..', '..');

export const GDRIVE_PORT = Number(process.env.E2E_GDRIVE_PORT ?? 5177);
export const OAUTH_PORT = Number(process.env.E2E_GDRIVE_OAUTH_PORT ?? 5178);
// The dev server binds to localhost; 127.0.0.1 is refused.
export const GDRIVE_BASE_URL = `http://localhost:${GDRIVE_PORT}`;
export const OAUTH_URL = `http://localhost:${OAUTH_PORT}`;

export const CLIENT_ID = 'e2e-client.apps.googleusercontent.com';
export const CLIENT_SECRET = 'e2e-secret';
/** 32 bytes of 0x2a, a key for these runs alone. */
export const COOKIE_KEY = Buffer.alloc(32, 0x2a).toString('base64');

/**
 * The fake Google token server and a dev server that is configured, each named
 * in full so packages/app/.env.local cannot leak a real client in; neither is
 * reused, so a dev server started by hand on these ports fails the run.
 */
export const gdriveWebServers: NonNullable<PlaywrightTestConfig['webServer']> =
  [
    {
      command: `node e2e/support/gdrive/fakeGoogleOAuth.mjs ${OAUTH_PORT}`,
      cwd: PACKAGE_ROOT,
      url: `${OAUTH_URL}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        E2E_GOOGLE_CLIENT_ID: CLIENT_ID,
        E2E_GOOGLE_CLIENT_SECRET: CLIENT_SECRET,
      },
    },
    {
      command: `pnpm exec vp dev --port ${GDRIVE_PORT} --strictPort`,
      cwd: PACKAGE_ROOT,
      url: GDRIVE_BASE_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        VITE_GOOGLE_CLIENT_ID: CLIENT_ID,
        GOOGLE_CLIENT_SECRET: CLIENT_SECRET,
        COOKIE_KEY,
        ERD_EDITOR_E2E_GOOGLE_OAUTH_URL: OAUTH_URL,
      },
    },
  ];
