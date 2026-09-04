import type { Locator } from '@playwright/test';

import type { ErdEditorPage } from '../support/ErdEditorPage';
import { expect, test } from '../support/fixtures';
import {
  ColumnOption,
  ColumnUIKey,
  createSchema,
  DEFAULT_SHOW,
  type ErdDocument,
  oneTable,
  Show,
  twoTables,
} from '../support/schema';
import { Shortcut } from '../support/shortcuts';

/**
 * Keyboard shortcuts and the focus/edit state machine behind them. Two DOM
 * markers carry every assertion: the focus border on the focused cell, and the
 * edit input that replaces a cell's static text only while it is in edit mode.
 */
test.describe('keyboard shortcuts', () => {
  test('Alt+KeyN adds a selected table and Alt+Enter gives it a column', async ({
    erd,
  }) => {
    await erd.seed(oneTable());
    await erd.focusCanvas();
    // tinykeys is bound to the editor root, so every press below is meaningful
    // only while DOM focus is inside the element. Asserting the precondition
    // turns a lost-focus regression into a clear failure.
    await erd.expectKeyboardFocusInside();

    await erd.press(Shortcut.addTable);
    await expect(erd.canvas.locator('.table')).toHaveCount(2);

    const [addedId] = (await erd.tableIds()).filter(id => id !== 'users');
    // addTableAction$ unselects everything, then selects and focuses what it
    // just created — which is what makes the next shortcut land on it.
    await expect(erd.selectedTables()).toHaveCount(1);
    await expect(erd.tableEl(addedId)).toHaveAttribute('data-selected', '');

    await erd.press(Shortcut.addColumn);
    await expect(erd.tableEl(addedId).locator('.column-row')).toHaveCount(1);
    expect(await erd.columnIds(addedId)).toHaveLength(1);

    // The new column takes the focus ring on its name cell. addColumnAction$
    // only yields focusColumnAction, never editTableAction, so — unlike a
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
    // deletes are LWW tombstones, so doc is the only honest count
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

  test('an undo that removes the named table takes its editor with it', async ({
    erd,
  }) => {
    await erd.seed(oneTable());
    await erd.focusCanvas();
    await erd.expectKeyboardFocusInside();

    await erd.press(Shortcut.addTable);
    const [addedId] = (await erd.tableIds()).filter(id => id !== 'users');
    const addedName = erd.cell(erd.tableEl(addedId), 'tableName');
    await erd.press(Shortcut.edit);
    await expect(erd.editInput(addedName)).toBeFocused();

    // The editor is open on the very table the undo drops. A removal is an LWW
    // tombstone, so nothing but doc.tableIds says the table has left, and an
    // editor resolved from the collections alone would stay open over nothing.
    await erd.press(Shortcut.undo);
    expect(await erd.tableIds()).toEqual(['users']);
    await expect(erd.canvas.locator('.table')).toHaveCount(1);
    await expect(erd.editInput()).toHaveCount(0);
    await erd.expectKeyboardFocusInside();

    // Typing now has no editor to reach, so the tombstone keeps the name it
    // was removed with and the redo it would have cleared still stands.
    await erd.page.keyboard.type('ghost');
    expect((await erd.table(addedId)).name).toBe('');
    expect(await erd.tableIds()).toEqual(['users']);

    await erd.press(Shortcut.redo);
    expect(await erd.tableIds()).toEqual(['users', addedId]);
    await expect(erd.canvas.locator('.table')).toHaveCount(2);
    // the restored table carries the name it had, not what the ghost typed
    expect((await erd.table(addedId)).name).toBe('');

    // Alt+KeyN is one of the shortcuts an open editor swallows, so the table it
    // adds is how the returned keyboard is read back.
    await erd.press(Shortcut.addTable);
    await expect(erd.canvas.locator('.table')).toHaveCount(3);
  });

  test('Tab walks the grid, auto-editing every cell except the toggles', async ({
    erd,
  }) => {
    await erd.seed(oneTable());

    const table = erd.tableEl('users');
    const idRow = erd.columnEl('users_id');
    await erd.focusCell(erd.cell(table, 'tableName'));

    // Every stop here opens an editor, so DOM focus hops input to input and
    // toBeFocused is the honest signal that the step has landed.
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

    // Toggle cells are flipped, never typed into, so landing on one tears down
    // the previous input and opens none. DOM focus goes back to the editor root
    // rather than out to the body, which is what keeps the grid answering.
    const notNull = erd.cell(idRow, 'columnNotNull');
    await erd.press('Tab');
    await expect(erd.focusRing(notNull)).toBeVisible();
    await expect(erd.focusRings()).toHaveCount(1);
    await expect(erd.editInput(notNull)).toHaveCount(0);
    await expect(notNull).toContainText('NULL');
    await erd.expectKeyboardFocusInside();
  });

  test('Tab past the last cell appends a column, Shift+Tab only walks back', async ({
    erd,
  }) => {
    await erd.seed(oneTable());

    const lastCell = erd.cell(erd.columnEl('users_name'), 'columnComment');
    await erd.focusCell(lastCell);

    // The grid does not wrap: focusMoveTableAction$ turns the last Tab into
    // an addColumn instead.
    await erd.press('Tab');
    await expect(erd.tableEl('users').locator('.column-row')).toHaveCount(3);

    const columnIds = await erd.columnIds('users');
    expect(columnIds).toEqual(['users_id', 'users_name', columnIds[2]]);
    const addedName = erd.cell(erd.columnEl(columnIds[2]), 'columnName');
    await expect(erd.focusRing(addedName)).toBeVisible();
    // handleKeydown schedules editTableAction() 1ms after every non-toggle
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
    // walked with DOM focus parked on the editor root. The default show leaves
    // unique and autoIncrement out of the document, and out of the ring.
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

    // Same document with one show bit cleared, so the data type cell leaves the
    // DOM and the ring steps over it. seed polls tableIds, unchanged here, so
    // the disappearing cell below is the signal that the new show landed.
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

    // handleKeydown needs a focus target before it moves anything, and a
    // nothing-happened assertion is honest only after the app had its chance.
    // Dispatch and render both drain in microtasks, before the next CDP query.
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
    // changeColumnNotNullHook rides along with the primary key
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

    // Column selection is scoped to focusTable, so the click that focuses
    // users is also what limits the next shortcut to its rows.
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

    // tinykeys is bound to the editor root, and the editor dims itself the
    // moment focus leaves it — that class is the signal the keys are gone too.
    await expect(erd.host.locator('.root')).toHaveClass(/\bnone-focus\b/);

    await erd.press(Shortcut.addTable);
    await expect(erd.canvas.locator('.table')).toHaveCount(1);
    expect(await erd.tableIds()).toEqual(['users']);

    // Positive control: the identical press lands once focus is back inside.
    // Clicking bare canvas will not do it — the click only blurs the button —
    // so this goes through the element's public focus().
    await erd.focusHost();
    await erd.expectKeyboardFocusInside();
    await erd.press(Shortcut.addTable);
    await expect(erd.canvas.locator('.table')).toHaveCount(2);
    // The swallowed press cannot have landed late either: a leaked add would
    // show up here as a third table, which the exact count rules out.
    expect(await erd.tableIds()).toHaveLength(2);
  });
});

/**
 * One stop on the traversal ring, named the way a focus ring reports itself: a
 * row — the table for a header cell, the column otherwise — and the cell type
 * inside it.
 */
type Stop = { row: string; type: string };

/**
 * The ring the default settings.show leaves on the oneTable seed, in the order
 * Tab walks it. Shift+Tab walks the same list backwards and wraps at the front;
 * a Tab off the last stop appends a column instead, which its own test owns.
 */
const RING: Stop[] = [
  { row: 'users', type: 'tableName' },
  { row: 'users', type: 'tableComment' },
  { row: 'users_id', type: 'columnName' },
  { row: 'users_id', type: 'columnDataType' },
  { row: 'users_id', type: 'columnNotNull' },
  { row: 'users_id', type: 'columnDefault' },
  { row: 'users_id', type: 'columnComment' },
  { row: 'users_name', type: 'columnName' },
  { row: 'users_name', type: 'columnDataType' },
  { row: 'users_name', type: 'columnNotNull' },
  { row: 'users_name', type: 'columnDefault' },
  { row: 'users_name', type: 'columnComment' },
];

/** The one kind of stop that is flipped rather than typed into. */
const isToggle = (stop: Stop) => stop.type === 'columnNotNull';

const nameOf = (stop: Stop) => `${stop.row}:${stop.type}`;

const cellOf = (erd: ErdEditorPage, stop: Stop) =>
  erd.cell(
    stop.type.startsWith('column')
      ? erd.columnEl(stop.row)
      : erd.tableEl(stop.row),
    stop.type
  );

const notNullOf = async (erd: ErdEditorPage, columnId: string) =>
  Boolean((await erd.column(columnId)).options & ColumnOption.notNull);

/** Opens the stop a step starts from — an editor on every cell but a toggle. */
async function enterStop(erd: ErdEditorPage, stop: Stop) {
  await erd.focusCell(cellOf(erd, stop));

  if (isToggle(stop)) {
    await expect(erd.editInput()).toHaveCount(0);
    return;
  }

  await erd.press(Shortcut.edit);
  await expect(erd.editInput()).toBeFocused();
}

/**
 * Whether the element still answers a press in the state a step left behind.
 * The focus ring is painted from store state and says nothing about where DOM
 * focus went, so the answer has to come from a real key.
 */
async function expectKeyboardAnswers(erd: ErdEditorPage, stop: Stop) {
  if (isToggle(stop)) {
    await expect(erd.editInput()).toHaveCount(0);
    await erd.expectKeyboardFocusInside();

    const before = await notNullOf(erd, stop.row);
    await erd.press(Shortcut.edit);
    await expect.poll(() => notNullOf(erd, stop.row)).toBe(!before);
    return;
  }

  await expect(erd.editInput()).toBeFocused();

  // Enter ends the edit, which deletes the input holding DOM focus. The second
  // press has to travel from wherever the browser put focus next, and that is
  // the gap a keyboard left outside the element falls into.
  await erd.press(Shortcut.edit);
  await expect(erd.editInput()).toHaveCount(0);
  await erd.expectKeyboardFocusInside();

  await erd.press(Shortcut.edit);
  await expect(erd.editInput()).toBeFocused();
  expect(await erd.focusRingCells()).toEqual([nameOf(stop)]);
}

/**
 * Every cell kind, walked out of in both directions, with the state each step
 * lands in asked whether the keyboard still reaches the element. A step that
 * drops DOM focus to the body paints the ring the same as one that does not.
 */
test.describe('Tab keeps the keyboard on whatever it lands on', () => {
  const kinds = RING.filter(
    (stop, index) => RING.findIndex(other => other.type === stop.type) === index
  );

  const steps = kinds.flatMap(from => {
    const index = RING.indexOf(from);
    return [
      { key: 'Tab', from, to: RING[index + 1] },
      {
        key: 'Shift+Tab',
        from,
        to: RING[index === 0 ? RING.length - 1 : index - 1],
      },
    ];
  });

  for (const { key, from, to } of steps) {
    test(`${key} out of ${nameOf(from)} lands on ${nameOf(to)}`, async ({
      erd,
    }) => {
      await erd.seed(oneTable());
      await enterStop(erd, from);

      await erd.press(key);
      await expect(erd.focusRing(cellOf(erd, to))).toBeVisible();
      await expect(erd.focusRings()).toHaveCount(1);
      expect(await erd.focusRingCells()).toEqual([nameOf(to)]);

      await expectKeyboardAnswers(erd, to);
    });
  }
});

const MEMO_ID = 'note';
const MEMO_VALUE = 'alpha\nbravo\ncharlie';

/** One table to aim the table shortcuts at, and one memo to type into. */
const tableAndMemo = (): ErdDocument =>
  createSchema({
    tables: [
      {
        id: 'users',
        name: 'users',
        x: 200,
        y: 180,
        columns: [
          { id: 'users_id', name: 'id', dataType: 'int' },
          { id: 'users_name', name: 'name', dataType: 'varchar(255)' },
        ],
      },
    ],
    memos: [
      {
        id: MEMO_ID,
        value: MEMO_VALUE,
        x: 700,
        y: 200,
        width: 220,
        height: 160,
      },
    ],
  });

type Press = {
  name: string;
  chord: string;
  /** False only where the browser answers by moving focus out of the field. */
  keepsEditor: boolean;
};

const binding = (name: string, chord: string): Press => ({
  name,
  chord,
  keepsEditor: true,
});

/**
 * Every canvas shortcut that has to stand down while a text editor owns the
 * keyboard, then the traversal keys keydown carries rather than a binding.
 * Both chords of each removal binding are here, not just the pressed one.
 */
const PRESSES: Press[] = [
  binding('addTable', Shortcut.addTable),
  binding('addColumn', Shortcut.addColumn),
  binding('addMemo', Shortcut.addMemo),
  binding('removeTable', Shortcut.removeTable),
  binding('removeTable (Delete)', 'ControlOrMeta+Delete'),
  binding('removeColumn', Shortcut.removeColumn),
  binding('removeColumn (Delete)', 'Alt+Delete'),
  binding('primaryKey', Shortcut.primaryKey),
  binding('selectAllTable', Shortcut.selectAllTable),
  binding('selectAllColumn', Shortcut.selectAllColumn),
  binding('relationshipZeroOne', Shortcut.relationshipZeroOne),
  binding('relationshipZeroN', Shortcut.relationshipZeroN),
  binding('relationshipOneOnly', Shortcut.relationshipOneOnly),
  binding('relationshipOneN', Shortcut.relationshipOneN),
  binding('tableProperties', Shortcut.tableProperties),
  binding('search', Shortcut.search),
  binding('zoomIn', Shortcut.zoomIn),
  binding('zoomOut', Shortcut.zoomOut),
  binding('ArrowUp', 'ArrowUp'),
  binding('ArrowDown', 'ArrowDown'),
  binding('ArrowLeft', 'ArrowLeft'),
  binding('ArrowRight', 'ArrowRight'),
  { name: 'Tab', chord: 'Tab', keepsEditor: false },
  { name: 'Shift+Tab', chord: 'Shift+Tab', keepsEditor: false },
];

type EditorState = {
  name: string;
  enter: (erd: ErdEditorPage) => Promise<void>;
  /** Whether a table still wears the focus ring while the editor is open. */
  focusRings: number;
  /** The chords this state answers on purpose, and the grid therefore skips. */
  owned: string[];
};

test.describe('shortcuts while a text editor owns the keyboard', () => {
  const memoBodyPoint = async (erd: ErdEditorPage) => {
    const hit = await erd.sceneBox([`#memo-${MEMO_ID}`, '.memo-textarea-hit']);
    return { x: hit.x + 24, y: hit.y + 24 };
  };

  /** A plain click on the body, which unselects everything on the way in. */
  const openMemoEditor = async (erd: ErdEditorPage) => {
    await erd.clickAt(await memoBodyPoint(erd));
    await expect(erd.memoEditor).toBeFocused();
  };

  /**
   * The gesture the report came in on. selectMemoAction$ skips its unselect
   * while the modifier is down, so the table keeps the focus ring the memo
   * editor is then opened over — the axis every earlier grid was missing.
   */
  const openMemoEditorOverFocus = async (erd: ErdEditorPage) => {
    await erd.focusCell(erd.cell(erd.columnEl('users_id'), 'columnName'));
    await erd.modClickAt(await memoBodyPoint(erd));
    await expect(erd.memoEditor).toBeFocused();
    // A modifier the host reads as a right click leaves a menu standing over
    // the state, which is then what every press below is measured against.
    await expect(erd.contextMenu).toHaveCount(0);
  };

  const openCellEditor = async (erd: ErdEditorPage) => {
    const cell = erd.cell(erd.columnEl('users_name'), 'columnName');
    await cell.dblclick();
    await expect(erd.editInput(cell)).toBeFocused();
  };

  /** The second route to the same state: a cell editor, then the memo. */
  const openCellThenMemo = async (erd: ErdEditorPage) => {
    await openCellEditor(erd);
    await erd.modClickAt(await memoBodyPoint(erd));
    await expect(erd.memoEditor).toBeFocused();
    await expect(erd.contextMenu).toHaveCount(0);
  };

  const STATES: EditorState[] = [
    { name: 'memoEdit', enter: openMemoEditor, focusRings: 0, owned: [] },
    {
      name: 'memoEditFocusTable',
      enter: openMemoEditorOverFocus,
      focusRings: 1,
      owned: [],
    },
    {
      name: 'cellEdit',
      enter: openCellEditor,
      focusRings: 1,
      owned: ['Tab', 'Shift+Tab'],
    },
    {
      name: 'cellEditThenMemo',
      enter: openCellThenMemo,
      focusRings: 1,
      owned: [],
    },
  ];

  /**
   * Everything a leaked chord would move. A grid missing one of these axes
   * cannot see the leak that lands on it, so all of them are read every round.
   */
  const scene = async (erd: ErdEditorPage) => {
    const { doc, collections, settings } = await erd.value();

    return {
      doc,
      tables: collections.tableEntities,
      columns: collections.tableColumnEntities,
      memos: collections.memoEntities,
      zoomLevel: settings.zoomLevel,
      focusRing: await erd.focusRingCells(),
      selectedTables: await erd.selectedTables().count(),
      selectedColumns: await erd.selectedColumns().count(),
      // A relationship draw is armed in editor state alone until the pointer
      // moves, and the icon the root takes as its cursor is where that shows.
      drawArmed: (await erd.canvasCursor()).includes('url('),
      search: await erd.host.locator('.quick-search').count(),
      tableProperties: await erd.host.locator('.table-properties').count(),
      contextMenu: await erd.contextMenu.count(),
    };
  };

  const openEditor = (erd: ErdEditorPage, state: EditorState) =>
    state.name === 'cellEdit' ? erd.editInput() : erd.memoEditor;

  const editorValue = (state: EditorState) =>
    state.name === 'cellEdit' ? 'name' : MEMO_VALUE;

  for (const state of STATES) {
    const staying = PRESSES.filter(
      press => press.keepsEditor && !state.owned.includes(press.chord)
    );

    test(`${state.name}: every registered chord stands down`, async ({
      erd,
    }) => {
      test.setTimeout(90_000);
      await erd.seed(tableAndMemo());
      await state.enter(erd);
      await expect(erd.focusRings()).toHaveCount(state.focusRings);
      await expect(erd.contextMenu).toHaveCount(0);

      // Read once: nothing below is allowed to move it, so the first snapshot
      // stays the oracle for every press and the round trips halve.
      const before = await scene(erd);

      for (const { name, chord } of staying) {
        await test.step(name, async () => {
          await erd.press(chord);
          await erd.page.waitForTimeout(150);

          expect(await scene(erd)).toEqual(before);
          await expect(openEditor(erd, state)).toBeFocused();
          await expect(openEditor(erd, state)).toHaveValue(editorValue(state));
        });
      }
    });

    const leaving = PRESSES.filter(
      press => !press.keepsEditor && !state.owned.includes(press.chord)
    );

    for (const { name, chord } of leaving) {
      test(`${state.name}: ${name} moves focus out and no focus ring`, async ({
        erd,
      }) => {
        await erd.seed(tableAndMemo());
        await state.enter(erd);
        const before = await scene(erd);

        await erd.press(chord);
        await erd.page.waitForTimeout(150);

        // The editor closes because the browser moved focus, exactly as it
        // does out of a plain textarea; the grid underneath must not have run.
        expect(await scene(erd)).toEqual(before);
        await expect(erd.memoEditor).toHaveCount(0);
      });
    }
  }

  test('the reported sequence deletes no column', async ({ erd }) => {
    await erd.seed(tableAndMemo());

    await erd.focusCell(erd.cell(erd.columnEl('users_id'), 'columnName'));
    await erd.modClickAt(await memoBodyPoint(erd));
    await expect(erd.memoEditor).toBeFocused();
    // Both at once is the state the guard has to see: a memo editor open, and
    // a table still focused and selected behind it — and nothing else over it.
    await expect(erd.focusRings()).toHaveCount(1);
    await expect(erd.selectedTables()).toHaveCount(1);
    await expect(erd.contextMenu).toHaveCount(0);

    await erd.press(Shortcut.removeColumn);
    await erd.page.waitForTimeout(200);

    expect(await erd.columnIds('users')).toEqual(['users_id', 'users_name']);
    await expect(erd.memoEditor).toBeFocused();
    await expect(erd.memoEditor).toHaveValue(MEMO_VALUE);
  });

  test('Enter types a newline and arms no cell edit underneath', async ({
    erd,
  }) => {
    await erd.seed(tableAndMemo());
    await openMemoEditorOverFocus(erd);
    await erd.memoEditor.evaluate((element: HTMLTextAreaElement) => {
      element.setSelectionRange(0, 0);
    });

    await erd.press(Shortcut.edit);
    await expect(erd.memoEditor).toBeFocused();
    await expect
      .poll(async () => (await erd.memo(MEMO_ID)).value)
      .toBe(`\n${MEMO_VALUE}`);

    // Closing the memo is what would reveal a cell editor the leaked Enter had
    // armed: the overlay draws the memo in front of it while both are set.
    await erd.memoEditor.evaluate((element: HTMLTextAreaElement) =>
      element.blur()
    );
    await expect(erd.memoEditor).toHaveCount(0);
    await erd.page.waitForTimeout(200);
    await expect(erd.editInput()).toHaveCount(0);
    await expect(erd.focusRings()).toHaveCount(1);
  });

  test('the same chords land again once the memo editor closes', async ({
    erd,
  }) => {
    await erd.seed(tableAndMemo());
    await openMemoEditorOverFocus(erd);

    await erd.memoEditor.evaluate((element: HTMLTextAreaElement) =>
      element.blur()
    );
    await expect(erd.memoEditor).toHaveCount(0);
    await erd.expectKeyboardFocusInside();
    await expect(erd.focusRings()).toHaveCount(1);

    // The positive control for the grid above: same seed, same chords, memo
    // shut. Each one lands, so "nothing changed" was the guard and not a state
    // that had nothing left to change.
    await erd.press(Shortcut.primaryKey);
    await expect(erd.columnKey('users_id', 'pk')).toHaveCount(1);

    await erd.press('ArrowRight');
    await expect(
      erd.focusRing(erd.cell(erd.columnEl('users_id'), 'columnDataType'))
    ).toBeVisible();

    await erd.press(Shortcut.selectAllColumn);
    await expect(erd.selectedColumns()).toHaveCount(2);

    await erd.press(Shortcut.removeColumn);
    expect(await erd.columnIds('users')).toEqual([]);
  });

  test('Escape and Tab close the memo editor, Enter types a newline', async ({
    erd,
  }) => {
    await erd.seed(tableAndMemo());

    await openMemoEditor(erd);
    await erd.press('Escape');
    await expect(erd.memoEditor).toHaveCount(0);
    expect((await erd.memo(MEMO_ID)).value).toBe(MEMO_VALUE);

    await openMemoEditor(erd);
    await erd.press('Tab');
    await expect(erd.memoEditor).toHaveCount(0);
    expect((await erd.memo(MEMO_ID)).value).toBe(MEMO_VALUE);

    await openMemoEditor(erd);
    await erd.memoEditor.evaluate((element: HTMLTextAreaElement) => {
      element.setSelectionRange(0, 0);
    });
    await erd.press('Enter');
    await expect(erd.memoEditor).toBeFocused();
    await expect
      .poll(async () => (await erd.memo(MEMO_ID)).value)
      .toBe(`\n${MEMO_VALUE}`);
  });

  /**
   * Five of the blocked chords need a focused table before they do anything, so
   * pressed on their own inside a memo editor they are quiet for the wrong
   * reason. This is the chain that used to hand them that table.
   */
  test('a memo editor cannot bootstrap itself a table to aim at', async ({
    erd,
  }) => {
    await erd.seed(tableAndMemo());
    await openMemoEditor(erd);

    await erd.press(Shortcut.addTable);
    await erd.page.waitForTimeout(200);
    expect(await erd.tableIds()).toEqual(['users']);
    await expect(erd.focusRings()).toHaveCount(0);

    await erd.press(Shortcut.tableProperties);
    await erd.page.waitForTimeout(200);
    await expect(erd.host.locator('.table-properties')).toHaveCount(0);

    await erd.press(Shortcut.addColumn);
    await erd.page.waitForTimeout(200);
    expect(await erd.columnIds('users')).toEqual(['users_id', 'users_name']);

    await erd.press(Shortcut.removeTable);
    await erd.page.waitForTimeout(200);
    expect(await erd.memoIds()).toEqual([MEMO_ID]);
    await expect(erd.memoEditor).toBeFocused();
  });

  test('undo still steps the store back from inside the memo editor', async ({
    erd,
  }) => {
    await erd.seed(tableAndMemo());
    await erd.focusCanvas();
    await erd.expectKeyboardFocusInside();

    await erd.press(Shortcut.addTable);
    await expect(erd.canvas.locator('.table')).toHaveCount(2);
    const [addedId] = (await erd.tableIds()).filter(id => id !== 'users');

    // The memo editor is the one surface where a plain editing key used to
    // reach the document; undo is the one that still has to, exactly as it
    // does from inside a cell input.
    await openMemoEditor(erd);
    await erd.press(Shortcut.undo);

    await expect(erd.tableEl(addedId)).toHaveCount(0);
    expect(await erd.tableIds()).toEqual(['users']);
    await expect(erd.memoEditor).toBeFocused();
  });
});

test.describe('an IME composition owns the keyboard', () => {
  const memoBodyPoint = async (erd: ErdEditorPage) => {
    const hit = await erd.sceneBox([`#memo-${MEMO_ID}`, '.memo-textarea-hit']);
    return { x: hit.x + 24, y: hit.y + 24 };
  };

  const openMemoEditor = async (erd: ErdEditorPage) => {
    await erd.clickAt(await memoBodyPoint(erd));
    await expect(erd.memoEditor).toBeFocused();
  };

  const openCellEditor = async (erd: ErdEditorPage) => {
    const cell = erd.cell(erd.columnEl('users_name'), 'columnName');
    await cell.dblclick();
    await expect(erd.editInput(cell)).toBeFocused();
  };

  test('Escape cancels the composition rather than closing the memo', async ({
    erd,
  }) => {
    await erd.seed(tableAndMemo());
    await openMemoEditor(erd);
    await erd.startComposition('한');
    const composed = await erd.memoEditor.inputValue();

    await erd.press('Escape');
    await erd.page.waitForTimeout(200);

    await expect(erd.memoEditor).toBeFocused();
    await expect(erd.memoEditor).toHaveValue(composed);

    // Positive control: the same key closes it the moment the composition is
    // no longer in the way.
    await erd.endComposition('한');
    await erd.press('Escape');
    await expect(erd.memoEditor).toHaveCount(0);
  });

  test('Enter settles a syllable rather than closing the cell editor', async ({
    erd,
  }) => {
    await erd.seed(tableAndMemo());
    await openCellEditor(erd);
    await erd.startComposition('한');
    const composed = await erd.editInput().inputValue();

    await erd.press('Enter');
    await erd.page.waitForTimeout(200);

    await expect(erd.editInput()).toBeFocused();
    await expect(erd.editInput()).toHaveValue(composed);

    await erd.endComposition('한');
    await erd.press('Enter');
    await expect(erd.editInput()).toHaveCount(0);
  });

  test('no arrow walks the grid mid-composition', async ({ erd }) => {
    await erd.seed(tableAndMemo());
    await openCellEditor(erd);
    await erd.startComposition('한');
    const ring = await erd.focusRingCells();

    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      await erd.press(key);
      await erd.page.waitForTimeout(120);
      expect(await erd.focusRingCells()).toEqual(ring);
      await expect(erd.editInput()).toBeFocused();
    }
  });

  /**
   * Tab is the one traversal key an open cell editor still answers, so it is
   * also the only one a composition can be measured against: every other key
   * is already the caret's while a cell is being edited.
   */
  test('Tab does not step the cell editor on mid-composition', async ({
    erd,
  }) => {
    await erd.seed(tableAndMemo());
    await openCellEditor(erd);
    await erd.startComposition('한');
    const ring = await erd.focusRingCells();

    await erd.press('Tab');
    await erd.page.waitForTimeout(200);

    expect(await erd.focusRingCells()).toEqual(ring);
    expect((await erd.column('users_name')).dataType).toBe('varchar(255)');

    // Positive control: the same key steps the grid the moment the browser is
    // done composing.
    await erd.endComposition('한');
    await openCellEditor(erd);
    await erd.press('Tab');
    await expect(
      erd.focusRing(erd.cell(erd.columnEl('users_name'), 'columnDataType'))
    ).toBeVisible();
  });

  /**
   * The field itself is fair game: an unclaimed Alt+Backspace is a word delete
   * in any input. What must not move is the scene around it.
   */
  const around = async (erd: ErdEditorPage) => {
    const { doc, collections, settings } = await erd.value();

    return {
      tableIds: doc.tableIds,
      memoIds: doc.memoIds,
      columnIds: collections.tableEntities.users.columnIds,
      options: Object.values(collections.tableColumnEntities).map(
        column => column.options
      ),
      zoomLevel: settings.zoomLevel,
      focusRing: await erd.focusRingCells(),
      selectedTables: await erd.selectedTables().count(),
      search: await erd.host.locator('.quick-search').count(),
    };
  };

  test('no canvas shortcut fires mid-composition', async ({ erd }) => {
    await erd.seed(tableAndMemo());
    await openCellEditor(erd);
    await erd.startComposition('한');
    const before = await around(erd);

    for (const chord of [
      Shortcut.addTable,
      Shortcut.addMemo,
      Shortcut.removeTable,
      Shortcut.removeColumn,
      Shortcut.primaryKey,
      Shortcut.selectAllTable,
      Shortcut.selectAllColumn,
      Shortcut.relationshipZeroN,
      Shortcut.tableProperties,
      Shortcut.zoomIn,
      Shortcut.zoomOut,
      Shortcut.search,
    ]) {
      await erd.press(chord);
      await erd.page.waitForTimeout(120);
    }

    expect(await around(erd)).toEqual(before);
    await expect(erd.editInput()).toBeFocused();
  });
});
