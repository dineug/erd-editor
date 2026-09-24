import { expect, type Page, test } from '@playwright/test';

import { documentWithTable, tableNames } from '../../support/gdrive/documents';
import {
  type FakeGoogle,
  installFakeGoogle,
  resetOAuthServer,
} from '../../support/gdrive/fakeGoogle';
import { GdrivePage } from '../../support/gdrive/GdrivePage';
import { GDRIVE_BASE_URL, OAUTH_URL } from '../../support/gdrive/server';

const FILE = 'shop.erd.json';

let google: FakeGoogle;

test.beforeEach(async ({ context }) => {
  await resetOAuthServer();
  google = await installFakeGoogle(context);
  google.add({ id: 'shop', name: FILE, content: documentWithTable('users') });
});

/** A tab with the file open; the first one signs the browser in. */
async function openShop(context: Parameters<typeof GdrivePage.open>[0]) {
  const app = await GdrivePage.open(context, '/gdrive?file=shop');
  await expect(app.signInButton().or(app.sidebar())).toBeVisible();
  if (await app.signInButton().isVisible()) await app.signIn();
  await app.waitForEditor();
  return app;
}

/** Closes the tab as a person would, and says whether it asked first. */
async function closeAsked(page: Page): Promise<boolean> {
  const dialog = page
    .waitForEvent('dialog', { timeout: 3000 })
    .catch(() => null);
  await page.close({ runBeforeUnload: true });
  const shown = await dialog;
  if (!shown) return false;
  expect(shown.type()).toBe('beforeunload');
  await shown.dismiss();
  return true;
}

