import type { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { createSchema } from '../support/schema';

/**
 * The Explorer in the real element: docked left of a canvas it narrows rather
 * than covers, the tree a click jumps from, the keys it keeps, its edge, and
 * where it stands in a right-to-left language and on a narrow window.
 */

const schema = () =>
  createSchema({
    tables: [
      {
        id: 'users',
        name: 'users',
        x: 520,
        y: 160,
        columns: [{ id: 'users_id', name: 'id', dataType: 'int' }],
      },
      {
        id: 'orders',
        name: 'orders',
        x: 1800,
        y: 1400,
        columns: [{ id: 'orders_user_id', name: 'user_id', dataType: 'int' }],
      },
    ],
    memos: [{ id: 'note', value: 'Order states', x: 520, y: 560 }],
  });

const explorerOf = (erd: ErdEditorPage) => erd.host.locator('.explorer');
const rowOf = (erd: ErdEditorPage, nodeId: string) =>
  explorerOf(erd).locator(`[role="treeitem"][id$=":${nodeId}"]`);
const boxOf = async (erd: ErdEditorPage, selector: string) =>
  (await erd.host.locator(selector).first().boundingBox())!;

async function open(erd: ErdEditorPage) {
  await erd.toolbar.locator('.toolbar-explorer').click();
  await expect(explorerOf(erd)).toBeVisible();
}

test.describe('explorer', () => {
  test('opens beside the canvas from the toolbar, narrowing it by its width and moving no origin (AC-S2, AC-S4)', async ({
    erd,
  }) => {
    await erd.seed(schema());
    const before = await erd.settings();
    const root = await boxOf(erd, '.root');

    await open(erd);

    const panel = await boxOf(erd, '.explorer');
    const canvas = await boxOf(erd, '[data-testid="erd-canvas"]');
    expect(panel.width).toBe(260);
    expect(panel.x).toBeCloseTo(root.x, 0);
    expect(panel.width + canvas.width).toBeCloseTo(root.width, 0);
    expect(canvas.x).toBeCloseTo(panel.x + panel.width, 0);
    const after = await erd.settings();
    expect(after.originX).toBe(before.originX);
    expect(after.originY).toBe(before.originY);
    await expect(erd.toolbarButton('Explorer')).toHaveClass(/\bactive\b/);
  });

  test('jumps to the table a click picks and keeps the keyboard in the tree, which Escape gives back (AC-N1, AC-N9, AC-S11)', async ({
    erd,
  }) => {
    await erd.seed(schema());
    await open(erd);

    await rowOf(erd, 't:orders').click();

    await expect(erd.selectedTables()).toHaveCount(1);
    await expect(erd.selectedTables()).toHaveAttribute('data-id', 'orders');
    await expect(explorerOf(erd).locator('[role="tree"]')).toBeFocused();

    await erd.page.keyboard.press('ArrowDown');
    await expect(explorerOf(erd).locator('[role="tree"]')).toHaveAttribute(
      'aria-activedescendant',
      /:t:users$/
    );
    // The arrow moved the row, never the canvas or the selection.
    await expect(erd.selectedTables()).toHaveAttribute('data-id', 'orders');

    await erd.page.keyboard.press('Escape');
    await expect(explorerOf(erd).locator('[role="tree"]')).not.toBeFocused();
    await expect(explorerOf(erd)).toBeVisible();
  });

  test('selects the child table and its key column for a foreign key, the column focused (AC-N3)', async ({
    erd,
  }) => {
    await erd.seed(
      createSchema({
        tables: [
          {
            id: 'users',
            name: 'users',
            x: 520,
            y: 160,
            columns: [{ id: 'users_id', name: 'id', dataType: 'int' }],
          },
          {
            id: 'orders',
            name: 'orders',
            x: 1800,
            y: 1400,
            columns: [
              { id: 'orders_id', name: 'id', dataType: 'int' },
              { id: 'orders_user_id', name: 'user_id', dataType: 'int' },
            ],
          },
        ],
        relationships: [
          {
            id: 'rel',
            startTableId: 'users',
            startColumnIds: ['users_id'],
            endTableId: 'orders',
            endColumnIds: ['orders_user_id'],
          },
        ],
      })
    );
    await open(erd);

    await rowOf(erd, 't:orders').locator('.tree-twisty').click();
    await rowOf(erd, 't:orders/f:foreignKeys').click();
    await rowOf(erd, 'r:rel').click();

    await expect(erd.selectedTables()).toHaveCount(1);
    await expect(erd.selectedTables()).toHaveAttribute('data-id', 'orders');
    await expect(erd.selectedColumns()).toHaveCount(1);
    await expect(erd.selectedColumns()).toHaveAttribute(
      'data-id',
      'orders_user_id'
    );
    await expect
      .poll(() => erd.focusRingCells())
      .toEqual(['orders_user_id:columnName']);
  });

  test('sizes from its edge between 200 and 480 px', async ({ erd }) => {
    await erd.seed(schema());
    await open(erd);
    const panel = await boxOf(erd, '.explorer');
    const edge = await boxOf(erd, '.explorer-sash .sash');

    await erd.page.mouse.move(edge.x + edge.width / 2, edge.y + 40);
    await erd.page.mouse.down();
    await erd.page.mouse.move(panel.x + 360, edge.y + 40, { steps: 4 });
    await erd.page.mouse.up();

    expect((await boxOf(erd, '.explorer')).width).toBe(360);

    const moved = await boxOf(erd, '.explorer-sash .sash');
    await erd.page.mouse.move(moved.x + moved.width / 2, edge.y + 40);
    await erd.page.mouse.down();
    await erd.page.mouse.move(panel.x + 900, edge.y + 40, { steps: 4 });
    await erd.page.mouse.up();

    expect((await boxOf(erd, '.explorer')).width).toBe(480);
  });

  test('stands on the left in a right-to-left language, its rows reading right to left (AC-S13)', async ({
    erd,
  }) => {
    await erd.seed(schema());
    await erd.setLocale('ar-SA');
    await open(erd);

    const panel = await boxOf(erd, '.explorer');
    const canvas = await boxOf(erd, '[data-testid="erd-canvas"]');
    expect(panel.x).toBeLessThan(canvas.x);
    await expect(explorerOf(erd)).toHaveAttribute('dir', 'rtl');
  });

  test('stands aside on a window too narrow for it and its least canvas, and comes back (AC-S6)', async ({
    erd,
    page,
  }) => {
    await erd.seed(schema());
    await open(erd);

    await page.setViewportSize({ width: 500, height: 900 });
    await expect(explorerOf(erd)).toHaveCount(0);
    await expect(erd.toolbarButton('Explorer')).toHaveClass(/\bactive\b/);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(explorerOf(erd)).toBeVisible();
  });
});
