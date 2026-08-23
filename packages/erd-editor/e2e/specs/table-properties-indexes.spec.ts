import type { Page } from '@playwright/test';

import { expect, test } from '../support/fixtures';
import { ErdEditorPage } from '../support/ErdEditorPage';
import { createSchema } from '../support/schema';
import { Shortcut } from '../support/shortcuts';

/**
 * The panel carries no test ids, so every locator here is structural:
 * `[title="Add Index"]` is the "+" button, `[title="<table name>"]` a table tab,
 * `input[placeholder="name"]` an index row's name field,
 * `input[type="checkbox"]` exists only in the checkbox column, and
 * `[draggable="true"][data-id]` is a row of the lower-right selected-column list.
 */

const schema = () =>
  createSchema({
    tables: [
      {
        id: 'student',
        name: 'student',
        x: 160,
        y: 160,
        columns: [
          { id: 'student_id', name: 'id', dataType: 'int' },
          { id: 'student_name', name: 'name', dataType: 'varchar(255)' },
          { id: 'student_age', name: 'age', dataType: 'int' },
        ],
      },
      {
        id: 'course',
        name: 'course',
        x: 700,
        y: 160,
        columns: [{ id: 'course_code', name: 'code', dataType: 'int' }],
      },
    ],
  });

/** Opens Table Properties on one table through the real gesture. */
async function openProperties(erd: ErdEditorPage, page: Page, table: string) {
  await erd.clickTableHeader(table);
  await expect(erd.selectedTables()).toHaveCount(1);
  await erd.focusHost();
  await erd.expectKeyboardFocusInside();
  await erd.press(Shortcut.tableProperties);

  const panel = page.locator('erd-editor .table-properties');
  await expect(panel).toBeVisible();

  const locators = {
    panel,
    addIndex: panel.locator('[title="Add Index"]'),
    indexNames: panel.locator('input[placeholder="name"]'),
    checkboxes: panel.locator('input[type="checkbox"]'),
    selectedColumns: panel.locator('[draggable="true"][data-id]'),
    tableTab: (name: string) => panel.locator(`[title="${name}"]`),
  };
  await expect(locators.addIndex).toBeVisible();
  return locators;
}

async function openIndexesTab(erd: ErdEditorPage, page: Page) {
  await erd.seed(schema());
  const locators = await openProperties(erd, page, 'student');
  // The Indexes tab is the panel's default.
  await expect(locators.checkboxes).toHaveCount(3);
  return locators;
}

/** What the browser paints is the `checked` property, never the attribute. */
const checkedStates = (panel: ReturnType<Page['locator']>) =>
  panel
    .locator('input[type="checkbox"]')
    .evaluateAll(inputs => inputs.map(input => input.matches(':checked')));

test.describe('table properties — indexes tab', () => {
  test('rebinds the checkbox column when the selection moves to another index', async ({
    erd,
    page,
  }) => {
    const { panel, addIndex, indexNames, checkboxes, selectedColumns } =
      await openIndexesTab(erd, page);

    await addIndex.click();
    await expect(indexNames).toHaveCount(1);
    await indexNames.nth(0).click();

    await checkboxes.nth(0).click();
    await expect(selectedColumns).toHaveCount(1);
    await expect(selectedColumns.nth(0)).toContainText('id');
    await expect.poll(() => checkedStates(panel)).toEqual([true, false, false]);

    await addIndex.click();
    await expect(indexNames).toHaveCount(2);

    // Adding on its own changes nothing: the first index is still selected.
    await expect(selectedColumns).toHaveCount(1);
    await expect.poll(() => checkedStates(panel)).toEqual([true, false, false]);

    await indexNames.nth(1).click();
    await expect(selectedColumns).toHaveCount(0);
    await expect
      .poll(() => checkedStates(panel))
      .toEqual([false, false, false]);

    await indexNames.nth(0).click();
    await expect(selectedColumns).toHaveCount(1);
    await expect.poll(() => checkedStates(panel)).toEqual([true, false, false]);
  });

  test('adds the column on the first click after switching index', async ({
    erd,
    page,
  }) => {
    const { panel, addIndex, indexNames, checkboxes, selectedColumns } =
      await openIndexesTab(erd, page);

    await addIndex.click();
    await expect(indexNames).toHaveCount(1);
    await indexNames.nth(0).click();
    await checkboxes.nth(0).click();
    await expect(selectedColumns).toHaveCount(1);

    await addIndex.click();
    await expect(indexNames).toHaveCount(2);
    await indexNames.nth(1).click();
    await expect(selectedColumns).toHaveCount(0);

    await checkboxes.nth(0).click();
    await expect(selectedColumns).toHaveCount(1);
    await expect(selectedColumns.nth(0)).toContainText('id');
    await expect.poll(() => checkedStates(panel)).toEqual([true, false, false]);

    // `schema.ts` leaves the two index collections untyped, so read them here.
    const { collections, doc } = await erd.value();
    const [, secondIndexId] = doc.indexIds;
    const { indexColumnIds } = collections.indexEntities[
      secondIndexId
    ] as Record<'indexColumnIds', string[]>;
    const indexColumn = collections.indexColumnEntities[
      indexColumnIds[0]
    ] as Record<'columnId', string>;

    expect(indexColumnIds).toHaveLength(1);
    expect(indexColumn.columnId).toBe('student_id');
  });

  test('stops applying the index selection once the panel switches table', async ({
    erd,
    page,
  }) => {
    await erd.seed(schema());

    // Open both tables once, so the panel's tab strip lists the two of them.
    await openProperties(erd, page, 'student');
    await erd.press(Shortcut.stop);
    const { addIndex, indexNames, checkboxes, selectedColumns, tableTab } =
      await openProperties(erd, page, 'course');

    await tableTab('student').click();
    await expect(checkboxes).toHaveCount(3);

    await addIndex.click();
    await expect(indexNames).toHaveCount(1);
    await indexNames.nth(0).click();
    await checkboxes.nth(0).click();
    await expect(selectedColumns).toHaveCount(1);

    // `course` has no index at all, so nothing can be selected while it shows.
    await tableTab('course').click();
    await expect(indexNames).toHaveCount(0);
    await expect(checkboxes).toHaveCount(1);
    await expect(checkboxes.nth(0)).toBeDisabled();
    await expect(selectedColumns).toHaveCount(0);

    // Scoped out while `course` shows, not erased.
    await tableTab('student').click();
    await expect(indexNames).toHaveCount(1);
    await expect(selectedColumns).toHaveCount(1);
    await expect(selectedColumns.nth(0)).toContainText('id');
  });
});
