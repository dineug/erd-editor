import type { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { createSchema, type ErdDocument, twoTables } from '../support/schema';
import { Shortcut } from '../support/shortcuts';

// AC-I9. The bar that opens the picker is a scene node and the picker is dom,
// so the press has to hand over a viewport point konva never dealt in, and the
// colour has to come back the other way onto a node attr.

const COLOR = '#FF8800';

function withMemo(): ErdDocument {
  const document = twoTables();
  const memo = createSchema({
    memos: [{ id: 'note', value: 'a memo', x: 320, y: 560 }],
  });

  document.doc.memoIds = memo.doc.memoIds;
  document.collections.memoEntities = memo.collections.memoEntities;

  return document;
}

/** withMemo with every entity coloured, each its own colour. */
function colored(): ErdDocument {
  const document = withMemo();
  document.collections.tableEntities.users.ui.color = COLOR;
  document.collections.tableEntities.posts.ui.color = '#3b82f6';
  document.collections.memoEntities.note.ui.color = '#22c55e';

  return document;
}

async function colorsOf(erd: ErdEditorPage): Promise<string[]> {
  const { collections } = await erd.value();
  return [
    collections.tableEntities.users.ui.color,
    collections.tableEntities.posts.ui.color,
    collections.memoEntities.note.ui.color,
  ].map(color => color.toLowerCase());
}

/** A point on the memo's header strip, clear of its colour bar and remove button. */
async function memoHeaderPoint(erd: ErdEditorPage) {
  const box = await erd.sceneBox('#memo-note');
  return { x: box.x + 20, y: box.y + 8 };
}

test.describe('entity colour', () => {
  test('the colour edge opens the picker under the pointer', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    await expect(erd.colorPicker).toHaveCount(0);

    const bar = await erd.sceneBox(['#table-users', '.table-header-color']);
    const point = { x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 };
    await erd.clickAt(point);

    await expect(erd.colorPicker).toBeVisible();

    // The picker is placed from the pointer the scene node reported, so it
    // opens against the bar that was pressed rather than at the origin.
    const box = await erd.colorPicker.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.x ?? 0).toBeGreaterThan(point.x - 40);
    expect(box?.y ?? 0).toBeGreaterThan(point.y - 40);
  });

  test('a right click on the colour edge opens the table menu and no picker', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    const bar = await erd.sceneBox(['#table-users', '.table-header-color']);
    const point = { x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 };
    await erd.clickAt(point, { button: 'right' });
    await erd.whenDrawn();

    // The table's own menu answers, so the right click landed on the table,
    // whose edge answers the main button alone.
    await expect(erd.contextMenuItem('Table Properties')).toBeVisible();
    await expect(erd.colorPicker).toHaveCount(0);
  });

  test('a colour picked for a table reaches the node and the store', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    expect((await erd.table('users')).ui.color).toBe('');

    const bar = await erd.sceneBox(['#table-users', '.table-header-color']);
    await erd.clickAt({ x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 });
    await expect(erd.colorPicker).toBeVisible();

    await erd.pickColor(COLOR);

    await expect
      .poll(async () => (await erd.table('users')).ui.color.toLowerCase())
      .toBe(COLOR.toLowerCase());
    await expect
      .poll(async () => {
        const fill = await erd.sceneAttr(
          ['#table-users', '.table-header-color'],
          'fill'
        );
        return String(fill).toLowerCase();
      })
      .toBe(COLOR.toLowerCase());

    // The table that was never in the selection keeps its own bare bar.
    expect((await erd.table('posts')).ui.color).toBe('');
  });

  test('the colour lands on every entity in the selection', async ({ erd }) => {
    await erd.seed(withMemo());

    await erd.marqueeSelect({ x: 120, y: 120 }, { x: 1200, y: 800 });
    await expect(erd.selectedTables()).toHaveCount(2);
    await expect(erd.canvas.locator('.memo[data-selected]')).toHaveCount(1);

    // The press on a bar selects the entity it belongs to, and without the
    // modifier that replaces the selection the colour is meant to reach.
    const bar = await erd.sceneBox(['#memo-note', '.memo-header-color']);
    const mod = await erd.pointerModKey();
    await erd.page.keyboard.down(mod);
    await erd.clickAt({ x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 });
    await erd.page.keyboard.up(mod);

    await expect(erd.colorPicker).toBeVisible();
    await expect(erd.selectedTables()).toHaveCount(2);

    await erd.pickColor(COLOR);

    await expect
      .poll(async () => {
        const value = await erd.value();
        return [
          value.collections.tableEntities.users.ui.color,
          value.collections.tableEntities.posts.ui.color,
          value.collections.memoEntities.note.ui.color,
        ].map(color => color.toLowerCase());
      })
      .toEqual([COLOR, COLOR, COLOR].map(color => color.toLowerCase()));
  });

  test('pressing bare canvas closes the picker and keeps the colour', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    const bar = await erd.sceneBox(['#table-users', '.table-header-color']);
    await erd.clickAt({ x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 });
    await expect(erd.colorPicker).toBeVisible();
    await erd.pickColor(COLOR);

    await erd.clickAt(await erd.emptyPoint());

    await expect(erd.colorPicker).toHaveCount(0);
    await expect
      .poll(async () => (await erd.table('users')).ui.color.toLowerCase())
      .toBe(COLOR.toLowerCase());
  });

  test('No color under the picker clears every entity in the selection, as one undo', async ({
    erd,
  }) => {
    await erd.seed(colored());

    await erd.marqueeSelect({ x: 120, y: 120 }, { x: 1200, y: 800 });
    await expect(erd.selectedTables()).toHaveCount(2);

    const bar = await erd.sceneBox(['#memo-note', '.memo-header-color']);
    const mod = await erd.pointerModKey();
    await erd.page.keyboard.down(mod);
    await erd.clickAt({ x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 });
    await erd.page.keyboard.up(mod);
    await expect(erd.colorPicker).toBeVisible();

    await erd.colorPicker.getByRole('button', { name: 'No color' }).click();

    await expect(erd.colorPicker).toHaveCount(0);
    await expect.poll(() => colorsOf(erd)).toEqual(['', '', '']);

    // The button held the keyboard and left with the picker, so the chord
    // reaches the editor; one undo brings back all three colours.
    await expect(erd.toolbarButton('Undo')).toHaveClass(/\bactive\b/);
    await erd.page.keyboard.press(Shortcut.undo);

    await expect
      .poll(() => colorsOf(erd))
      .toEqual([COLOR.toLowerCase(), '#3b82f6', '#22c55e']);
  });

  test('Space presses No color rather than the hand tool', async ({ erd }) => {
    await erd.seed(colored());
    const canvas = erd.host.locator('[data-testid="erd-canvas"]');

    const bar = await erd.sceneBox(['#memo-note', '.memo-header-color']);
    await erd.clickAt({ x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 });
    await expect(erd.colorPicker).toBeVisible();

    // The hand tool's Space is cancelled at the editor, which would take the
    // click from the button and leave the canvas in the hand tool instead.
    await erd.colorPicker.getByRole('button', { name: 'No color' }).focus();
    await erd.press(Shortcut.handTool);

    await expect(erd.colorPicker).toHaveCount(0);
    await expect
      .poll(() => colorsOf(erd))
      .toEqual([COLOR.toLowerCase(), '#3b82f6', '']);
    await expect(canvas).toHaveCSS('pointer-events', 'auto');
  });

  test('the table menu offers Remove color only while the selection holds a colour', async ({
    erd,
  }) => {
    const document = twoTables();
    document.collections.tableEntities.users.ui.color = COLOR;
    await erd.seed(document);

    await erd.clickAt(await erd.tableHeaderPoint('posts'), { button: 'right' });
    await expect(
      erd.contextMenu.getByText('Color', { exact: true })
    ).toBeVisible();
    await expect(
      erd.contextMenu.getByText('Remove color', { exact: true })
    ).toHaveCount(0);

    await erd.clickAt(await erd.tableHeaderPoint('users'), { button: 'right' });
    await erd.contextMenu.getByText('Remove color', { exact: true }).click();

    await expect(erd.contextMenu).toHaveCount(0);
    await expect.poll(async () => (await erd.table('users')).ui.color).toBe('');
    await expect
      .poll(async () => {
        const fill = await erd.sceneAttr(
          ['#table-users', '.table-header-color'],
          'fill'
        );
        return String(fill).toLowerCase();
      })
      .not.toBe(COLOR.toLowerCase());
  });

  test('the memo menu offers Remove color between Color and Delete', async ({
    erd,
  }) => {
    const document = withMemo();
    document.collections.memoEntities.note.ui.color = COLOR;
    await erd.seed(document);

    await erd.clickAt(await memoHeaderPoint(erd), { button: 'right' });

    const rows = erd.host
      .locator('.context-menu-content[data-id="root"]')
      .locator(':scope > div:not(.context-menu-content)');
    await expect(rows).toHaveText([/Color/, /Remove color/, /Delete/]);
    await rows.nth(1).click();

    await expect(erd.contextMenu).toHaveCount(0);
    await expect
      .poll(
        async () => (await erd.value()).collections.memoEntities.note.ui.color
      )
      .toBe('');
  });
});
