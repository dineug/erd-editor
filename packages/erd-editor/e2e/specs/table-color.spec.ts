import { expect, test } from '../support/fixtures';
import { createSchema, type ErdDocument, twoTables } from '../support/schema';

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

test.describe('entity colour', () => {
  test('the colour bar opens the picker under the pointer', async ({ erd }) => {
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
});
