import { expect, test } from '../support/fixtures';
import { createSchema, type ErdDocument } from '../support/schema';

// AC-I8. Zoomed out, a table is one box with a name in it, and the header the
// full table is dragged by is not drawn at all. So the gesture moves onto the
// body, and the two blocked areas that survive are the bar and nothing else.

/** The zoom at and below which the scene swaps in the simplified table. */
const SWAP_ZOOM = 0.7;

function zoomedOut(zoomLevel = SWAP_ZOOM): ErdDocument {
  return createSchema({
    zoomLevel,
    tables: [
      {
        id: 'users',
        name: 'users',
        x: 300,
        y: 300,
        columns: [
          { id: 'users_id', name: 'id', dataType: 'int' },
          { id: 'users_name', name: 'name', dataType: 'varchar(255)' },
        ],
      },
      {
        id: 'posts',
        name: 'posts',
        x: 1000,
        y: 700,
        columns: [{ id: 'posts_id', name: 'id', dataType: 'int' }],
      },
    ],
  });
}

test.describe('simplified table', () => {
  test('the swap keeps the table box and drops every row in it', async ({
    erd,
  }) => {
    await erd.seed(zoomedOut(SWAP_ZOOM + 0.05));

    await expect(erd.canvas.locator('.high-level-table')).toHaveCount(0);
    await expect(erd.canvas.locator('.column-row')).toHaveCount(3);

    await erd.seed(zoomedOut());

    await expect(erd.canvas.locator('.high-level-table')).toHaveCount(2);
    await expect(erd.canvas.locator('.column-row')).toHaveCount(0);
    await expect(erd.canvas.locator('.table')).toHaveCount(2);
    expect(await erd.hasSceneNode('#table-users')).toBe(true);
  });

  test('a simplified table drags from anywhere on its body', async ({
    erd,
  }) => {
    await erd.seed(zoomedOut());

    const before = await erd.table('users');
    const box = await erd.sceneBox('#table-users');
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await erd.drag(from, { x: from.x + 140, y: from.y + 70 });

    // Screen travel over the zoom is what the table itself moves by.
    const after = await erd.table('users');
    expect(after.ui.x).toBeCloseTo(before.ui.x + 140 / SWAP_ZOOM, 0);
    expect(after.ui.y).toBeCloseTo(before.ui.y + 70 / SWAP_ZOOM, 0);
  });

  test('a press selects a simplified table and the modifier adds to it', async ({
    erd,
  }) => {
    await erd.seed(zoomedOut());

    await expect(erd.selectedTables()).toHaveCount(0);

    const users = await erd.sceneBox('#table-users');
    await erd.clickAt({ x: users.x + 20, y: users.y + users.height / 2 });

    await expect(erd.selectedTables()).toHaveCount(1);
    await expect
      .poll(() => erd.sceneAttr('#table-users', 'selected'))
      .toBe(true);

    const posts = await erd.sceneBox('#table-posts');
    await erd.page.keyboard.down(await erd.pointerModKey());
    await erd.clickAt({ x: posts.x + 20, y: posts.y + posts.height / 2 });
    await erd.page.keyboard.up(await erd.pointerModKey());

    await expect(erd.selectedTables()).toHaveCount(2);
  });

  test('the colour bar on a simplified table opens the picker and never drags', async ({
    erd,
  }) => {
    await erd.seed(zoomedOut());

    const before = await erd.table('users');
    const bar = await erd.sceneBox(['#table-users', '.table-header-color']);
    const from = { x: bar.x + bar.width / 2, y: bar.y + bar.height / 2 };
    await erd.drag(from, { x: from.x + 120, y: from.y + 60 });

    const after = await erd.table('users');
    expect([after.ui.x, after.ui.y]).toEqual([before.ui.x, before.ui.y]);
    await expect(erd.selectedTables()).toHaveCount(1);

    // A drag is a press and a release at two points, so it is never a click:
    // the picker is what the same press opens when the pointer stays put.
    await expect(erd.colorPicker).toHaveCount(0);

    await erd.clickAt(from);
    await expect(erd.colorPicker).toBeVisible();
  });
});
