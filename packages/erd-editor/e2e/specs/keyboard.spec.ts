import type { Locator } from '@playwright/test';

import { expect, test } from '../support/fixtures';
import {
  ColumnOption,
  ColumnUIKey,
  DEFAULT_SHOW,
  oneTable,
  Show,
  twoTables,
} from '../support/schema';
import { Shortcut } from '../support/shortcuts';

/**
 * Keyboard shortcuts and the focus/edit state machine behind them.
 *
 * Two DOM markers carry every assertion here:
 * `[data-focus-border-bottom]` is painted on the focused cell, and an
 * `input.edit-input` replaces a cell's static text only while it is in edit
 * mode. `useErdShortcut.ts` gates most shortcuts on `focusTable && !edit`, so
 * the pair is exactly what decides whether a key does anything.
 */
test.describe('keyboard shortcuts', () => {
  test('Alt+KeyN adds a selected table and Alt+Enter gives it a column', async ({
    erd,
  }) => {
    await erd.seed(oneTable());
    await erd.focusCanvas();
    // `tinykeys` is bound to the editor root, so every press below is only
    // meaningful while DOM focus is inside the element. Asserting the
    // precondition turns a lost-focus regression into a clear failure instead
    // of an inscrutable "the table never appeared".
    await erd.expectKeyboardFocusInside();

    await erd.press(Shortcut.addTable);
    await expect(erd.canvas.locator('.table')).toHaveCount(2);

    const [addedId] = (await erd.tableIds()).filter(id => id !== 'users');
    // `addTableAction$` unselects everything, then selects and focuses what it
    // just created — which is what makes the next shortcut land on it.
    await expect(erd.selectedTables()).toHaveCount(1);
    await expect(erd.tableEl(addedId)).toHaveAttribute('data-selected', '');

    await erd.press(Shortcut.addColumn);
    await expect(erd.tableEl(addedId).locator('.column-row')).toHaveCount(1);
    expect(await erd.columnIds(addedId)).toHaveLength(1);

    // The new column takes the focus ring on its name cell. `addColumnAction$`
    // only yields `focusColumnAction`, never `editTableAction`, so — unlike a
    // Tab stop — no editor opens: the ring lands on a cell still showing text.
    await expect(erd.focusRings()).toHaveCount(1);
    const [addedColumnId] = await erd.columnIds(addedId);
    const nameCell = erd.cell(erd.columnEl(addedColumnId), 'columnName');
    await expect(erd.focusRing(nameCell)).toBeVisible();
    await expect(erd.editInput(nameCell)).toHaveCount(0);
  });

  test('$mod+Backspace removes the selected table, Alt+Backspace the selected column', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    // One click both focuses the cell and selects its table, so the two
    // removal shortcuts have their targets at once.
    await erd.focusCell(erd.cell(erd.columnEl('users_name'), 'columnName'));
    await expect(erd.selectedColumns()).toHaveCount(1);
    await expect(erd.selectedTables()).toHaveCount(1);

    await erd.press(Shortcut.removeColumn);
    await expect(erd.columnEl('users_name')).toHaveCount(0);
    expect(await erd.columnIds('users')).toEqual(['users_id']);

    await erd.press(Shortcut.removeTable);
    await expect(erd.tableEl('users')).toHaveCount(0);
    await expect(erd.canvas.locator('.table')).toHaveCount(1);
    // deletes are LWW tombstones, so `doc` is the only honest count
    expect(await erd.tableIds()).toEqual(['posts']);
  });

  test('undo/redo round-trip an add, and fire from inside an open edit input', async ({
    erd,
  }) => {
    await erd.seed(oneTable());
    await erd.focusCanvas();
    await erd.expectKeyboardFocusInside();

    await erd.press(Shortcut.addTable);
    await expect(erd.canvas.locator('.table')).toHaveCount(2);
    await expect(erd.toolbarButton('Undo')).toHaveClass(/\bactive\b/);
    const [addedId] = (await erd.tableIds()).filter(id => id !== 'users');

    // Open an editor on the untouched table. The undo now has to step the
    // store back past the add rather than let the browser undo the input.
    const usersName = erd.cell(erd.tableEl('users'), 'tableName');
    await usersName.dblclick();
    await expect(erd.editInput(usersName)).toBeVisible();

    await erd.press(Shortcut.undo);
    await expect(erd.tableEl(addedId)).toHaveCount(0);
    await expect(erd.canvas.locator('.table')).toHaveCount(1);
    expect(await erd.tableIds()).toEqual(['users']);
    await expect(erd.toolbarButton('Redo')).toHaveClass(/\bactive\b/);
    // the edit survives the undo, still holding the name it started with
    await expect(erd.editInput(usersName)).toHaveValue('users');

    // redo restores the same id, not merely "a second table"
    await erd.press(Shortcut.redo);
    await expect(erd.tableEl(addedId)).toHaveCount(1);
    await expect(erd.canvas.locator('.table')).toHaveCount(2);
    expect(await erd.tableIds()).toEqual(['users', addedId]);
  });

  test('Tab walks the grid, auto-editing every cell except the toggles', async ({
    erd,
  }) => {
    await erd.seed(oneTable());

    const table = erd.tableEl('users');
    const idRow = erd.columnEl('users_id');
    await erd.focusCell(erd.cell(table, 'tableName'));

    // Every stop here opens an editor, so DOM focus hops input to input and
    // `toBeFocused` is the honest signal that the step has landed.
    const editable: Locator[] = [
      erd.cell(table, 'tableComment'),
      erd.cell(idRow, 'columnName'),
      erd.cell(idRow, 'columnDataType'),
    ];

    for (const cell of editable) {
      await erd.press('Tab');
      await expect(erd.focusRing(cell)).toBeVisible();
      await expect(erd.focusRings()).toHaveCount(1);
      await expect(erd.editInput(cell)).toBeFocused();
    }

    // The toggle cells are flipped, never typed into: `isToggleColumnTypes`
    // suppresses the auto-edit, so the cell keeps rendering its label.
    //
    // The walk stops here on purpose. Landing on a toggle cell tears down the
    // previous cell's `<input>` without opening a new one, and DOM focus drops
    // to `<body>` — `checkAndFocus` is throttled and often never pulls it back,
    // which leaves the keyboard dead. The rest of the ring is covered with the
    // arrow keys, which never open an editor and so never lose focus.
    const notNull = erd.cell(idRow, 'columnNotNull');
    await erd.press('Tab');
    await expect(erd.focusRing(notNull)).toBeVisible();
    await expect(erd.focusRings()).toHaveCount(1);
    await expect(erd.editInput(notNull)).toHaveCount(0);
    await expect(notNull).toContainText('NULL');
  });

  test('Tab past the last cell appends a column, Shift+Tab only walks back', async ({
    erd,
  }) => {
    await erd.seed(oneTable());

    const lastCell = erd.cell(erd.columnEl('users_name'), 'columnComment');
    await erd.focusCell(lastCell);

    // The grid does not wrap: `focusMoveTableAction$` turns the last Tab into
    // an addColumn instead.
    await erd.press('Tab');
    await expect(erd.tableEl('users').locator('.column-row')).toHaveCount(3);

    const columnIds = await erd.columnIds('users');
    expect(columnIds).toEqual(['users_id', 'users_name', columnIds[2]]);
    const addedName = erd.cell(erd.columnEl(columnIds[2]), 'columnName');
    await expect(erd.focusRing(addedName)).toBeVisible();
    // `handleKeydown` schedules `editTableAction()` 1ms after every non-toggle
    // Tab stop, the appended row included. Waiting for that editor is what
    // makes the next press land on a settled state rather than mid-transition.
    await expect(erd.editInput(addedName)).toBeFocused();

    await erd.press('Shift+Tab');
    await expect(erd.focusRing(lastCell)).toBeVisible();
    await expect(erd.tableEl('users').locator('.column-row')).toHaveCount(3);
    expect(await erd.columnIds('users')).toEqual(columnIds);
  });

  test('arrow traversal walks the ring settings.show defines', async ({
    erd,
  }) => {
    await erd.seed(oneTable());

    const idRow = erd.columnEl('users_id');
    await erd.focusCell(erd.cell(idRow, 'columnName'));

    // Arrows move focus without opening an editor, so the whole ring can be
    // walked with DOM focus parked on the editor root.
    // `DEFAULT_SHOW` leaves unique and autoIncrement out of the document
    // entirely, and out of the ring with them.
    await expect(erd.cell(idRow, 'columnUnique')).toHaveCount(0);
    await expect(erd.cell(idRow, 'columnAutoIncrement')).toHaveCount(0);

    const ring = [
      'columnDataType',
      'columnNotNull',
      'columnDefault',
      'columnComment',
    ];
    for (const type of ring) {
      await erd.press('ArrowRight');
      await expect(erd.focusRing(erd.cell(idRow, type))).toBeVisible();
      await expect(erd.focusRings()).toHaveCount(1);
    }

    // past the end of a row the ring rolls onto the next one
    await erd.press('ArrowRight');
    const nextRowName = erd.cell(erd.columnEl('users_name'), 'columnName');
    await expect(erd.focusRing(nextRowName)).toBeVisible();

    // Same document, one `show` bit cleared: the data type cell leaves the DOM
    // and the focus ring steps straight over it.
    //
    // `seed` settles by polling `doc.tableIds`, which is unchanged here, so it
    // returns without proving anything about this reseed. The disappearing
    // `columnDataType` cell below is the signal that the new `show` landed —
    // every assertion after it depends on that wait, not on `seed`.
    const withoutDataType = oneTable();
    withoutDataType.settings.show = DEFAULT_SHOW & ~Show.columnDataType;
    await erd.seed(withoutDataType);
    await expect(erd.cell(idRow, 'columnDataType')).toHaveCount(0);

    await erd.focusCell(erd.cell(idRow, 'columnName'));
    await erd.press('ArrowRight');
    await expect(erd.focusRing(erd.cell(idRow, 'columnNotNull'))).toBeVisible();
  });

  test('Escape clears focus and selection, leaving ArrowDown inert', async ({
    erd,
  }) => {
    await erd.seed(twoTables());

    const nameCell = erd.cell(erd.tableEl('users'), 'tableName');
    await erd.focusCell(nameCell);
    await expect(erd.selectedTables()).toHaveCount(1);

    await erd.press(Shortcut.stop);
    await expect(erd.selectedTables()).toHaveCount(0);
    await expect(erd.focusRings()).toHaveCount(0);

    // `handleKeydown` needs a focus target before it will move anything.
    //
    // A "nothing happened" assertion is only honest if the app has already had
    // its chance to react. It has: `store.dispatch` defers through `asap()`,
    // which is `queueMicrotask`, and r-html schedules renders the same way — no
    // rAF anywhere in the path. Both drain before the task that runs the next
    // CDP query, so this count is taken after any reaction would have painted.
    await erd.press('ArrowDown');
    await expect(erd.focusRings()).toHaveCount(0);

    // …and the very same key moves focus once a cell owns it again
    await erd.focusCell(nameCell);
    await erd.press('ArrowDown');
    const firstColumnName = erd.cell(erd.columnEl('users_id'), 'columnName');
    await expect(erd.focusRing(firstColumnName)).toBeVisible();
  });

  test('Alt+KeyK toggles the primary key on the focused column', async ({
    erd,
  }) => {
    await erd.seed(oneTable());

    const idRow = erd.columnEl('users_id');
    await erd.focusCell(erd.cell(idRow, 'columnName'));
    await expect(erd.columnKey('users_id', 'pk')).toHaveCount(0);

    const notNullCell = erd.cell(idRow, 'columnNotNull');
    await expect(notNullCell).toContainText('NULL');

    await erd.press(Shortcut.primaryKey);
    await expect(erd.columnKey('users_id', 'pk')).toHaveCount(1);
    // `changeColumnNotNullHook` rides along with the primary key
    await expect(notNullCell).toContainText('N-N');

    const column = await erd.column('users_id');
    expect(column.options).toBe(ColumnOption.primaryKey | ColumnOption.notNull);
    expect(column.ui.keys).toBe(ColumnUIKey.primaryKey);

    await erd.press(Shortcut.primaryKey);
    await expect(erd.columnKey('users_id', 'pk')).toHaveCount(0);
    // …but the hook only ever adds notNull, so dropping the key leaves it set
    await expect(notNullCell).toContainText('N-N');

    const cleared = await erd.column('users_id');
    expect(cleared.options).toBe(ColumnOption.notNull);
    expect(cleared.ui.keys).toBe(0);
  });

  test('$mod+Alt+KeyA selects every table, Alt+KeyA every column of the focused one', async ({
    erd,
  }) => {
    await erd.seed(twoTables());
    await erd.focusCanvas();
    await erd.expectKeyboardFocusInside();
    await expect(erd.selectedTables()).toHaveCount(0);

    await erd.press(Shortcut.selectAllTable);
    await expect(erd.selectedTables()).toHaveCount(2);

    // Column selection is scoped to `focusTable`, so the click that focuses
    // `users` is also what limits the next shortcut to its rows.
    await erd.focusCell(erd.cell(erd.columnEl('users_id'), 'columnName'));
    await expect(erd.selectedColumns()).toHaveCount(1);

    await erd.press(Shortcut.selectAllColumn);
    await expect(
      erd.tableEl('users').locator('.column-row[data-selected]')
    ).toHaveCount(2);
    await expect(
      erd.tableEl('posts').locator('.column-row[data-selected]')
    ).toHaveCount(0);
  });

  test('shortcuts stay inside the editor: an outside element swallows them', async ({
    erd,
    page,
  }) => {
    await erd.seed(oneTable());
    await erd.focusCanvas();
    await erd.expectKeyboardFocusInside();

    await page.evaluate(() => {
      const outside = window.document.createElement('button');
      outside.id = 'outside';
      outside.textContent = 'outside';
      window.document.body.append(outside);
    });
    await page.locator('#outside').focus();

    // `tinykeys` is bound to the editor root, and the editor dims itself the
    // moment focus leaves it — that class is the signal the keys are gone too.
    await expect(erd.host.locator('.root')).toHaveClass(/\bnone-focus\b/);

    await erd.press(Shortcut.addTable);
    await expect(erd.canvas.locator('.table')).toHaveCount(1);
    expect(await erd.tableIds()).toEqual(['users']);

    // Positive control: the identical press lands once focus is back inside.
    // Clicking bare canvas will not do it — the click only blurs the button —
    // so this goes through the element's public `focus()`.
    await erd.focusHost();
    await erd.expectKeyboardFocusInside();
    await erd.press(Shortcut.addTable);
    await expect(erd.canvas.locator('.table')).toHaveCount(2);
    // The swallowed press cannot have landed late either: a leaked add would
    // show up here as a third table, which the exact count rules out.
    expect(await erd.tableIds()).toHaveLength(2);
  });
});
