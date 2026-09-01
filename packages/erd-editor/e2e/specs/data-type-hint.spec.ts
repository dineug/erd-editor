import { expect, test } from '../support/fixtures';
import { oneTable } from '../support/schema';

const COLUMN_ID = 'users_id';
const TABLE_ID = 'users';

/**
 * The data type autocomplete, driven the way a person drives it. The list is
 * dom the editing overlay opens beside its input, over a stage that cannot hit
 * test it, so a press on a row travels out to the canvas routing above.
 */
test.describe('data type autocomplete', () => {
  test('applies the hint a real mouse press lands on', async ({ erd }) => {
    await erd.seed(oneTable());

    const cell = erd.cell(erd.columnEl(COLUMN_ID), 'columnDataType');
    await erd.editCell(cell, 'int');

    const rows = erd.host.locator('.edit-overlay .data-type-hint-item');
    await expect(rows.first()).toBeVisible();
    const name = (await rows.first().innerText()).replace(/\s*Tab\s*$/, '');
    expect(name).toBeTruthy();

    // A real press and release, because the defect was a click that never
    // fired: the row went out of the dom between the two.
    const box = await rows.first().boundingBox();
    if (!box) throw new Error('the first hint row has no box');
    await erd.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await erd.page.mouse.down();
    await erd.page.mouse.up();

    expect((await erd.column(COLUMN_ID)).dataType).toBe(name);
    await expect(rows).toHaveCount(0);
    // The press belongs to the editor, so it neither closes it nor drops the
    // selection the way a press on bare canvas does.
    await expect(erd.editInput(cell)).toBeVisible();
    await expect(erd.tableEl(TABLE_ID)).toHaveAttribute('data-selected', '');
  });

  test('applies the hint the keyboard walks onto', async ({ erd }) => {
    await erd.seed(oneTable());

    const cell = erd.cell(erd.columnEl(COLUMN_ID), 'columnDataType');
    await erd.editCell(cell, 'int');
    await expect(
      erd.host.locator('.edit-overlay .data-type-hint-item').first()
    ).toBeVisible();

    await erd.page.keyboard.press('ArrowDown');
    await erd.page.keyboard.press('Enter');

    expect((await erd.column(COLUMN_ID)).dataType).toBe('INT');
  });
});
