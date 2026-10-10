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
const scopeOf = (erd: ErdEditorPage, field: string) =>
  panelOf(erd).locator(`.find-scope[data-field="${field}"]`);
const pressedScopesOf = (erd: ErdEditorPage) =>
  panelOf(erd).locator('.find-scope[aria-pressed="true"]');

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
    peer.setInitialValue(local.runtimeValue);

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

/**
 * Where a range of the text a scene node draws stands on screen across, its
 * start and end measured in the node's own font, the way the canvas lays out
 * the glyphs, rather than by the measure the editor sizes its cells with.
 */
async function drawnRange(
  erd: ErdEditorPage,
  path: string[],
  start: number,
  end: number
) {
  return erd.page.evaluate(
    ([target, from, to]) => {
      const stage = Reflect.get(window, '__erdStages')?.canvas;
      let node: any = stage;
      for (const step of target) node = node?.findOne?.(step);
      const text: string = node.text();
      const rect = node.getClientRect({ relativeTo: stage });
      const origin = stage.container().getBoundingClientRect();
      const scale = rect.width / node.width();
      const at = (index: number) =>
        origin.x +
        rect.x +
        node.measureSize(text.slice(0, index)).width * scale;

      return { left: at(from), right: at(to) };
    },
    [path, start, end] as const
  );
}

