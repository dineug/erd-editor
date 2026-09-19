import { expect, test } from '@playwright/test';

import { AppPage, LivePage } from '../support/AppPage';

/**
 * Who is in a session, as the host dialog and the guest panel each list it. A
 * nickname is stored per origin, so every guest gets a context of its own —
 * sharing one would hand one peer's name to the other.
 */
test.describe('participants of a live session', () => {
  test('lists host and guest on both sides and follows their nicknames', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const host = await AppPage.open(hostContext);
    await host.createSchema('participants');
    const link = await host.startSession();

    await host.openParticipants();
    await expect.poll(() => host.participants()).toEqual(['Host (you) Host']);
    await expect(
      host.page.getByText('No one else has joined yet.')
    ).toBeVisible();
    await expect(host.guestCount()).toHaveCount(0);

    const guest = await LivePage.open(guestContext, link);
    await guest.waitForEditor();

    // A guest that has not picked a nickname still says hello, with an empty one.
    await expect(host.guestCount()).toHaveAttribute(
      'aria-label',
      '1 guest connected'
    );
    await expect
      .poll(() => host.participants())
      .toEqual(['Host (you) Host', 'Guest']);
    await expect(
      host.page.getByText('No one else has joined yet.')
    ).toHaveCount(0);
    await expect
      .poll(() => guest.participants())
      .toEqual(['Host Host', 'Guest (you)']);
    await expect(guest.panel()).toContainText('2 in session');

    // Re-announced once the typing settles, over the connection already open.
    await guest.setNickname('Ada');
    await expect
      .poll(() => guest.participants())
      .toEqual(['Host Host', 'Ada (you)']);
    await expect
      .poll(() => host.participants())
      .toEqual(['Host (you) Host', 'Ada']);

    await host.setNickname('Grace');
    await expect
      .poll(() => host.participants())
      .toEqual(['Grace (you) Host', 'Ada']);
    await expect
      .poll(() => guest.participants())
      .toEqual(['Grace Host', 'Ada (you)']);

    // The nickname is stored per origin, so the guest's next visit brings it
    // back. The host's list empties first, so the Ada it shows after is new.
    await guest.close();
    await expect
      .poll(() => host.participants(), { timeout: 30_000 })
      .toEqual(['Grace (you) Host']);

    const returning = await LivePage.open(guestContext, link);
    await returning.waitForEditor();
    await expect
      .poll(() => returning.participants())
      .toEqual(['Grace Host', 'Ada (you)']);
    await expect
      .poll(() => host.participants())
      .toEqual(['Grace (you) Host', 'Ada']);

    await hostContext.close();
    await guestContext.close();
  });

  test('keeps every list in step as guests join and leave', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const adaContext = await browser.newContext();
    // Narrow enough that the panel starts collapsed, clear of the canvas.
    const linusContext = await browser.newContext({
      viewport: { width: 800, height: 900 },
    });

    const host = await AppPage.open(hostContext);
    await host.createSchema('participants-churn');
    const link = await host.startSession();

    const ada = await LivePage.open(adaContext, link);
    await ada.waitForEditor();
    await ada.setNickname('Ada');
    await expect
      .poll(() => ada.participants())
      .toEqual(['Host Host', 'Ada (you)']);

    const linus = await LivePage.open(linusContext, link);
    await linus.waitForEditor();
    const show = linus.panel().getByRole('button', {
      name: 'Show participants',
    });
    await expect(show).toBeVisible();
    await expect(linus.panel().getByLabel('Your nickname')).toHaveCount(0);
    await show.click();
    await linus.setNickname('Linus');

    await expect(host.guestCount()).toHaveAttribute(
      'aria-label',
      '2 guests connected'
    );
    await host.openParticipants();
    await expect
      .poll(() => host.participants())
      .toEqual(['Host (you) Host', 'Ada', 'Linus']);
    await expect
      .poll(() => ada.participants())
      .toEqual(['Host Host', 'Linus', 'Ada (you)']);
    await expect
      .poll(() => linus.participants())
      .toEqual(['Host Host', 'Ada', 'Linus (you)']);

    // No beforeunload, so no goodbye either: the host has to notice the
    // connection drop on its own.
    await linus.close();

    await expect
      .poll(() => host.participants(), { timeout: 30_000 })
      .toEqual(['Host (you) Host', 'Ada']);
    await expect(host.guestCount()).toHaveAttribute(
      'aria-label',
      '1 guest connected'
    );
    await expect
      .poll(() => ada.participants())
      .toEqual(['Host Host', 'Ada (you)']);

    await hostContext.close();
    await adaContext.close();
    await linusContext.close();
  });

  test('shows the list in a host tab that holds no connection', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const guestContext = await browser.newContext();

    const leader = await AppPage.open(context);
    await leader.createSchema('participants-tabs');
    const link = await leader.startSession();

    const guest = await LivePage.open(guestContext, link);
    await guest.waitForEditor();
    await guest.setNickname('Ada');
    await leader.openParticipants();
    await expect
      .poll(() => leader.participants())
      .toEqual(['Host (you) Host', 'Ada']);

    // Opened after the guest joined, so the list has to be asked of the leader.
    const follower = await AppPage.open(context);
    await follower.selectSchema('participants-tabs');
    await expect(follower.guestCount()).toHaveAttribute(
      'aria-label',
      '1 guest connected'
    );
    await follower.openParticipants();
    await expect
      .poll(() => follower.participants())
      .toEqual(['Host (you) Host', 'Ada']);

    // ...and is told of every change from then on.
    await guest.setNickname('Ada Lovelace');
    await expect
      .poll(() => follower.participants())
      .toEqual(['Host (you) Host', 'Ada Lovelace']);

    await context.close();
    await guestContext.close();
  });

  test('rebuilds the list in the tab that takes over hosting', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const guestContext = await browser.newContext();

    const leader = await AppPage.open(context);
    await leader.createSchema('participants-handover');
    const link = await leader.startSession();

    const successor = await AppPage.open(context);
    await successor.selectSchema('participants-handover');
    await expect(successor.hasSession()).toHaveCount(1);

    const guest = await LivePage.open(guestContext, link);
    await guest.waitForEditor();
    await guest.setNickname('Ada');
    await successor.openParticipants();
    await expect
      .poll(() => successor.participants())
      .toEqual(['Host (you) Host', 'Ada']);

    await leader.close();

    // The leader's last list stays behind in the successor, so a name only the
    // successor can have heard is what shows its own list has taken over.
    await guest.setNickname('Ada 2');
    await expect
      .poll(() => successor.participants(), { timeout: 40_000 })
      .toEqual(['Host (you) Host', 'Ada 2']);
    await expect(successor.guestCount()).toHaveAttribute(
      'aria-label',
      '1 guest connected'
    );
    await expect
      .poll(() => guest.participants())
      .toEqual(['Host Host', 'Ada 2 (you)']);
    await expect(guest.page.getByText('Host stopped the session.')).toHaveCount(
      0
    );

    await context.close();
    await guestContext.close();
  });

  test("labels each peer's cursor with its nickname on the other's canvas", async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    const host = await AppPage.open(hostContext);
    await host.createSchema('participants-cursor');
    const link = await host.startSession();

    const guest = await LivePage.open(guestContext, link);
    await guest.waitForEditor();
    await guest.setNickname('Ada');
    await expect
      .poll(() => guest.participants())
      .toEqual(['Host Host', 'Ada (you)']);

    // Without the nickname the editor would label the cursor "user".
    await guest.moveMouse();
    await expect.poll(() => host.cursorLabels()).toEqual(['Ada']);

    // The nickname is read as each position is sent, so a rename shows on the
    // next move.
    await guest.setNickname('Ada Lovelace');
    await guest.moveMouse();
    await expect.poll(() => host.cursorLabels()).toEqual(['Ada Lovelace']);

    // The host's cursor reaches the guest through the leader like any edit.
    await host.openParticipants();
    await host.setNickname('Grace');
    await host.page.keyboard.press('Escape');
    await expect(host.page.getByRole('dialog')).toHaveCount(0);
    await host.moveMouse();
    await expect.poll(() => guest.cursorLabels()).toEqual(['Grace']);

    await hostContext.close();
    await guestContext.close();
  });
});
