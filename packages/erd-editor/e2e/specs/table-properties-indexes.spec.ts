import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../support/fixtures';
import { type Box, ErdEditorPage } from '../support/ErdEditorPage';
import { dragListInPage, framesOutOfOrder } from '../support/listDrag';
import {
  ColumnOption,
  ColumnUIKey,
  createSchema,
  DEFAULT_SHOW,
  Show,
} from '../support/schema';
import { Shortcut } from '../support/shortcuts';

/**
 * The panel carries no test ids, so every locator here is structural: titles
 * pick out the add button and the table tabs, placeholders the name fields, and
 * the draggable rows are the lower-right selected-column list.
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

/** What the browser paints is the checked property, never the attribute. */
const checkedStates = (panel: ReturnType<Page['locator']>) =>
  panel
    .locator('input[type="checkbox"]')
    .evaluateAll(inputs => inputs.map(input => input.matches(':checked')));

/** Whether a press at the element's centre lands on it, with nothing stuck over it. */
const hitTestable = (target: Locator) =>
  target.evaluate(el => {
    const box = el.getBoundingClientRect();
    const root = el.getRootNode() as Document | ShadowRoot;
    return (
      root.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) ===
      el
    );
  });

test.describe('table properties — frame', () => {
  test('closes on its close button and hands the keyboard back to the editor', async ({
    erd,
    page,
  }) => {
    await erd.seed(schema());
    const { panel } = await openProperties(erd, page, 'student');

    await panel.locator('.table-properties-close').click();
    await expect(panel).toHaveCount(0);
    await erd.expectKeyboardFocusInside();

    // The button took the focus as it was pressed; the shortcuts still answer.
    await erd.press(Shortcut.tableProperties);
    await expect(panel).toBeVisible();
  });

  test('shows read only mode and offers no edit in it', async ({
    erd,
    page,
  }) => {
    await erd.seed(
      createSchema({
        tables: [
          {
            id: 'student',
            name: 'student',
            x: 160,
            y: 160,
            columns: [
              {
                id: 'student_id',
                name: 'id',
                dataType: 'int',
                options: ColumnOption.primaryKey | ColumnOption.notNull,
                keys: ColumnUIKey.primaryKey,
              },
              { id: 'student_email', name: 'email', dataType: 'int' },
            ],
          },
        ],
        indexes: [
          {
            id: 'idx_student',
            tableId: 'student',
            name: 'idx_student',
            unique: false,
            columns: [{ id: 'idx_student_email', columnId: 'student_email' }],
          },
        ],
      })
    );
    await page.evaluate(() => {
      const editor = window.document.querySelector('erd-editor');
      if (!editor) throw new Error('erd-editor is not mounted');
      editor.readonly = true;
    });
    await erd.clickTableHeader('student');
    await erd.focusHost();
    await erd.press(Shortcut.tableProperties);

    const panel = page.locator('erd-editor .table-properties');
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Read only', { exact: true })).toBeVisible();
    // The badge's lock carries no title, so the key rows are still all it finds.
    await expect(panel.locator('div:has(> [title="Read Only"])')).toHaveCount(
      1
    );
    await expect(panel.locator('[title="Add Index"]')).toHaveCount(0);
    await expect(panel.locator('[title="Remove"]')).toHaveCount(0);

    const name = panel.locator('input[placeholder="name"]');
    await expect(name).toHaveAttribute('readonly', '');
    await name.click();
    await expect(panel.locator('input[type="checkbox"]:enabled')).toHaveCount(
      0
    );
    await expect.poll(() => checkedStates(panel)).toEqual([false, true]);
    await expect(panel.locator('[draggable="true"][data-id]')).toHaveCount(0);

    await panel.locator('[title="Unique"]').click();
    const { collections } = await erd.value();
    expect(collections.indexEntities['idx_student'].unique).toBe(false);
  });
});

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

    const { collections, doc } = await erd.value();
    const [, secondIndexId] = doc.indexIds;
    const { indexColumnIds } = collections.indexEntities[secondIndexId];
    const indexColumn = collections.indexColumnEntities[indexColumnIds[0]];

    expect(indexColumnIds).toHaveLength(1);
    expect(indexColumn.columnId).toBe('student_id');
  });

  test('a fast drag paints the index columns in the order they hold on every frame', async ({
    erd,
    page,
  }) => {
    const { addIndex, indexNames, checkboxes, selectedColumns } =
      await openIndexesTab(erd, page);

    await addIndex.click();
    await indexNames.nth(0).click();
    for (let index = 0; index < 3; index++) {
      await checkboxes.nth(index).click();
      await expect(selectedColumns).toHaveCount(index + 1);
    }

    const run = await page.evaluate(dragListInPage, {
      rows: '.table-properties [draggable="true"][data-id]',
      from: 2,
      to: 0,
      travel: 200,
      hold: 700,
    });

    expect(run.frames.at(-1)?.order).toEqual([
      run.initial[2],
      ...run.initial.slice(0, 2),
    ]);
    expect(framesOutOfOrder(run)).toHaveLength(0);
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

    // course has no index at all, so nothing can be selected while it shows.
    await tableTab('course').click();
    await expect(indexNames).toHaveCount(0);
    await expect(checkboxes).toHaveCount(1);
    await expect(checkboxes.nth(0)).toBeDisabled();
    await expect(selectedColumns).toHaveCount(0);

    // Scoped out while course shows, not erased.
    await tableTab('student').click();
    await expect(indexNames).toHaveCount(1);
    await expect(selectedColumns).toHaveCount(1);
    await expect(selectedColumns.nth(0)).toContainText('id');
  });

  test('lists the keys the columns declare as read only rows above the indexes', async ({
    erd,
    page,
  }) => {
    await erd.seed(
      createSchema({
        tables: [
          {
            id: 'student',
            name: 'student',
            x: 160,
            y: 160,
            columns: [
              {
                id: 'student_id',
                name: 'id',
                dataType: 'int',
                options: ColumnOption.primaryKey | ColumnOption.notNull,
                keys: ColumnUIKey.primaryKey,
              },
              {
                id: 'student_email',
                name: 'email',
                dataType: 'varchar(255)',
                options: ColumnOption.unique,
              },
              { id: 'student_age', name: 'age', dataType: 'int' },
            ],
          },
        ],
        indexes: [
          {
            id: 'uq_student',
            tableId: 'student',
            name: 'uq_student',
            unique: true,
            columns: [
              { id: 'uq_student_email', columnId: 'student_email' },
              { id: 'uq_student_age', columnId: 'student_age' },
            ],
          },
        ],
      })
    );
    const { panel, indexNames, selectedColumns } = await openProperties(
      erd,
      page,
      'student'
    );
    const keyRows = panel.locator('div:has(> [title="Read Only"])');

    await expect(keyRows).toHaveCount(2);
    await expect(keyRows.nth(0)).toContainText('PK_student');
    await expect(keyRows.nth(1)).toContainText('UQ_student_email');
    await expect(keyRows.locator('[title="Remove"]')).toHaveCount(0);
    await expect(keyRows.locator('input')).toHaveCount(0);
    await expect(indexNames).toHaveCount(1);
    await expect(panel.locator('[title="Alternate Key 1"]')).toBeVisible();

    await keyRows.nth(1).click();
    await expect.poll(() => checkedStates(panel)).toEqual([false, true, false]);
    await expect(panel.locator('input[type="checkbox"]:enabled')).toHaveCount(
      0
    );
    await expect(selectedColumns).toHaveCount(0);

    const { doc } = await erd.value();
    expect(doc.indexIds).toEqual(['uq_student']);
  });

  test('keeps the keys, the Columns heading and a box the keyboard reaches in sight past the fold', async ({
    erd,
    page,
  }) => {
    const columns = Array.from({ length: 30 }, (_, i) => ({
      id: `wide_c${i}`,
      name: `c${i}`,
      dataType: 'int',
    }));
    await erd.seed(
      createSchema({
        tables: [{ id: 'wide', name: 'wide', x: 160, y: 160, columns }],
        indexes: [
          {
            id: 'uq_wide',
            tableId: 'wide',
            name: 'uq_wide',
            unique: true,
            columns: columns
              .slice(0, 5)
              .map(column => ({ id: `uq_${column.id}`, columnId: column.id })),
          },
        ],
      })
    );
    const { panel, indexNames, checkboxes, selectedColumns } =
      await openProperties(erd, page, 'wide');

    await indexNames.first().click();
    await expect(selectedColumns).toHaveCount(5);
    await checkboxes.first().focus();

    // Tab walks the boxes down past the fold the stuck order covers; each one
    // has to come out from under it, or Space would flip a box nobody sees.
    for (let step = 1; step < columns.length; step++) {
      await page.keyboard.press('Tab');
      const box = checkboxes.nth(step);
      await expect(box).toBeFocused();
      expect(await hitTestable(box)).toBe(true);
    }

    // The body has scrolled to the last column, and the keys and the
    // heading beside it are still there to read.
    await expect(indexNames.first()).toBeVisible();
    expect(await hitTestable(indexNames.first())).toBe(true);
    expect(await hitTestable(panel.getByText('Columns', { exact: true }))).toBe(
      true
    );
  });

  test('redraws the alternate key marks as the Indexes tab changes a key', async ({
    erd,
    page,
  }) => {
    await erd.seed(
      createSchema({
        show: DEFAULT_SHOW | Show.columnAlternateKey,
        tables: [
          {
            id: 'student',
            name: 'student',
            x: 160,
            y: 160,
            columns: [
              { id: 'student_id', name: 'id', dataType: 'int' },
              { id: 'student_email', name: 'email', dataType: 'int' },
              { id: 'student_age', name: 'age', dataType: 'int' },
            ],
          },
          {
            id: 'course',
            name: 'course',
            x: 700,
            y: 160,
            columns: [
              { id: 'course_code', name: 'code', dataType: 'int' },
              { id: 'course_name', name: 'name', dataType: 'int' },
            ],
          },
        ],
        indexes: [
          {
            id: 'uq_student',
            tableId: 'student',
            unique: true,
            columns: [
              { id: 'uq_student_email', columnId: 'student_email' },
              { id: 'uq_student_age', columnId: 'student_age' },
            ],
          },
          {
            id: 'uq_course',
            tableId: 'course',
            unique: true,
            columns: [
              { id: 'uq_course_name', columnId: 'course_name' },
              { id: 'uq_course_code', columnId: 'course_code' },
            ],
          },
        ],
      })
    );
    const mark = (columnId: string) =>
      erd.sceneAttr([`#column-${columnId}`, '.column-alternate-key'], 'text');

    await expect.poll(() => mark('student_email')).toBe('AK1.1');
    await expect.poll(() => mark('student_age')).toBe('AK1.2');
    await expect.poll(() => mark('course_name')).toBe('AK1.1');

    const { panel } = await openProperties(erd, page, 'student');
    const unique = panel.locator('[title="Unique"]');

    await unique.click();
    await expect.poll(() => mark('student_email')).toBeNull();
    await expect.poll(() => mark('course_name')).toBe('AK1.1');

    await unique.click();
    await expect.poll(() => mark('student_email')).toBe('AK1.1');
    await expect.poll(() => mark('student_age')).toBe('AK1.2');
  });

  test('draws each alternate key mark last in its row, whatever the column order', async ({
    erd,
  }) => {
    const document = createSchema({
      show: DEFAULT_SHOW | Show.columnAlternateKey,
      tables: [
        {
          id: 'student',
          name: 'student',
          x: 160,
          y: 160,
          columns: [
            { id: 'student_id', name: 'id', dataType: 'int', comment: 'key' },
            {
              id: 'student_email',
              name: 'email',
              dataType: 'varchar(255)',
              comment: 'address',
            },
          ],
        },
      ],
      indexes: [
        {
          id: 'uq_student',
          tableId: 'student',
          unique: true,
          columns: [
            { id: 'uq_student_id', columnId: 'student_id' },
            { id: 'uq_student_email', columnId: 'student_email' },
          ],
        },
      ],
    });
    const columnIds = ['student_id', 'student_email'];
    const right = (box: Box) => box.x + box.width;
    const boxOf = (columnId: string, name: string) =>
      erd.sceneBox([`#column-${columnId}`, `.${name}`]);
    /** The gap a row keeps between two cells, which the mark keeps too. */
    const gapOf = async (columnId: string) =>
      (await boxOf(columnId, 'columnDataType')).x -
      right(await boxOf(columnId, 'columnName'));

    await erd.seed(document);
    await expect
      .poll(() =>
        erd.sceneAttr(['#column-student_id', '.column-alternate-key'], 'text')
      )
      .toBe('AK1.1');

    const header = await erd.sceneBox(['#table-student', '.tableName']);
    for (const columnId of columnIds) {
      const mark = await boxOf(columnId, 'column-alternate-key');
      const comment = await boxOf(columnId, 'columnComment');

      expect((await boxOf(columnId, 'columnName')).x).toBeCloseTo(header.x, 1);
      expect(mark.x).toBeCloseTo(right(comment) + (await gapOf(columnId)), 1);
    }

    // The comment first: the mark does not move with it and stays last.
    document.settings.columnOrder = [64, 1, 2, 4, 8, 16, 32];
    await erd.seed(document);
    await expect
      .poll(
        async () =>
          (await boxOf('student_id', 'columnComment')).x <
          (await boxOf('student_id', 'columnName')).x
      )
      .toBe(true);

    for (const columnId of columnIds) {
      const mark = await boxOf(columnId, 'column-alternate-key');
      const last = await boxOf(columnId, 'columnDefault');

      expect(mark.x).toBeCloseTo(right(last) + (await gapOf(columnId)), 1);
      expect(mark.x).toBeGreaterThan(
        right(await boxOf(columnId, 'columnComment'))
      );
    }
    expect(
      await erd.sceneAttr(
        ['#column-student_email', '.column-alternate-key'],
        'text'
      )
    ).toBe('AK1.2');
  });
});
