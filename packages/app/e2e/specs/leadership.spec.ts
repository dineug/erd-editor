import { expect, test } from '@playwright/test';

import { AppPage, LivePage } from '../support/AppPage';

/**
 * navigator.locks elects one tab to own the peer connections and the rest
 * forward to it. That needs two real tabs in one profile, so they share a lock
 * manager, a SharedWorker and a channel, plus a third context as the guest.
 */
test.describe('leadership across tabs', () => {
  test('shows a session started in one tab in the other', async ({
    browser,
  }) => {
    const context = await browser.newContext();

    const first = await AppPage.open(context);
    await first.createSchema('two-tabs');

    const second = await AppPage.open(context);
    await second.selectSchema('two-tabs');
    await expect(second.hasSession()).toHaveCount(0);

    await first.startSession();

    await expect(second.hasSession()).toHaveCount(1);

    await context.close();
  });

  test('relays an edit made in a follower tab out to the guest', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const guestContext = await browser.newContext();

    const leader = await AppPage.open(context);
    await leader.createSchema('follower-edit');
    const seeded = await leader.addTable();
    const link = await leader.startSession();

    const follower = await AppPage.open(context);
    await follower.selectSchema('follower-edit');

    const guest = await LivePage.open(guestContext, link);
    await guest.waitForEditor();
    await expect.poll(() => guest.tableIds()).toEqual([seeded]);

    // The follower holds no peer connection of its own — this only reaches the
    // guest if the bridge hands it to the leader tab.
    const fromFollower = await follower.addTable();
    await expect
      .poll(() => guest.tableIds())
      .toEqual(expect.arrayContaining([seeded, fromFollower]));

    await context.close();
    await guestContext.close();
  });

  test('hands hosting to the next tab when the leader closes', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const guestContext = await browser.newContext();

    const leader = await AppPage.open(context);
    await leader.createSchema('handover');
    const seeded = await leader.addTable();
    const link = await leader.startSession();

    const successor = await AppPage.open(context);
    await successor.selectSchema('handover');
    await expect(successor.hasSession()).toHaveCount(1);

    const guest = await LivePage.open(guestContext, link);
    await guest.waitForEditor();
    await expect.poll(() => guest.tableIds()).toEqual([seeded]);

    // Closing the leader releases the lock; the successor should pick it up and
    // rejoin the room before the guest's grace period runs out.
    await leader.close();

    // The guest's shared store buffers while it has no host and flushes on
    // reconnect, so this edit lands only if the successor really took over.
    const fromGuest = await guest.addTable();
    await expect
      .poll(() => successor.tableIds(), { timeout: 40_000 })
      .toEqual(expect.arrayContaining([seeded, fromGuest]));

    // ...and the new host reaches the guest from then on.
    const afterHandover = await successor.addTable();
    await expect
      .poll(() => guest.tableIds())
      .toEqual(expect.arrayContaining([seeded, fromGuest, afterHandover]));
    await expect(guest.page.getByText('Host stopped the session.')).toHaveCount(
      0
    );

    await context.close();
    await guestContext.close();
  });
});
