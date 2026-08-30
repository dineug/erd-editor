import { expect, test } from '../support/fixtures';
import {
  ColumnOption,
  ColumnUIKey,
  RelationshipType,
  twoTables,
} from '../support/schema';
import { Shortcut } from '../support/shortcuts';

const only = <T>(values: T[]): T => {
  expect(values).toHaveLength(1);
  return values[0];
};

/**
 * The element census of a rendered relationship group, the one visible
 * difference between the four types. line counts the whole group, so it is the
 * four start-marker lines plus the end marker's; the route is one element.
 */
const SHAPE = {
  // circle = the "zero" ring; the crow's foot adds left/center/right lines.
  ZeroOne: { line: 7, circle: 1 },
  ZeroN: { line: 8, circle: 1 },
  OneOnly: { line: 8, circle: 0 },
  OneN: { line: 9, circle: 0 },
} as const;

/**
 * The armed-draw cursor painted on the editor root: the relationship icon as a
 * base64 PNG with a centred hotspot. The payload is a build artefact, so the
 * shape of the declaration is asserted rather than the bytes.
 */
const DRAW_CURSOR = /^url\("data:image\/png;base64,[^"]+"\) 16 16, auto$/;

/** The editor root sets no cursor of its own once a draw is over. */
const IDLE_CURSOR = 'auto';

test.describe('relationship drawing', () => {
  test('draws a ZeroN relationship and mints the foreign key column', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await erd.focusCanvas();

    await erd.press(Shortcut.relationshipZeroN);
    await erd.clickTableHeader('users');
    await erd.clickTableHeader('posts');

    const relationshipId = only(await erd.relationshipIds());
    const relationship = await erd.relationship(relationshipId);

    expect(relationship.relationshipType).toBe(RelationshipType.ZeroN);
    expect(relationship.start.tableId).toBe('users');
    expect(relationship.start.columnIds).toEqual(['users_id']);
    expect(relationship.end.tableId).toBe('posts');

    // The end column is minted on the fly and appended, so posts keeps its
    // seeded order and gains exactly one id at the tail.
    const columnIds = await erd.columnIds('posts');
    const fkColumnId = columnIds[columnIds.length - 1];
    expect(columnIds).toEqual(['posts_id', 'posts_title', fkColumnId]);
    expect(relationship.end.columnIds).toEqual([fkColumnId]);

    const fkColumn = await erd.column(fkColumnId);
    // The FK copies the source primary key's name and data type, and is marked
    // notNull — but deliberately *not* primaryKey, which is why the
    // relationship below stays non-identifying.
    expect(fkColumn.name).toBe('id');
    expect(fkColumn.dataType).toBe('int');
    expect(fkColumn.options).toBe(ColumnOption.notNull);
    expect(relationship.identification).toBe(false);

    // ui.keys is stamped by a throttled hook, so it lands a tick later.
    await expect
      .poll(async () => (await erd.column(fkColumnId)).ui.keys)
      .toBe(ColumnUIKey.foreignKey);

    const relationshipEl = erd.relationshipEl(relationshipId);
    await expect(relationshipEl).toBeVisible();
    // A non-identifying relationship draws its routing segments dashed.
    await expect(relationshipEl).not.toHaveClass(/\bidentification\b/);
    await expect(
      relationshipEl.locator('path.route[stroke-dasharray="10"]')
    ).toHaveCount(1);
    await expect(relationshipEl.locator('line')).toHaveCount(SHAPE.ZeroN.line);
    await expect(relationshipEl.locator('circle')).toHaveCount(
      SHAPE.ZeroN.circle
    );

    await expect(erd.columnEl(fkColumnId)).toBeVisible();
    await expect(erd.columnKey(fkColumnId, 'fk')).toBeVisible();
    await expect(
      erd.canvas.locator('.column-row[data-table-id="posts"]')
    ).toHaveCount(3);
  });

  // The other three shortcuts differ in the bit they stamp on the relationship
  // and in the cardinality symbol that bit renders, so they share one body.
  const otherTypes = [
    { name: 'ZeroOne', shortcut: Shortcut.relationshipZeroOne },
    { name: 'OneOnly', shortcut: Shortcut.relationshipOneOnly },
    { name: 'OneN', shortcut: Shortcut.relationshipOneN },
  ] as const;

  for (const { name, shortcut } of otherTypes) {
    test(`draws a ${name} relationship with its own end marker`, async ({
      erd,
    }) => {
      await erd.seed(twoTables());
      await erd.focusCanvas();

      await erd.press(shortcut);
      await erd.clickTableHeader('users');
      await erd.clickTableHeader('posts');

      const relationshipId = only(await erd.relationshipIds());
      const relationship = await erd.relationship(relationshipId);

      expect(relationship.relationshipType).toBe(RelationshipType[name]);

      const relationshipEl = erd.relationshipEl(relationshipId);
      await expect(relationshipEl).toBeVisible();
      await expect(relationshipEl.locator('line')).toHaveCount(
        SHAPE[name].line
      );
      await expect(relationshipEl.locator('circle')).toHaveCount(
        SHAPE[name].circle
      );
      await expect(
        erd.canvas.locator('.column-row[data-table-id="posts"]')
      ).toHaveCount(3);
    });
  }

  test('Escape cancels a draw that has already picked its start table', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await erd.focusCanvas();

    expect(await erd.canvasCursor()).toBe(IDLE_CURSOR);

    await erd.press(Shortcut.relationshipOneN);
    // The armed draw swaps the canvas cursor for the relationship icon.
    await expect.poll(() => erd.canvasCursor()).toMatch(DRAW_CURSOR);

    await erd.clickTableHeader('users');
    await expect(erd.drawPreview).toBeVisible();

    await erd.press(Shortcut.stop);

    // cache() detaches the preview subtree rather than hiding it.
    await expect(erd.drawPreview).toHaveCount(0);
    await expect.poll(() => erd.canvasCursor()).toBe(IDLE_CURSOR);
    expect(await erd.relationshipIds()).toEqual([]);
    // The first click never mints a column — only closing the draw does.
    expect(await erd.columnIds('posts')).toEqual(['posts_id', 'posts_title']);
    await expect(
      erd.canvas.locator('.column-row[data-table-id="posts"]')
    ).toHaveCount(2);
  });

  test('clicking one table twice draws a self-referencing relationship', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await erd.focusCanvas();

    const usersBox = await erd.tableEl('users').boundingBox();
    expect(usersBox).not.toBeNull();
    // A quarter of the header apart: two clicks on one spot are a dblclick to
    // the browser, which opens the table name for editing instead of closing
    // the draw, and a quarter-width is past that radius and still on the strip.
    const offsetX = usersBox!.width / 4;

    await erd.press(Shortcut.relationshipZeroOne);
    await erd.clickTableHeader('users', -offsetX);
    await erd.clickTableHeader('users', offsetX);

    const relationshipId = only(await erd.relationshipIds());
    const relationship = await erd.relationship(relationshipId);

    expect(relationship.start.tableId).toBe('users');
    expect(relationship.end.tableId).toBe('users');

    const columnIds = await erd.columnIds('users');
    const fkColumnId = columnIds[columnIds.length - 1];
    expect(columnIds).toEqual(['users_id', 'users_name', fkColumnId]);
    expect(relationship.end.columnIds).toEqual([fkColumnId]);

    await expect(erd.relationshipEl(relationshipId)).toBeVisible();
    await expect(erd.columnKey(fkColumnId, 'fk')).toBeVisible();
    // The name edit that a mis-read dblclick would have opened never happened.
    await expect(
      erd.cell(erd.tableEl('users'), 'tableName').locator('input')
    ).toHaveCount(0);
    // posts was never touched.
    await expect(
      erd.canvas.locator('.column-row[data-table-id="posts"]')
    ).toHaveCount(2);
  });

  test('one undo removes the relationship and the FK column it minted', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await erd.focusCanvas();

    await erd.press(Shortcut.relationshipZeroN);
    await erd.clickTableHeader('users');
    await erd.clickTableHeader('posts');

    const relationshipId = only(await erd.relationshipIds());
    await expect(erd.relationshipEl(relationshipId)).toBeVisible();
    await expect(
      erd.canvas.locator('.column-row[data-table-id="posts"]')
    ).toHaveCount(3);
    // The draw lands as one history entry; waiting for the toolbar to light up
    // is the signal that it has been recorded, so the undo below cannot race it.
    await expect(erd.toolbarButton('Undo')).toHaveClass(/\bactive\b/);

    await erd.press(Shortcut.undo);

    await expect(erd.relationshipEl(relationshipId)).toHaveCount(0);
    await expect(
      erd.canvas.locator('.column-row[data-table-id="posts"]')
    ).toHaveCount(2);
    await expect(erd.toolbarButton('Undo')).not.toHaveClass(/\bactive\b/);
    await expect(erd.toolbarButton('Redo')).toHaveClass(/\bactive\b/);
    expect(await erd.relationshipIds()).toEqual([]);
    expect(await erd.columnIds('posts')).toEqual(['posts_id', 'posts_title']);
  });
});