test.describe('saving to Drive', () => {
  test('saves some two seconds after an edit, checking the metadata first', async ({
    context,
  }) => {
    const app = await openShop(context);
    await app.expectSaveState('saved');
    google.holdPatches();

    await app.addTable();
    const editedAt = Date.now();
    await app.expectSaveState('saving');
    const patches = google.patches('shop');
    expect(patches).toHaveLength(1);
    expect(patches[0].at - editedAt).toBeGreaterThan(1500);
    const patchIndex = google.requests.indexOf(patches[0]);
    expect(google.requests[patchIndex - 1]).toMatchObject({ method: 'GET' });
    expect(google.requests[patchIndex - 1].url.pathname).toBe(
      '/drive/v3/files/shop'
    );
    await expect(app.saveStatus()).toHaveText('Saving…');

    google.releasePatches();
    await app.expectSaveState('saved');
    await expect(app.saveStatus()).toHaveText('Saved to Google Drive');
    expect(google.patches('shop')).toHaveLength(1);
    expect(tableNames(google.files.get('shop')!.content)).toHaveLength(2);
  });

  test('saves nothing for a zoom and does not ask before closing', async ({
    context,
  }) => {
    const app = await openShop(context);

    await app.page
      .locator('erd-editor .floating-toolbar [title^="Zoom in"]')
      .click();
    await expect(app.page.locator('erd-editor .zoom-level')).not.toHaveText(
      '100%'
    );
    await app.page.waitForTimeout(3000);

    expect(google.patches('shop')).toHaveLength(0);
    expect(await closeAsked(app.page)).toBe(false);
  });

  test('stops on a change made elsewhere, keeps the edits for download, reloads', async ({
    context,
  }) => {
    const app = await openShop(context);
    google.bumpRemote('shop', documentWithTable('remote'));

    await app.addTable();

    await expect(
      app.page.getByText('This file changed in Google Drive', { exact: false })
    ).toBeVisible();
    await app.expectSaveState('conflict');
    expect(google.patches('shop')).toHaveLength(0);

    const download = app.page.waitForEvent('download');
    await app.page.getByRole('button', { name: 'Download my changes' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('shop.erd');
    const text = await (await file.createReadStream()).toArray();
    expect(Buffer.concat(text).toString('utf8')).toBe(await app.editorValue());

    await app.page.getByRole('button', { name: 'Reload from Drive' }).click();
    await expect
      .poll(async () => tableNames(await app.editorValue()))
      .toEqual(['remote']);
    await app.expectSaveState('saved');
    expect(google.patches('shop')).toHaveLength(0);
  });
});

test.describe('tabs of one file', () => {
  test('share their edits, and only the leader saves until it closes', async ({
    context,
  }) => {
    const leader = await openShop(context);
    const follower = await openShop(context);

    await follower.addTable();
    await expect.poll(async () => (await leader.tableIds()).length).toBe(2);
    await expect.poll(() => google.patches('shop').length).toBe(1);
    expect(google.patches('shop', follower.page)).toHaveLength(0);
    await follower.expectSaveState('saved');

    await leader.close();
    await follower.addTable();

    await expect
      .poll(() => google.patches('shop', follower.page).length)
      .toBe(1);
    expect(tableNames(google.files.get('shop')!.content)).toHaveLength(3);
  });

  test('a new tab starts from the leader while its save is held, not from Drive', async ({
    context,
  }) => {
    const leader = await openShop(context);
    google.holdPatches();
    await leader.addTable();
    await leader.expectSaveState('saving');

    const joining = await openShop(context);

    await expect.poll(async () => (await joining.tableIds()).length).toBe(2);
    expect(google.downloads('shop', joining.page)).toHaveLength(0);
    google.releasePatches();
    await joining.expectSaveState('saved');
  });

  test('a tab that joins after a conflict sees it too', async ({ context }) => {
    const leader = await openShop(context);
    google.bumpRemote('shop');
    await leader.addTable();
    await leader.expectSaveState('conflict');

    const joining = await openShop(context);

    await joining.expectSaveState('conflict');
    await expect(
      joining.page.getByRole('button', { name: 'Reload from Drive' })
    ).toBeVisible();
  });

  test('after a lost answer the next leader stops as unconfirmed, and Check Drive resumes', async ({
    context,
  }) => {
    const leader = await openShop(context);
    const follower = await openShop(context);
    google.dropNextPatchResponse();

    await leader.addTable();
    await follower.expectSaveState('unconfirmed');
    await leader.close();

    await expect(
      follower.page
        .getByRole('alert')
        .filter({ hasText: "Couldn't confirm the last save" })
    ).toBeVisible();
    const patches = google.patches('shop').length;
    await follower.page.waitForTimeout(3000);
    expect(google.patches('shop')).toHaveLength(patches);

    // The lost PATCH did land: the file holds what the attempt sent.
    await follower.page.getByRole('button', { name: 'Check Drive' }).click();
    await follower.expectSaveState('saved');
    await follower.addTable();
    await expect
      .poll(() => google.patches('shop', follower.page).length)
      .toBe(1);
    expect(tableNames(google.files.get('shop')!.content)).toHaveLength(3);
  });

  test('ask before closing while a save is out, a follower right after an edit too', async ({
    context,
  }) => {
    const leader = await openShop(context);
    const follower = await openShop(context);

    await follower.addTable();
    // The element reports a change 200 ms after it, and the tab counts the
    // next 500 ms as still leaving: a close in between asks.
    await follower.page.waitForTimeout(300);
    expect(await closeAsked(follower.page)).toBe(true);
    await expect.poll(() => google.patches('shop').length).toBe(1);
    await follower.expectSaveState('saved');
    await follower.page.waitForTimeout(600);
    expect(await closeAsked(follower.page)).toBe(false);

    google.holdPatches();
    await leader.addTable();
    await leader.expectSaveState('saving');
    expect(await closeAsked(leader.page)).toBe(true);
    google.releasePatches();
    await leader.expectSaveState('saved');
    expect(await closeAsked(leader.page)).toBe(false);
  });
});

test('shows only a link to its own tab inside a frame', async ({ context }) => {
  const page = await context.newPage();

  await page.goto(
    `${OAUTH_URL}/__framer?src=${encodeURIComponent(`${GDRIVE_BASE_URL}/gdrive`)}`
  );

  const frame = page.frameLocator('iframe');
  await expect(
    frame.getByText("Open erd-editor's Google Drive editor in its own tab")
  ).toBeVisible();
  await expect(
    frame.getByRole('link', { name: 'Open in a new tab' })
  ).toHaveAttribute('target', '_blank');
  await expect(
    frame.getByRole('button', { name: 'Sign in with Google' })
  ).toHaveCount(0);
  await expect(frame.locator('erd-editor')).toHaveCount(0);
});
