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

  test('lands on the name of a table taller than the canvas, not its middle', async ({
    erd,
  }) => {
    await erd.seed(
      createSchema({
        tables: [
          {
            id: 'ledger',
            name: 'ledger',
            x: 3000,
            y: 3000,
            columns: Array.from({ length: 60 }, (_, index) => ({
              id: `ledger_${index}`,
              name: `entry_${index}`,
            })),
          },
        ],
      })
    );
    await openFind(erd, 'ledger');

    await erd.press('Enter');

    await expect.poll(() => erd.focusRingCells()).toEqual(['ledger:tableName']);
    const canvas = await erd.canvas.boundingBox();
    const table = await erd.tableEl('ledger').boundingBox();
    const header = await erd.tableHeaderPoint('ledger');
    expect(table!.height).toBeGreaterThan(canvas!.height);
    expect(header.y).toBeGreaterThan(canvas!.y);
    expect(header.y).toBeLessThan(canvas!.y + canvas!.height / 2);
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
    await erd.page.keyboard.type('"login');
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

  test('narrows to one kind of row by a prefix a help row types in', async ({
    erd,
  }) => {
    await erd.seed(schema());
    await erd.focusHost();
    const palette = erd.host.locator('.quick-search');
    const input = palette.locator('input');

    await erd.press(Shortcut.search);
    await expect(palette.locator('.quick-search-hint button')).toHaveCount(5);
    await erd.page.keyboard.type('?');
    await palette.getByText('Columns', { exact: true }).click();

    await expect(input).toHaveValue('@');
    await expect(input).toBeFocused();
    await expect(palette.locator('.quick-search-scope')).toHaveText('Columns');

    await erd.page.keyboard.type('users.em');
    await palette.getByText('users.email · Column', { exact: true }).click();

    await expect(palette).toHaveCount(0);
    await expect
      .poll(() => erd.focusRingCells())
      .toEqual(['users_email:columnName']);
  });

  test('lists the commands and no table or field once the prefix is deleted', async ({
    erd,
  }) => {
    await erd.seed(schema());
    await erd.focusHost();
    const palette = erd.host.locator('.quick-search');

    await erd.press(Shortcut.search);
    await erd.page.keyboard.type('#us');
    await expect(palette.getByText(/^users\s*Table$/)).toHaveCount(1);

    await erd.page.keyboard.press('ArrowLeft');
    await erd.page.keyboard.press('ArrowLeft');
    await erd.page.keyboard.press('Backspace');

    await expect(palette.locator('input')).toHaveValue('us');
    await expect(palette.locator('.quick-search-scope')).toHaveCount(0);
    await expect(palette.getByText('Auto Layout', { exact: true })).toHaveCount(
      1
    );
    await expect(palette.getByText(/^users\s*Table$/)).toHaveCount(0);
    await expect(palette.getByText('users.id · Column comment')).toHaveCount(0);
    // No command holds us, so the prefixes follow the commands it fuzzes to.
    await expect(palette.locator('.scrollbar > div').last()).toHaveText(
      /^"\s*Search comments & memos for "us"$/
    );
  });

  test('offers the prefixes once no command holds what is typed, and the keys type one in', async ({
    erd,
  }) => {
    await erd.seed(schema());
    await erd.focusHost();
    const palette = erd.host.locator('.quick-search');
    const rows = palette.locator('.scrollbar > div');
    const input = palette.locator('input');

    await erd.press(Shortcut.search);
    await erd.page.keyboard.type('users');

    await expect(rows).toHaveText([
      /^#\s*Search tables for "users"$/,
      /^@\s*Search columns for "users"$/,
      /^"\s*Search comments & memos for "users"$/,
    ]);
    // The narrowing left no command, and no command holds users.
    await expect(palette.locator('.quick-search-empty')).toHaveText(
      'No commands match'
    );

    await erd.page.keyboard.press('ArrowDown');
    await erd.page.keyboard.press('Enter');

    await expect(input).toHaveValue('#users');
    await expect(input).toBeFocused();
    await expect(palette.locator('.quick-search-scope')).toHaveText('Tables');
    await expect(palette.locator('.quick-search-empty')).toHaveCount(0);

    await erd.page.keyboard.press('ArrowDown');
    await expect(palette.locator('.selected')).toHaveText(/^users/);
    await erd.page.keyboard.press('Enter');

    await expect(palette).toHaveCount(0);
    await expect(erd.tableEl('users')).toHaveAttribute('data-selected', '');
  });

  test('offers a table name pasted in, or left once its # is deleted, below the commands it fuzzes to', async ({
    erd,
  }) => {
    await erd.seed(schema());
    await erd.focusHost();
    const palette = erd.host.locator('.quick-search');
    const rows = palette.locator('.scrollbar > div');
    const input = palette.locator('input');
    const listed = [
      /^Zero One/,
      /^Zero N/,
      /^#\s*Search tables for "users"$/,
      /^@\s*Search columns for "users"$/,
      /^"\s*Search comments & memos for "users"$/,
    ];

    await erd.press(Shortcut.search);
    await erd.page.keyboard.insertText('users');

    await expect(rows).toHaveText(listed);
    await expect(palette.locator('.quick-search-empty')).toHaveCount(0);

    for (const key of ['ArrowUp', 'ArrowUp', 'ArrowUp', 'Enter']) {
      await erd.page.keyboard.press(key);
    }
    await expect(input).toHaveValue('#users');
    await expect(rows.first()).toHaveText(/^users\s*Table$/);

    await erd.page.keyboard.press('Home');
    await erd.page.keyboard.press('Delete');

    await expect(input).toHaveValue('users');
    await expect(palette.locator('.quick-search-scope')).toHaveCount(0);
    await expect(rows).toHaveText(listed);
  });
});

