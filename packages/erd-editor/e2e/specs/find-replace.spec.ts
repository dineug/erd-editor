import type { Page } from '@playwright/test';

import type { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { createSchema } from '../support/schema';
import { Shortcut } from '../support/shortcuts';

/**
 * Find and Replace, and the palette's field rows, in the real element: its
 * bindings on the root, its shadow tree, the change event a host saves on and
 * the shared store a collaborator is wired through.
 */
const schema = () =>
  createSchema({
    tables: [
      {
        id: 'users',
        name: 'users',
        comment: 'Registered user accounts',
        x: 520,
        y: 160,
        columns: [
          { id: 'users_id', name: 'id', dataType: 'int', comment: 'user id' },
          { id: 'users_email', name: 'email', comment: 'login email' },
        ],
      },
      {
        id: 'orders',
        name: 'orders',
        x: 900,
        y: 420,
        columns: [
          { id: 'orders_user_id', name: 'user_id', dataType: 'int' },
          { id: 'orders_total', name: 'total', comment: 'paid by the user' },
        ],
      },
    ],
    memos: [{ id: 'note', value: 'Rename user to member', x: 520, y: 560 }],
  });

const panelOf = (erd: ErdEditorPage) => erd.host.locator('.find-replace');
const countOf = (erd: ErdEditorPage) => panelOf(erd).locator('.find-count');

/** Every change event the host hears from here on, counted on the page. */
async function countChanges(page: Page) {
  await page.evaluate(() => {
    Reflect.set(window, '__changes', 0);
    document.querySelector('erd-editor')!.addEventListener('change', () => {
      Reflect.set(window, '__changes', Reflect.get(window, '__changes') + 1);
    });
  });
  return () => page.evaluate(() => Reflect.get(window, '__changes') as number);
}

/** A second editor on the page, cross wired to the first the way a host relays. */
async function attachPeer(page: Page) {
  await page.evaluate(() => {
    const local = document.querySelector('erd-editor')!;
    const host = document.createElement('div');
    host.id = 'peer';
    host.setAttribute(
      'style',
      'position:fixed;left:0;top:0;width:900px;height:600px;visibility:hidden'
    );
    document.body.appendChild(host);

    const peer = document.createElement('erd-editor');
    peer.setAttribute('style', 'display:block;width:100%;height:100%');
    host.appendChild(peer);
    peer.setInitialValue(local.value);

    const local$ = local.getSharedStore();
    const peer$ = peer.getSharedStore();
    local$.subscribe(actions => peer$.dispatch(actions));
    peer$.subscribe(actions => local$.dispatch(actions));
  });

  return () =>
    page.evaluate(() =>
      JSON.parse(document.querySelector<any>('#peer erd-editor').value)
    );
}

async function openFind(erd: ErdEditorPage, query: string) {
  await erd.focusHost();
  await erd.press(Shortcut.findReplace);
  await expect(panelOf(erd).locator('.find-input')).toBeFocused();
  await erd.page.keyboard.type(query);
}

test.describe('Find and Replace', () => {
  test('walks the matches on the canvas, typing nothing into it', async ({
    erd,
  }) => {
    await erd.seed(schema());
    await openFind(erd, 'user');
    await expect(countOf(erd)).toHaveText('6 matches');

    await erd.press(Shortcut.addTable);
    await erd.press('Enter');

    await expect(countOf(erd)).toHaveText('1 of 6');
    await expect(panelOf(erd).locator('.find-input')).toBeFocused();
    expect(await erd.tableIds()).toEqual(['users', 'orders']);
    await expect(erd.editInput()).toHaveCount(0);

    await erd.press('Escape');

    await expect(panelOf(erd)).toHaveCount(0);
    await erd.expectKeyboardFocusInside();
  });

  test('leaves the chords the editor does not bind to the host, and still zooms', async ({
    erd,
    page,
  }) => {
    await erd.seed(schema());
    await openFind(erd, 'user');
    await page.evaluate(() => {
      Reflect.set(window, '__heard', []);
      window.addEventListener('keydown', event => {
        Reflect.get(window, '__heard').push(event.code);
      });
    });
    const heard = () =>
      page.evaluate(() =>
        (Reflect.get(window, '__heard') as string[]).filter(
          code => !/^(Control|Meta|Shift|Alt)/.test(code)
        )
      );
    const before = (await erd.settings()).zoomLevel;

    // A webview host hears save and its command palette through the window.
    await erd.press('ControlOrMeta+KeyS');
    await erd.press('ControlOrMeta+Shift+KeyP');
    await erd.press('ArrowDown');
    await erd.press(Shortcut.zoomIn);

    expect(await heard()).toEqual(['KeyS', 'KeyP']);
    await expect
      .poll(async () => (await erd.settings()).zoomLevel)
      .toBeGreaterThan(before);
    await expect(panelOf(erd).locator('.find-input')).toBeFocused();
  });

  test('replaces every match as one change, one undo and one batch to a peer', async ({
    erd,
    page,
  }) => {
    await erd.seed(schema());
    const changes = await countChanges(page);
    const peerValue = await attachPeer(page);
    await openFind(erd, 'user');
    await panelOf(erd).locator('.replace-input').fill('member');

    await panelOf(erd).locator('.find-replace-all').click();

    await expect(countOf(erd)).toHaveText('Replaced 6 matches');
    await expect.poll(changes).toBe(1);
    const replaced = await erd.value();
    expect(replaced.collections.tableEntities.users.comment).toBe(
      'Registered member accounts'
    );
    expect(replaced.collections.tableColumnEntities.orders_user_id.name).toBe(
      'member_id'
    );
    expect(replaced.collections.memoEntities.note.value).toBe(
      'Rename member to member'
    );
    await expect
      .poll(
        async () => (await peerValue()).collections.tableEntities.users.name
      )
      .toBe('members');

    await panelOf(erd).locator('.replace-input').focus();
    await erd.press(Shortcut.undo);

    await expect
      .poll(async () => (await erd.value()).collections.tableEntities.users)
      .toMatchObject({ name: 'users', comment: 'Registered user accounts' });
    await expect
      .poll(async () => (await peerValue()).collections.memoEntities.note.value)
      .toBe('Rename user to member');
  });

  test('offers no replace in a read-only editor', async ({ erd, page }) => {
    await erd.seed(schema());
    await page.evaluate(() => {
      document.querySelector('erd-editor')!.readonly = true;
    });

    await openFind(erd, 'user');

    await expect(panelOf(erd)).toContainText('Find');
    await expect(panelOf(erd).locator('.replace-input')).toHaveCount(0);
    await expect(countOf(erd)).toHaveText('6 matches');
  });
});

test.describe('quick search over columns, comments and memos', () => {
  test('lands on a column comment from another tab', async ({ erd }) => {
    await erd.seed(schema());
    await erd.toolbarButton('Schema SQL').click();
    await erd.focusHost();

    await erd.press(Shortcut.search);
    await erd.page.keyboard.type('login');
    await erd.host
      .locator('.quick-search')
      .getByText('users.email · Column comment')
      .click();

    await expect(erd.host.locator('.quick-search')).toHaveCount(0);
    expect((await erd.settings()).canvasType).toBe('ERD');
    await expect
      .poll(() => erd.focusRingCells())
      .toEqual(['users_email:columnComment']);
  });
});