test.describe('inline editing', () => {
  test('commits a table name edit with Enter and returns to the display node', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    const nameCell = erd.cell(erd.tableEl('users'), 'tableName');
    await erd.editCell(nameCell, 'members');
    await erd.press(Shortcut.edit);

    // Leaving edit mode swaps the <input> back for the read-only div.
    await expect(nameCell.locator('input')).toHaveCount(0);
    await expect(nameCell.locator('div.edit-input')).toHaveText('members');
    expect((await erd.table('users')).name).toBe('members');
    // Renamed in place — the table keeps its id and its columns.
    expect(await erd.tableIds()).toEqual(['users', 'posts']);
  });

  test('commits a column name edit with Enter', async ({ erd }) => {
    await erd.seed(twoTables());

    const nameCell = erd.cell(erd.columnEl('users_name'), 'columnName');
    await erd.editCell(nameCell, 'nickname');
    await erd.press(Shortcut.edit);

    await expect(nameCell.locator('input')).toHaveCount(0);
    await expect(nameCell.locator('div.edit-input')).toHaveText('nickname');
    expect((await erd.column('users_name')).name).toBe('nickname');
    // The column was renamed, not replaced.
    expect(await erd.columnIds('users')).toEqual(['users_id', 'users_name']);
  });

  test('Escape ends edit mode without reverting the typed value', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    const nameCell = erd.cell(erd.tableEl('users'), 'tableName');
    await erd.editCell(nameCell, 'accounts');
    await erd.press(Shortcut.stop);

    // Every keystroke is dispatched as it is typed, so Escape only closes the
    // input — there is no draft to roll back. Asserted as-is, not as a wish.
    await expect(nameCell.locator('input')).toHaveCount(0);
    await expect(nameCell.locator('div.edit-input')).toHaveText('accounts');
    expect((await erd.table('users')).name).toBe('accounts');
  });
});
