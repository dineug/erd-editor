import type { Locator } from '@playwright/test';

import type { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import { createSchema, oneTable } from '../support/schema';

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

  // A list left open under free input covered the row below, so the first press
  // of a double-click there applied whichever hint was drawn over that cell.
  test('opens the cell below free input on a double-click', async ({ erd }) => {
    await erd.seed(oneTable());

    const cell = erd.cell(erd.columnEl(COLUMN_ID), 'columnDataType');
    await erd.editCell(cell, 'VARCHAR(255)');

    const below = erd.cell(erd.columnEl('users_name'), 'columnDataType');
    const point = await erd.centerOf(below);
    await erd.page.mouse.move(point.x, point.y, { steps: 8 });
    await erd.page.mouse.dblclick(point.x, point.y);

    // The row below's own type, lower case, in the editor that opened on it.
    await expect(erd.editInput()).toHaveValue('varchar(255)');
    expect((await erd.column(COLUMN_ID)).dataType).toBe('VARCHAR(255)');
  });

  test('keeps a long hint list inside the canvas and scrolls it', async ({
    erd,
  }) => {
    await openLongHintList(erd, 200);

    const overlay = erd.host.locator('.edit-overlay');
    const list = overlay.locator('.data-type-hint');
    const listBox = await boxOf(list);
    const overlayBox = await boxOf(overlay);
    expect(await list.locator('.data-type-hint-item').count()).toBeGreaterThan(
      HINT_MAX_ROWS * 2
    );
    expect(listBox.height).toBeLessThanOrEqual(
      HINT_MAX_HEIGHT * HINT_ZOOM + 0.5
    );
    expect(listBox.y + listBox.height).toBeLessThanOrEqual(
      overlayBox.y + overlayBox.height
    );

    const before = await erd.settings();
    await erd.page.mouse.move(
      listBox.x + listBox.width / 2,
      listBox.y + listBox.height / 2
    );
    await erd.page.mouse.wheel(0, 120);
    await expect.poll(() => scrollTopOf(list)).toBeGreaterThan(0);
    const after = await erd.settings();
    expect([after.originX, after.originY]).toEqual([
      before.originX,
      before.originY,
    ]);

    // ArrowUp wraps onto the last row, the one furthest out of the list's view.
    await erd.page.keyboard.press('ArrowUp');
    const selected = list.locator('.data-type-hint-item.selected');
    await expect(selected).toHaveCount(1);
    await expect
      .poll(async () => {
        const box = await boxOf(selected);
        return (
          box.y >= listBox.y - 0.5 &&
          box.y + box.height <= listBox.y + listBox.height + 0.5
        );
      })
      .toBe(true);
    expect(await scrollTopOf(overlay)).toBe(0);

    const modifier = await erd.pointerModKey();
    await erd.page.keyboard.down(modifier);
    await erd.page.mouse.wheel(0, -120);
    await erd.page.keyboard.up(modifier);
    await expect
      .poll(async () => (await erd.settings()).zoomLevel)
      .toBeGreaterThan(HINT_ZOOM);
  });

  // A trackpad pinch is a ctrl wheel, which on a Mac is no zoom chord. Only the
  // canvas prevents it, so a list that kept it let the browser zoom the page.
  test('hands the canvas a ctrl wheel over a long hint list', async ({
    erd,
  }) => {
    await openLongHintList(erd, 200);

    const list = erd.host.locator('.edit-overlay .data-type-hint');
    const listBox = await boxOf(list);
    const before = await erd.settings();
    await erd.page.mouse.move(
      listBox.x + listBox.width / 2,
      listBox.y + listBox.height / 2
    );
    await erd.page.keyboard.down('Control');
    await erd.page.mouse.wheel(0, 120);
    await erd.page.keyboard.up('Control');

    // A pan where Control is no $mod, a zoom where it is.
    await expect
      .poll(async () => {
        const { originX, originY, zoomLevel } = await erd.settings();
        return [originX, originY, zoomLevel];
      })
      .not.toEqual([before.originX, before.originY, before.zoomLevel]);
    expect(await scrollTopOf(list)).toBe(0);
  });

  // The overlay clips what runs past the canvas, and scrolling it to reveal a
  // row would carry the input off the cell the scene still draws.
  test('scrolls a hint list the canvas clips without moving the input', async ({
    erd,
  }) => {
    await openLongHintList(erd, 500);

    const overlay = erd.host.locator('.edit-overlay');
    const list = overlay.locator('.data-type-hint');
    const listBox = await boxOf(list);
    const overlayBox = await boxOf(overlay);
    expect(listBox.y + listBox.height).toBeGreaterThan(
      overlayBox.y + overlayBox.height
    );
    const inputBox = await boxOf(erd.editInput());

    await erd.page.keyboard.press('ArrowUp');
    await expect.poll(() => scrollTopOf(list)).toBeGreaterThan(0);

    expect(await scrollTopOf(overlay)).toBe(0);
    expect(await boxOf(erd.editInput())).toEqual(inputBox);
  });
});

/** Ten 20px rows and the border around them, in the list's own css px. */
const HINT_MAX_ROWS = 10;
const HINT_MAX_HEIGHT = HINT_MAX_ROWS * 20 + 2;
const HINT_ZOOM = 0.8;

/**
 * Types a two letter query most of the MySQL types fuzzy match into a cell at
 * one height of a small window at a reduced zoom, where the list it opens runs
 * far past the room the canvas leaves under the cell.
 */
async function openLongHintList(erd: ErdEditorPage, y: number) {
  await erd.page.setViewportSize({ width: 960, height: 600 });
  await erd.seed(
    createSchema({
      zoomLevel: HINT_ZOOM,
      originX: 0,
      originY: 0,
      tables: [
        {
          id: TABLE_ID,
          name: 'users',
          x: 200,
          y,
          columns: [{ id: COLUMN_ID, name: 'id', dataType: 'int' }],
        },
      ],
    })
  );

  const cell = erd.cell(erd.columnEl(COLUMN_ID), 'columnDataType');
  await erd.editCell(cell, 'TI');
  await expect(
    erd.host.locator('.edit-overlay .data-type-hint-item').first()
  ).toBeVisible();
}

const scrollTopOf = (locator: Locator) =>
  locator.evaluate(element => element.scrollTop);

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('the element has no box');
  return box;
}
