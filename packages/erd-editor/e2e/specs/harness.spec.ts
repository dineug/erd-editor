import { expect, test } from '../support/fixtures';
import { twoTables } from '../support/schema';

/**
 * Guards the assumptions every other spec is built on. If one of these fails,
 * the failures elsewhere are noise — fix this file first.
 */
test.describe('e2e harness', () => {
  test('pierces the editor shadow root and finds exactly one canvas', async ({
    erd,
  }) => {
    await expect(erd.canvas).toHaveCount(1);
    await expect(erd.toolbar).toHaveCount(1);
  });

  test('seeds a document and renders it', async ({ erd }) => {
    await erd.seed(twoTables());

    expect(await erd.tableIds()).toEqual(['users', 'posts']);
    await expect(erd.tableEl('users')).toBeVisible();
    await expect(erd.tableEl('posts')).toBeVisible();
    await expect(erd.canvas.locator('.table')).toHaveCount(2);
    await expect(erd.canvas.locator('.column-row')).toHaveCount(4);
  });

  test('a seeded document leaves undo history empty', async ({ erd }) => {
    await erd.seed(twoTables());

    await expect(erd.toolbarButton('Undo')).not.toHaveClass(/\bactive\b/);
    await expect(erd.toolbarButton('Redo')).not.toHaveClass(/\bactive\b/);
  });

  test('the minimap mirrors the canvas without polluting canvas locators', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    // The minimap renders its own copy of every table; the canvas-scoped
    // locator must not see it.
    await expect(erd.minimap.locator('.table')).toHaveCount(2);
    await expect(erd.canvas.locator('.table')).toHaveCount(2);
    await expect(erd.host.locator('.table')).toHaveCount(4);
  });

  test('canvas coordinates map to schema coordinates', async ({ erd }) => {
    await erd.seed(twoTables());

    const users = await erd.table('users');
    const expected = await erd.pointAt(users.ui.x, users.ui.y);
    const box = await erd.tableEl('users').boundingBox();

    expect(box).not.toBeNull();
    expect(box!.x).toBeCloseTo(expected.x, 0);
    expect(box!.y).toBeCloseTo(expected.y, 0);
  });
});
