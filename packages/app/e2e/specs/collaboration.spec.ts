import { expect, test } from '@playwright/test';

import { AppPage, LivePage } from '../support/AppPage';

/**
 * The end of the collaboration path a unit test cannot reach: two real browser
 * contexts, a real RTCPeerConnection and the trystero mesh between them. Each
 * has its own storage, so the guest starts with nothing.
 */
test.describe('live collaboration over the trystero mesh', () => {
  test('hands a guest the host document and then keeps both in step', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const host = await AppPage.open(hostContext);
    await host.createSchema('collab');
    const seeded = await host.addTable();

    const link = await host.startSession();
    const guest = await LivePage.open(guestContext, link);

    // The snapshot the host pushes on peer join.
    await guest.waitForEditor();
    await expect.poll(() => guest.tableIds()).toEqual([seeded]);

    // Host -> guest, over the shared action stream.
    const fromHost = await host.addTable();
    await expect
      .poll(() => guest.tableIds())
      .toEqual(expect.arrayContaining([seeded, fromHost]));

    // Guest -> host: a guest is a full peer, not a viewer.
    const fromGuest = await guest.addTable();
    await expect
      .poll(() => host.tableIds())
      .toEqual(expect.arrayContaining([seeded, fromHost, fromGuest]));

    await hostContext.close();
    await guestContext.close();
  });

  test('tells the guest when the host stops the session', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const host = await AppPage.open(hostContext);
    await host.createSchema('collab-stop');
    await host.addTable();

    const link = await host.startSession();
    const guest = await LivePage.open(guestContext, link);
    await guest.waitForEditor();

    await host.stopSession();

    // Three seconds of grace before the overlay, then the terminal error.
    await expect(guest.page.getByText('Waiting for a host...')).toBeVisible({
      timeout: 20_000,
    });
    await expect(guest.page.getByText('Host stopped the session.')).toBeVisible(
      { timeout: 30_000 }
    );

    await hostContext.close();
    await guestContext.close();
  });
});