test.describe('Find and Replace', () => {
  test('walks the matches on the canvas, typing nothing into it', async ({
    erd,
  }) => {
    await erd.seed(schema());
    await openFind(erd, 'user');
    await expect(countOf(erd)).toHaveText('2 matches');

    await erd.press(Shortcut.addTable);
    await erd.press('Enter');

    await expect(countOf(erd)).toHaveText('1 of 2');
    await expect(panelOf(erd).locator('.find-input')).toBeFocused();
    expect(await erd.tableIds()).toEqual(['users', 'orders']);
    await expect(erd.editInput()).toHaveCount(0);

    await erd.press('Escape');

    await expect(panelOf(erd)).toHaveCount(0);
    await erd.expectKeyboardFocusInside();
  });

  test('opens first on the names alone, so a Replace All leaves the comments and the memo as they were', async ({
    erd,
  }) => {
    await erd.seed(schema());
    await openFind(erd, 'user');

    await expect(pressedScopesOf(erd)).toHaveText([
      'Table names',
      'Column names',
    ]);
    await expect(countOf(erd)).toHaveText('2 matches');
    await panelOf(erd).locator('.replace-input').fill('member');
    await panelOf(erd).locator('.find-replace-all').click();

    await expect(countOf(erd)).toHaveText('Replaced 2 matches');
    const { collections } = await erd.value();
    expect(collections.tableEntities.users).toMatchObject({
      name: 'members',
      comment: 'Registered user accounts',
    });
    expect(collections.tableColumnEntities.orders_user_id.name).toBe(
      'member_id'
    );
    expect(collections.tableColumnEntities.users_id.comment).toBe('user id');
    expect(collections.memoEntities.note.value).toBe('Rename user to member');

    // A scope set stays for as long as the element lives.
    await scopeOf(erd, 'memo').click();
    await erd.press('Escape');
    await erd.focusHost();
    await erd.press(Shortcut.findReplace);

    await expect(pressedScopesOf(erd)).toHaveText([
      'Table names',
      'Column names',
      'Memos',
    ]);
  });

  test('takes its chord from the canvas, its own field, the palette and a cell editor, no page find opening', async ({
    erd,
    page,
  }) => {
    await erd.seed(schema());
    await page.evaluate(() => {
      Reflect.set(window, '__finds', []);
      window.addEventListener(
        'keydown',
        event => {
          if (event.code === 'KeyF') Reflect.get(window, '__finds').push(event);
        },
        true
      );
    });
    const prevented = () =>
      page.evaluate(() =>
        (Reflect.get(window, '__finds') as KeyboardEvent[]).map(
          event => event.defaultPrevented
        )
      );
    const palette = erd.host.locator('.quick-search');
    const findInput = panelOf(erd).locator('.find-input');

    await openFind(erd, 'user');
    await erd.press('Enter');
    await expect(countOf(erd)).toHaveText('1 of 2');

    // Pressed again in its own field it stays open, the query selected.
    await erd.press(Shortcut.findReplace);
    await expect(panelOf(erd)).toHaveCount(1);
    await expect(findInput).toBeFocused();
    expect(
      await findInput.evaluate((input: HTMLInputElement) => [
        input.selectionStart,
        input.selectionEnd,
      ])
    ).toEqual([0, 4]);
    await expect(countOf(erd)).toHaveText('1 of 2');

    // The palette gives way to it, as its own Find and Replace row does.
    await erd.press(Shortcut.search);
    await erd.page.keyboard.type('auto');
    await expect(palette).toHaveCount(1);
    await erd.press(Shortcut.findReplace);
    await expect(palette).toHaveCount(0);
    await expect(findInput).toBeFocused();
    await expect(findInput).toHaveValue('user');

    // A cell editor keeps it, as it keeps the palette's chord.
    await erd.press('Escape');
    await expect(panelOf(erd)).toHaveCount(0);
    const cell = erd.cell(erd.columnEl('users_email'), 'columnName');
    await cell.dblclick();
    await expect(erd.editInput(cell)).toBeFocused();
    await erd.press(Shortcut.findReplace);
    await expect(erd.editInput(cell)).toBeFocused();
    await expect(panelOf(erd)).toHaveCount(0);

    expect(await prevented()).toEqual([true, true, true, true]);
  });

  test('takes its chord on every other tab too, bringing the ERD tab up, no page find opening', async ({
    erd,
    page,
  }) => {
    await erd.seed(schema());
    await page.evaluate(() => {
      Reflect.set(window, '__finds', []);
      window.addEventListener(
        'keydown',
        event => {
          if (event.code === 'KeyF') Reflect.get(window, '__finds').push(event);
        },
        true
      );
    });
    const prevented = () =>
      page.evaluate(() =>
        (Reflect.get(window, '__finds') as KeyboardEvent[]).map(
          event => event.defaultPrevented
        )
      );
    const findInput = panelOf(erd).locator('.find-input');

    for (const tab of [
      'Visualization',
      'Schema SQL',
      'Code Generator',
      'Settings',
    ]) {
      await erd.toolbarButton(tab).click();
      expect((await erd.settings()).canvasType).not.toBe('ERD');
      await erd.focusHost();
      await erd.press(Shortcut.findReplace);

      expect((await erd.settings()).canvasType).toBe('ERD');
      await expect(findInput).toBeFocused();
      await erd.press('Escape');
      await expect(panelOf(erd)).toHaveCount(0);
    }
    // Prevented, so a browser opens no find bar over any of them.
    expect(await prevented()).toEqual([true, true, true, true]);
  });

  test('leaves its chord to the page find under time travel, and takes it once that closes', async ({
    erd,
    page,
  }) => {
    await erd.seed(schema());
    await page.evaluate(() => {
      Reflect.set(window, '__finds', []);
      window.addEventListener('keydown', event => {
        if (event.code === 'KeyF') Reflect.get(window, '__finds').push(event);
      });
    });
    const heard = () =>
      page.evaluate(() =>
        (Reflect.get(window, '__finds') as KeyboardEvent[]).map(
          event => event.defaultPrevented
        )
      );

    // An edit, so time travel has a history to open on.
    await erd.focusHost();
    await erd.press(Shortcut.addTable);
    await erd.toolbarButton('Time Travel').click();
    await expect(erd.toolbarButton('Undo')).toHaveCount(0);

    await erd.focusHost();
    await erd.press(Shortcut.findReplace);
    await expect(panelOf(erd)).toHaveCount(0);
    // Heard by the page unprevented, so the host's find opens there.
    expect(await heard()).toEqual([false]);

    await erd.press('Escape');
    await expect(erd.toolbarButton('Undo')).toHaveCount(1);
    await erd.focusHost();
    await erd.press(Shortcut.findReplace);

    await expect(panelOf(erd).locator('.find-input')).toBeFocused();
    expect(await heard()).toEqual([false]);
  });

  test('opens from its toolbar button on any tab, which stays put and greys out under time travel', async ({
    erd,
  }) => {
    await erd.seed(schema());
    const button = erd.toolbarButton('Find and Replace');

    // An edit, so time travel has a history to open on.
    await erd.focusHost();
    await erd.press(Shortcut.addTable);
    await erd.toolbarButton('Time Travel').click();
    await expect(erd.toolbarButton('Undo')).toHaveCount(0);

    await expect(button).toHaveClass(/\bdisabled\b/);
    await button.click();
    await expect(panelOf(erd)).toHaveCount(0);

    await erd.press('Escape');
    await expect(erd.toolbarButton('Undo')).toHaveCount(1);
    await expect(button).not.toHaveClass(/\bdisabled\b/);

    await erd.toolbarButton('Schema SQL').click();
    expect((await erd.settings()).canvasType).toContain('builtin-schema-sql');
    await expect(button).toBeVisible();
    await button.click();

    expect((await erd.settings()).canvasType).toBe('ERD');
    await expect(panelOf(erd).locator('.find-input')).toBeFocused();

    // Pressed with the panel shown, it keeps the current match, as the chord does.
    await erd.page.keyboard.type('user');
    await erd.press('Enter');
    await expect(countOf(erd)).toHaveText('1 of 2');
    await button.click();
    await expect(panelOf(erd).locator('.find-input')).toBeFocused();
    await expect(countOf(erd)).toHaveText('1 of 2');
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
    // A first opening searches the names alone, so the comments and memo are let in.
    for (const field of ['tableComment', 'columnComment', 'memo']) {
      await scopeOf(erd, field).click();
    }
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

  test('lands a match at the end of a comment wider than the canvas where it shows, clear of the panel', async ({
    erd,
  }) => {
    const comment = `${'the address the courier prints on the label, '.repeat(5)}see zebra`;
    await erd.seed(
      createSchema({
        tables: [
          {
            id: 'shipments',
            name: 'shipments',
            x: 2600,
            y: 1800,
            columns: [{ id: 'shipments_address', name: 'address', comment }],
          },
        ],
      })
    );
    await openFind(erd, 'zebra');
    // A first opening searches the names alone, so the column comments are let in.
    await scopeOf(erd, 'columnComment').click();
    await expect(countOf(erd)).toHaveText('1 match');

    await panelOf(erd).locator('.find-replace-match').first().click();

    await expect
      .poll(() => erd.focusRingCells())
      .toEqual(['shipments_address:columnComment']);
    await erd.whenDrawn();
    const canvas = await erd.canvas.boundingBox();
    const panel = await panelOf(erd).boundingBox();
    const cell = await erd.sceneBox([
      '#column-shipments_address',
      '.columnComment',
    ]);
    const found = await drawnRange(
      erd,
      ['#column-shipments_address', '.columnComment', '.cell-text'],
      comment.length - 'zebra'.length,
      comment.length
    );
    // Wider than the canvas beside the panel, the cell starts under the panel.
    expect(cell.width).toBeGreaterThan(
      canvas!.x + canvas!.width - (panel!.x + panel!.width)
    );
    expect(found.left).toBeGreaterThanOrEqual(panel!.x + panel!.width);
    expect(found.right).toBeLessThanOrEqual(canvas!.x + canvas!.width);
  });

  test('offers no replace in a read-only editor', async ({ erd, page }) => {
    await erd.seed(schema());
    await page.evaluate(() => {
      document.querySelector('erd-editor')!.readonly = true;
    });

    await openFind(erd, 'user');

    await expect(panelOf(erd)).toContainText('Find');
    await expect(panelOf(erd).locator('.replace-input')).toHaveCount(0);
    await expect(countOf(erd)).toHaveText('2 matches');
  });
});

test.describe('quick search over columns, comments and memos', () => {
  test('lands on a column comment from another tab', async ({ erd }) => {
    await erd.seed(schema());
    await erd.toolbarButton('Schema SQL').click();
    await erd.focusHost();

    await erd.press(Shortcut.search);
    await erd.page.keyboard.type(':login');
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
    await expect(palette.locator('.quick-search-hint button')).toHaveCount(4);
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

  test('lists under #us the table holding it, and no table or field once the # is deleted', async ({
    erd,
  }) => {
    await erd.seed(schema());
    await erd.focusHost();
    const palette = erd.host.locator('.quick-search');

    await erd.press(Shortcut.search);
    await erd.page.keyboard.type('#us');
    await expect(palette.getByText(/^users\s*Table$/)).toHaveCount(1);
    // Fuzzed at 0.4, us no longer reaches orders, which fuse.js's 0.6 did.
    await expect(palette.getByText(/^orders\s*Table$/)).toHaveCount(0);

    await erd.page.keyboard.press('ArrowLeft');
    await erd.page.keyboard.press('ArrowLeft');
    await erd.page.keyboard.press('Backspace');

    await expect(palette.locator('input')).toHaveValue('us');
    await expect(palette.locator('.quick-search-scope')).toHaveCount(0);
    await expect(palette.getByText(/^users\s*Table$/)).toHaveCount(0);
    await expect(palette.getByText('users.id · Column comment')).toHaveCount(0);
    // No command holds us or fuzzes to it, so the prefixes are all it lists.
    await expect(palette.locator('.quick-search-empty')).toHaveText(
      'No commands match'
    );
    await expect(palette.locator('.scrollbar > div')).toHaveText([
      /^#\s*Search tables for "us"$/,
      /^@\s*Search columns for "us"$/,
      /^:\s*Search comments & memos for "us"$/,
    ]);
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
    await erd.page.keyboard.type('orders');

    await expect(rows).toHaveText([
      /^#\s*Search tables for "orders"$/,
      /^@\s*Search columns for "orders"$/,
      /^:\s*Search comments & memos for "orders"$/,
    ]);
    // No command holds orders or even fuzzes to it.
    await expect(palette.locator('.quick-search-empty')).toHaveText(
      'No commands match'
    );

    await erd.page.keyboard.press('ArrowDown');
    await erd.page.keyboard.press('Enter');

    await expect(input).toHaveValue('#orders');
    await expect(input).toBeFocused();
    await expect(palette.locator('.quick-search-scope')).toHaveText('Tables');
    await expect(palette.locator('.quick-search-empty')).toHaveCount(0);

    await erd.page.keyboard.press('ArrowDown');
    await expect(palette.locator('.selected')).toHaveText(/^orders/);
    await erd.page.keyboard.press('Enter');

    await expect(palette).toHaveCount(0);
    await expect(erd.tableEl('orders')).toHaveAttribute('data-selected', '');
  });

  test('searches every command afresh on each keystroke, whatever the last one found', async ({
    erd,
  }) => {
    await erd.seed(schema());
    await erd.focusHost();
    const palette = erd.host.locator('.quick-search');
    const offered = palette.getByText(/Search tables for/);
    const autoLayout = palette.getByText('Auto Layout', { exact: true });

    await erd.press(Shortcut.search);
    await erd.page.keyboard.type('qqqq');
    await expect(palette.locator('.quick-search-empty')).toHaveText(
      'No commands match'
    );

    await erd.page.keyboard.press('ControlOrMeta+KeyA');
    await erd.page.keyboard.type('auto');

    await expect(autoLayout).toHaveCount(1);
    await expect(palette.locator('.quick-search-empty')).toHaveCount(0);
    await expect(offered).toHaveCount(0);

    await erd.page.keyboard.press('ControlOrMeta+KeyA');
    await erd.page.keyboard.type('users');
    await expect(palette.locator('.quick-search-empty')).toHaveText(
      'No commands match'
    );
    await expect(offered).toHaveCount(1);
    await expect(autoLayout).toHaveCount(0);
    for (let press = 0; press < 4; press++) {
      await erd.page.keyboard.press('Backspace');
    }

    await expect(palette.locator('input')).toHaveValue('u');
    await expect(autoLayout).toHaveCount(1);
    await expect(offered).toHaveCount(0);
    await expect(palette.locator('.quick-search-empty')).toHaveCount(0);
  });

  test('offers a table name typed, pasted in or left once its # is deleted, to the prefixes alone', async ({
    erd,
  }) => {
    await erd.seed(schema());
    await erd.focusHost();
    const palette = erd.host.locator('.quick-search');
    const rows = palette.locator('.scrollbar > div');
    const input = palette.locator('input');
    /** The three prefixes under the line, users fuzzing to no command at 0.4. */
    const expectListed = async () => {
      await expect(palette.locator('.quick-search-empty')).toHaveText(
        'No commands match'
      );
      await expect(rows).toHaveText([
        /^#\s*Search tables for "users"$/,
        /^@\s*Search columns for "users"$/,
        /^:\s*Search comments & memos for "users"$/,
      ]);
    };

    await erd.press(Shortcut.search);
    await erd.page.keyboard.type('users');

    await expectListed();

    await erd.page.keyboard.press('ControlOrMeta+KeyA');
    await erd.page.keyboard.insertText('users');
    await expectListed();

    for (const key of ['ArrowUp', 'ArrowUp', 'ArrowUp', 'Enter']) {
      await erd.page.keyboard.press(key);
    }
    await expect(input).toHaveValue('#users');
    await expect(palette.getByText(/^users\s*Table$/)).toHaveCount(1);

    await erd.page.keyboard.press('Home');
    await erd.page.keyboard.press('Delete');

    await expect(input).toHaveValue('users');
    await expect(palette.locator('.quick-search-scope')).toHaveCount(0);
    await expectListed();
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

    await expect(input).toHaveValue(':사용');
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