test.describe('quick search under a Korean IME', () => {
  const koreanSchema = () =>
    createSchema({
      tables: [
        {
          id: 'users',
          name: '사용자',
          comment: '서비스에 가입한 회원',
          x: 120,
          y: 120,
          columns: [
            { id: 'users_id', name: '아이디', comment: '사용자 고유 번호' },
            { id: 'users_name', name: '이름' },
          ],
        },
        {
          id: 'orders',
          name: '주문 내역',
          x: 560,
          y: 120,
          columns: [
            { id: 'orders_user', name: '사용자', comment: '주문한 사용자' },
          ],
        },
        {
          id: 'products',
          name: '상품',
          x: 1000,
          y: 120,
          columns: [{ id: 'products_name', name: '상품명' }],
        },
      ],
      memos: [{ id: 'note', value: '사용자 한 명이 여러 주문을 남긴다' }],
    });

  /** Chromium's own IME entry points, which fire the composition events a Korean IME does. */
  async function ime(page: Page) {
    const client = await page.context().newCDPSession(page);
    return {
      compose: (text: string) =>
        client.send('Input.imeSetComposition', {
          text,
          selectionStart: text.length,
          selectionEnd: text.length,
        }),
      commit: (text: string) => client.send('Input.insertText', { text }),
    };
  }

  test('keeps 사용자 listed under # at every step the IME composes', async ({
    erd,
    page,
  }) => {
    await erd.seed(koreanSchema());
    await erd.focusHost();
    const palette = erd.host.locator('.quick-search');
    const input = palette.locator('input');
    const { compose, commit } = await ime(page);
    const listed = () =>
      expect(palette.getByText(/^사용자\s*Table$/)).toBeVisible();

    await erd.press(Shortcut.search);
    await erd.page.keyboard.type('#');
    for (const [step, value] of [
      ['ㅅ', '#ㅅ'],
      ['사', '#사'],
      ['상', '#상'],
    ]) {
      await compose(step);
      await expect(input).toHaveValue(value);
      await listed();
    }
    await commit('사');
    for (const [step, value] of [
      ['요', '#사요'],
      ['용', '#사용'],
    ]) {
      await compose(step);
      await expect(input).toHaveValue(value);
      await listed();
    }
    await commit('용');

    await expect(palette.getByText('상품', { exact: true })).toHaveCount(0);
  });

  test('lists no table or comment for a word composed with no prefix, and offers it to the prefixes', async ({
    erd,
    page,
  }) => {
    await erd.seed(koreanSchema());
    await erd.focusHost();
    const palette = erd.host.locator('.quick-search');
    const input = palette.locator('input');
    const { compose, commit } = await ime(page);

    await erd.press(Shortcut.search);
    await compose('사');
    await commit('사');
    await compose('용');
    await commit('용');

    await expect(input).toHaveValue('사용');
    await expect(palette.locator('.quick-search-empty')).toBeVisible();
    await expect(palette.getByText(/^사용자\s*Table$/)).toHaveCount(0);
    await expect(palette.getByText('주문한 사용자')).toHaveCount(0);

    await erd.page.keyboard.press('ArrowUp');
    await erd.page.keyboard.press('Enter');

    await expect(input).toHaveValue('"사용');
    await expect(palette.getByText('주문한 사용자')).toHaveCount(1);
  });

  test('picks a row by the keys only once the IME has finished the syllable', async ({
    erd,
    page,
  }) => {
    await erd.seed(koreanSchema());
    await erd.focusHost();
    const palette = erd.host.locator('.quick-search');
    const { compose, commit } = await ime(page);

    await erd.press(Shortcut.search);
    await erd.page.keyboard.type('#');
    await compose('ㅈ');
    await compose('ㅈㅁ');
    await erd.page.keyboard.press('ArrowDown');
    await erd.page.keyboard.press('Enter');

    await expect(palette).toHaveCount(1);
    await expect(palette.locator('.selected')).toHaveCount(0);

    await commit('ㅈㅁ');
    await erd.page.keyboard.press('ArrowDown');
    await expect(palette.locator('.selected')).toHaveText(/^주문 내역/);
    await erd.page.keyboard.press('Enter');

    await expect(palette).toHaveCount(0);
    await expect(erd.tableEl('orders')).toHaveAttribute('data-selected', '');
  });

  test('goes to a table by its initials and to a column by an unfinished syllable', async ({
    erd,
    page,
  }) => {
    await erd.seed(koreanSchema());
    await erd.focusHost();
    const palette = erd.host.locator('.quick-search');
    const { compose } = await ime(page);

    await erd.press(Shortcut.search);
    await erd.page.keyboard.type('#');
    await compose('ㅈ');
    await compose('ㅈㅁ');
    await expect(palette.getByText('주문 내역', { exact: true })).toHaveCount(
      1
    );
    await expect(palette.getByText('사용자', { exact: true })).toHaveCount(0);

    await erd.page.keyboard.press('ControlOrMeta+KeyA');
    await erd.page.keyboard.type('@');
    await compose('ㅅ');
    await compose('사');
    await palette.getByText('상품.상품명 · Column', { exact: true }).click();

    await expect(palette).toHaveCount(0);
    await expect
      .poll(() => erd.focusRingCells())
      .toEqual(['products_name:columnName']);
  });
});
