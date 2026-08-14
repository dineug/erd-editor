import { expect, test } from '@playwright/test';

import { LivePage } from '../support/AppPage';

/** A valid all-zero AES-GCM 128 key, so the guest gets past `importKey`. */
const VALID_SECRET_KEY = 'A'.repeat(22);

test.describe('the /live guest view without a host', () => {
  test('rejects a link with no room token', async ({ browser }) => {
    const context = await browser.newContext();
    const guest = await LivePage.open(context, '/live/#');

    await expect(guest.page.getByText('Invalid shared token.')).toBeVisible();

    await context.close();
  });

  test('rejects a link that is missing the secret key', async ({ browser }) => {
    const context = await browser.newContext();
    const guest = await LivePage.open(context, '/live/#only-a-room-id');

    await expect(guest.page.getByText('Invalid shared token.')).toBeVisible();

    await context.close();
  });

  test('gives up on a room nobody is hosting', async ({ browser }) => {
    const context = await browser.newContext();
    const guest = await LivePage.open(
      context,
      `/live/#no-such-room,${VALID_SECRET_KEY}`
    );

    await expect(guest.page.getByText('Looking for a host...')).toBeVisible();
    // One relay, one RELAY_TIMEOUT — the link is well-formed, so this is the
    // "host not found" path rather than the generic error boundary.
    await expect(guest.page.getByText('Host not found.')).toBeVisible({
      timeout: 30_000,
    });

    await context.close();
  });
});
