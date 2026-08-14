import { describe, expect, it } from 'vitest';

import { Show } from '@/constants/schema';
import { createEngineContext } from '@/engine/context';
import {
  focusColumnAction,
  focusMoveTableAction,
  focusTableAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, MoveKey } from '@/engine/modules/editor/state';
import {
  arrowDown,
  arrowLeft,
  arrowRight,
  arrowUp,
  getRemoveFirstColumnId,
  isColumns,
  isLastColumn,
  isLastRowColumn,
  isLastTable,
  isTableFocusType,
} from '@/engine/modules/editor/utils/focus';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { createStore, Store } from '@/engine/store';

const TABLE_ID = 'table-1';

const move = (moveKey: MoveKey, shiftKey = false) => ({ moveKey, shiftKey });

function createTestStore(columnIds: string[] = []): Store {
  const store = createStore(
    createEngineContext({ toWidth: text => text.length * 10 }),
    false
  );

  store.dispatchSync(
    addTableAction({ id: TABLE_ID, ui: { x: 0, y: 0, zIndex: 2 } })
  );

  for (const id of columnIds) {
    store.dispatchSync(addColumnAction({ id, tableId: TABLE_ID }));
  }

  return store;
}

function focusTable(store: Store, focusType: FocusType) {
  store.dispatchSync(focusTableAction({ tableId: TABLE_ID, focusType }));
}

function focusColumn(
  store: Store,
  columnId: string,
  focusType: FocusType,
  options: { $mod?: boolean; shiftKey?: boolean } = {}
) {
  store.dispatchSync(
    focusColumnAction({
      tableId: TABLE_ID,
      columnId,
      focusType,
      $mod: Boolean(options.$mod),
      shiftKey: Boolean(options.shiftKey),
    })
  );
}

function getFocus(store: Store) {
  const focus = store.state.editor.focusTable;
  if (!focus) throw new Error('focusTable is null');
  return focus;
}

function focusMissingTable(store: Store, focusType: FocusType) {
  store.state.editor.focusTable = {
    tableId: 'missing-table',
    columnId: null,
    focusType,
    selectColumnIds: [],
    prevSelectColumnId: null,
    edit: false,
  };
}

function hide(store: Store, show: number) {
  store.dispatchSync(changeShowAction({ show, value: false }));
}

function reveal(store: Store, show: number) {
  store.dispatchSync(changeShowAction({ show, value: true }));
}

describe('isTableFocusType', () => {
  it('is true only for the table focus types', () => {
    expect(isTableFocusType(FocusType.tableName)).toBe(true);
    expect(isTableFocusType(FocusType.tableComment)).toBe(true);
  });

  it('is false for every column focus type', () => {
    expect(isTableFocusType(FocusType.columnName)).toBe(false);
    expect(isTableFocusType(FocusType.columnDataType)).toBe(false);
    expect(isTableFocusType(FocusType.columnComment)).toBe(false);
  });
});

describe('isColumns', () => {
  it('is false when nothing is focused', () => {
    const store = createTestStore(['c1']);

    expect(isColumns(store.state)).toBe(false);
  });

  it('is false when the focused table does not exist', () => {
    const store = createTestStore(['c1']);
    focusMissingTable(store, FocusType.tableName);

    expect(isColumns(store.state)).toBe(false);
  });

  it('is false when the focused table has no columns', () => {
    const store = createTestStore();
    focusTable(store, FocusType.tableName);

    expect(isColumns(store.state)).toBe(false);
  });

  it('is true when the focused table has columns', () => {
    const store = createTestStore(['c1', 'c2']);
    focusTable(store, FocusType.tableName);

    expect(isColumns(store.state)).toBe(true);
  });
});

describe('isLastColumn', () => {
  it('is true when nothing is focused', () => {
    const store = createTestStore(['c1']);

    expect(isLastColumn(store.state)).toBe(true);
  });

  it('is true on the last visible column type', () => {
    const store = createTestStore(['c1']);
    focusColumn(store, 'c1', FocusType.columnComment);

    expect(isLastColumn(store.state)).toBe(true);
  });

  it('is false on the first visible column type', () => {
    const store = createTestStore(['c1']);
    focusColumn(store, 'c1', FocusType.columnName);

    expect(isLastColumn(store.state)).toBe(false);
  });

  it('follows the visible column types when a column is hidden', () => {
    const store = createTestStore(['c1']);
    hide(store, Show.columnComment);
    focusColumn(store, 'c1', FocusType.columnDefault);

    expect(isLastColumn(store.state)).toBe(true);
  });

  it('is false for a focus type that is not a visible column type', () => {
    const store = createTestStore(['c1']);
    focusColumn(store, 'c1', FocusType.columnUnique);

    expect(isLastColumn(store.state)).toBe(false);
  });
});

describe('isLastRowColumn', () => {
  it('is true when nothing is focused', () => {
    const store = createTestStore(['c1']);

    expect(isLastRowColumn(store.state)).toBe(true);
  });

  it('is true when no column is focused', () => {
    const store = createTestStore(['c1']);
    focusTable(store, FocusType.tableName);

    expect(isLastRowColumn(store.state)).toBe(true);
  });

  it('is true when the focused table is missing', () => {
    const store = createTestStore(['c1']);
    focusColumn(store, 'c1', FocusType.columnName);
    getFocus(store).tableId = 'missing-table';

    expect(isLastRowColumn(store.state)).toBe(true);
  });

  it('is true on the last row and false otherwise', () => {
    const store = createTestStore(['c1', 'c2']);

    focusColumn(store, 'c2', FocusType.columnName);
    expect(isLastRowColumn(store.state)).toBe(true);

    focusColumn(store, 'c1', FocusType.columnName);
    expect(isLastRowColumn(store.state)).toBe(false);
  });
});

describe('getRemoveFirstColumnId', () => {
  it('returns null when nothing is focused', () => {
    const store = createTestStore(['c1', 'c2']);

    expect(getRemoveFirstColumnId(store.state, ['c2'])).toBeNull();
  });

  it('returns null when no column is focused', () => {
    const store = createTestStore(['c1', 'c2']);
    focusTable(store, FocusType.tableName);

    expect(getRemoveFirstColumnId(store.state, ['c2'])).toBeNull();
  });

  it('returns null when the focused table is missing', () => {
    const store = createTestStore(['c1', 'c2']);
    focusColumn(store, 'c2', FocusType.columnName);
    getFocus(store).tableId = 'missing-table';

    expect(getRemoveFirstColumnId(store.state, ['c2'])).toBeNull();
  });

  it('returns null when the focused column is the first row', () => {
    const store = createTestStore(['c1', 'c2']);
    focusColumn(store, 'c1', FocusType.columnName);

    expect(getRemoveFirstColumnId(store.state, ['c1'])).toBeNull();
  });

  it('returns the focused column itself when it is not being removed', () => {
    const store = createTestStore(['c1', 'c2', 'c3']);
    focusColumn(store, 'c3', FocusType.columnName);

    expect(getRemoveFirstColumnId(store.state, [])).toBe('c3');
  });

  it('walks upwards past every removed column', () => {
    const store = createTestStore(['c1', 'c2', 'c3']);
    focusColumn(store, 'c3', FocusType.columnName);

    expect(getRemoveFirstColumnId(store.state, ['c3'])).toBe('c2');
    expect(getRemoveFirstColumnId(store.state, ['c2', 'c3'])).toBe('c1');
  });

  it('returns null when every column up to the focus is removed', () => {
    const store = createTestStore(['c1', 'c2', 'c3']);
    focusColumn(store, 'c3', FocusType.columnName);

    expect(getRemoveFirstColumnId(store.state, ['c1', 'c2', 'c3'])).toBeNull();
  });
});

describe('isLastTable', () => {
  it('is true when nothing is focused', () => {
    const store = createTestStore();

    expect(isLastTable(store.state)).toBe(true);
  });

  it('is true on tableComment and false on tableName while the comment shows', () => {
    const store = createTestStore();

    focusTable(store, FocusType.tableComment);
    expect(isLastTable(store.state)).toBe(true);

    focusTable(store, FocusType.tableName);
    expect(isLastTable(store.state)).toBe(false);
  });

  it('is true on tableName when the table comment is hidden', () => {
    const store = createTestStore();
    hide(store, Show.tableComment);
    focusTable(store, FocusType.tableName);

    expect(isLastTable(store.state)).toBe(true);
  });
});

describe('arrowUp', () => {
  it('does nothing when nothing is focused', () => {
    const store = createTestStore(['c1']);

    arrowUp(store.state, move(MoveKey.ArrowUp));

    expect(store.state.editor.focusTable).toBeNull();
  });

  it('does nothing when the focused table is missing', () => {
    const store = createTestStore(['c1']);
    focusMissingTable(store, FocusType.tableName);

    arrowUp(store.state, move(MoveKey.ArrowUp));

    expect(getFocus(store).focusType).toBe(FocusType.tableName);
    expect(getFocus(store).columnId).toBeNull();
  });

  it('jumps from the table row to the last column row', () => {
    const store = createTestStore(['c1', 'c2']);
    focusTable(store, FocusType.tableName);

    arrowUp(store.state, move(MoveKey.ArrowUp));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.columnComment,
      columnId: 'c2',
      prevSelectColumnId: 'c2',
      selectColumnIds: ['c2'],
    });
  });

  it('stays on the table row when the table has no columns', () => {
    const store = createTestStore();
    focusTable(store, FocusType.tableComment);

    arrowUp(store.state, move(MoveKey.ArrowUp));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.tableComment,
      columnId: null,
      selectColumnIds: [],
    });
  });

  it('returns to the table name from the first column row', () => {
    const store = createTestStore(['c1', 'c2']);
    focusColumn(store, 'c1', FocusType.columnDataType);

    arrowUp(store.state, move(MoveKey.ArrowUp));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.tableName,
      columnId: null,
      prevSelectColumnId: null,
      selectColumnIds: [],
    });
  });

  it('returns to the table name when a column type is focused without a column', () => {
    const store = createTestStore(['c1', 'c2']);
    focusTable(store, FocusType.columnDataType);
    expect(getFocus(store).columnId).toBeNull();

    arrowUp(store.state, move(MoveKey.ArrowUp));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.tableName,
      columnId: null,
      selectColumnIds: [],
    });
  });

  it('moves one column row up and replaces the selection', () => {
    const store = createTestStore(['c1', 'c2', 'c3']);
    focusColumn(store, 'c3', FocusType.columnName);

    arrowUp(store.state, move(MoveKey.ArrowUp));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.columnName,
      columnId: 'c2',
      prevSelectColumnId: 'c2',
      selectColumnIds: ['c2'],
    });
  });

  it('appends to the selection with shift', () => {
    const store = createTestStore(['c1', 'c2', 'c3']);
    focusColumn(store, 'c3', FocusType.columnName);

    arrowUp(store.state, move(MoveKey.ArrowUp, true));

    expect(getFocus(store).selectColumnIds).toEqual(['c3', 'c2']);
  });

  it('replaces the selection for shift + Tab', () => {
    const store = createTestStore(['c1', 'c2', 'c3']);
    focusColumn(store, 'c3', FocusType.columnName);

    arrowUp(store.state, move(MoveKey.Tab, true));

    expect(getFocus(store).selectColumnIds).toEqual(['c2']);
  });
});

describe('arrowDown', () => {
  it('does nothing when nothing is focused', () => {
    const store = createTestStore(['c1']);

    arrowDown(store.state, move(MoveKey.ArrowDown));

    expect(store.state.editor.focusTable).toBeNull();
  });

  it('does nothing when the focused table is missing', () => {
    const store = createTestStore(['c1']);
    focusMissingTable(store, FocusType.tableName);

    arrowDown(store.state, move(MoveKey.ArrowDown));

    expect(getFocus(store).focusType).toBe(FocusType.tableName);
  });

  it('jumps from the table row to the first column row', () => {
    const store = createTestStore(['c1', 'c2']);
    focusTable(store, FocusType.tableName);

    arrowDown(store.state, move(MoveKey.ArrowDown));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.columnName,
      columnId: 'c1',
      prevSelectColumnId: 'c1',
      selectColumnIds: ['c1'],
    });
  });

  it('stays on the table row when the table has no columns', () => {
    const store = createTestStore();
    focusTable(store, FocusType.tableName);

    arrowDown(store.state, move(MoveKey.ArrowDown));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.tableName,
      columnId: null,
    });
  });

  it('returns to the table name from the last column row', () => {
    const store = createTestStore(['c1', 'c2']);
    focusColumn(store, 'c2', FocusType.columnDefault);

    arrowDown(store.state, move(MoveKey.ArrowDown));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.tableName,
      columnId: null,
      prevSelectColumnId: null,
      selectColumnIds: [],
    });
  });

  it('moves one column row down and replaces the selection', () => {
    const store = createTestStore(['c1', 'c2', 'c3']);
    focusColumn(store, 'c1', FocusType.columnName);

    arrowDown(store.state, move(MoveKey.ArrowDown));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.columnName,
      columnId: 'c2',
      prevSelectColumnId: 'c2',
      selectColumnIds: ['c2'],
    });
  });

  it('appends to the selection with shift', () => {
    const store = createTestStore(['c1', 'c2', 'c3']);
    focusColumn(store, 'c1', FocusType.columnName);

    arrowDown(store.state, move(MoveKey.ArrowDown, true));

    expect(getFocus(store).selectColumnIds).toEqual(['c1', 'c2']);
  });

  it('replaces the selection for shift + Tab', () => {
    const store = createTestStore(['c1', 'c2', 'c3']);
    focusColumn(store, 'c1', FocusType.columnName);

    arrowDown(store.state, move(MoveKey.Tab, true));

    expect(getFocus(store).selectColumnIds).toEqual(['c2']);
  });
});

describe('arrowLeft', () => {
  it('does nothing when nothing is focused', () => {
    const store = createTestStore(['c1']);

    arrowLeft(store.state, move(MoveKey.ArrowLeft));

    expect(store.state.editor.focusTable).toBeNull();
  });

  it('does nothing when the focused table is missing', () => {
    const store = createTestStore(['c1']);
    focusMissingTable(store, FocusType.columnName);

    arrowLeft(store.state, move(MoveKey.ArrowLeft));

    expect(getFocus(store).focusType).toBe(FocusType.columnName);
  });

  it('wraps from the first table type onto the last column of the last row', () => {
    const store = createTestStore(['c1', 'c2']);
    focusTable(store, FocusType.tableName);

    arrowLeft(store.state, move(MoveKey.ArrowLeft));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.columnComment,
      columnId: 'c2',
      prevSelectColumnId: 'c2',
      selectColumnIds: ['c2'],
    });
  });

  it('wraps to the table comment when the table has no columns', () => {
    const store = createTestStore();
    focusTable(store, FocusType.tableName);

    arrowLeft(store.state, move(MoveKey.ArrowLeft));

    expect(getFocus(store).focusType).toBe(FocusType.tableComment);
  });

  it('stays on the table name when the comment is hidden and there are no columns', () => {
    const store = createTestStore();
    hide(store, Show.tableComment);
    focusTable(store, FocusType.tableName);

    arrowLeft(store.state, move(MoveKey.ArrowLeft));

    expect(getFocus(store).focusType).toBe(FocusType.tableName);
  });

  it('moves from the table comment to the table name', () => {
    const store = createTestStore(['c1']);
    focusTable(store, FocusType.tableComment);

    arrowLeft(store.state, move(MoveKey.ArrowLeft));

    expect(getFocus(store).focusType).toBe(FocusType.tableName);
  });

  it('leaves the first column of the first row for the table comment', () => {
    const store = createTestStore(['c1', 'c2']);
    focusColumn(store, 'c1', FocusType.columnName);

    arrowLeft(store.state, move(MoveKey.ArrowLeft));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.tableComment,
      columnId: null,
      prevSelectColumnId: null,
      selectColumnIds: [],
    });
  });

  it('leaves the first column of the first row for the table name when the comment is hidden', () => {
    const store = createTestStore(['c1', 'c2']);
    hide(store, Show.tableComment);
    focusColumn(store, 'c1', FocusType.columnName);

    arrowLeft(store.state, move(MoveKey.ArrowLeft));

    expect(getFocus(store).focusType).toBe(FocusType.tableName);
  });

  it('wraps from the first column onto the last column of the previous row', () => {
    const store = createTestStore(['c1', 'c2', 'c3']);
    focusColumn(store, 'c3', FocusType.columnName);

    arrowLeft(store.state, move(MoveKey.ArrowLeft));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.columnComment,
      columnId: 'c2',
      prevSelectColumnId: 'c2',
      selectColumnIds: ['c2'],
    });
  });

  it('appends to the selection when wrapping rows with shift', () => {
    const store = createTestStore(['c1', 'c2', 'c3']);
    focusColumn(store, 'c3', FocusType.columnName);

    arrowLeft(store.state, move(MoveKey.ArrowLeft, true));

    expect(getFocus(store).selectColumnIds).toEqual(['c3', 'c2']);
  });

  it('replaces the selection when wrapping rows with shift + Tab', () => {
    const store = createTestStore(['c1', 'c2', 'c3']);
    focusColumn(store, 'c3', FocusType.columnName);

    arrowLeft(store.state, move(MoveKey.Tab, true));

    expect(getFocus(store).selectColumnIds).toEqual(['c2']);
  });

  it('moves one column type left and collapses the selection', () => {
    const store = createTestStore(['c1', 'c2']);
    focusColumn(store, 'c1', FocusType.columnName);
    focusColumn(store, 'c2', FocusType.columnDataType, { $mod: true });
    expect(getFocus(store).selectColumnIds).toEqual(['c1', 'c2']);

    arrowLeft(store.state, move(MoveKey.ArrowLeft));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.columnName,
      columnId: 'c2',
      prevSelectColumnId: 'c2',
      selectColumnIds: ['c2'],
    });
  });

  it('keeps the selection when moving one column type left with shift', () => {
    const store = createTestStore(['c1', 'c2']);
    focusColumn(store, 'c1', FocusType.columnName);
    focusColumn(store, 'c2', FocusType.columnDataType, { $mod: true });

    arrowLeft(store.state, move(MoveKey.ArrowLeft, true));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.columnName,
      selectColumnIds: ['c1', 'c2'],
    });
  });

  it('skips hidden column types', () => {
    const store = createTestStore(['c1']);
    hide(store, Show.columnDataType);
    focusColumn(store, 'c1', FocusType.columnNotNull);

    arrowLeft(store.state, move(MoveKey.ArrowLeft));

    expect(getFocus(store).focusType).toBe(FocusType.columnName);
  });
});

describe('arrowRight', () => {
  it('does nothing when nothing is focused', () => {
    const store = createTestStore(['c1']);

    arrowRight(store.state, move(MoveKey.ArrowRight));

    expect(store.state.editor.focusTable).toBeNull();
  });

  it('does nothing when the focused table is missing', () => {
    const store = createTestStore(['c1']);
    focusMissingTable(store, FocusType.columnName);

    arrowRight(store.state, move(MoveKey.ArrowRight));

    expect(getFocus(store).focusType).toBe(FocusType.columnName);
  });

  it('moves from the table name to the table comment', () => {
    const store = createTestStore(['c1']);
    focusTable(store, FocusType.tableName);

    arrowRight(store.state, move(MoveKey.ArrowRight));

    expect(getFocus(store).focusType).toBe(FocusType.tableComment);
  });

  it('wraps from the last table type onto the first column of the first row', () => {
    const store = createTestStore(['c1', 'c2']);
    focusTable(store, FocusType.tableComment);

    arrowRight(store.state, move(MoveKey.ArrowRight));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.columnName,
      columnId: 'c1',
      prevSelectColumnId: 'c1',
      selectColumnIds: ['c1'],
    });
  });

  it('wraps to the table name when the table has no columns', () => {
    const store = createTestStore();
    focusTable(store, FocusType.tableComment);

    arrowRight(store.state, move(MoveKey.ArrowRight));

    expect(getFocus(store).focusType).toBe(FocusType.tableName);
  });

  it('leaves the last column of the last row for the table name', () => {
    const store = createTestStore(['c1', 'c2']);
    focusColumn(store, 'c2', FocusType.columnComment);

    arrowRight(store.state, move(MoveKey.ArrowRight));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.tableName,
      columnId: null,
      prevSelectColumnId: null,
      selectColumnIds: [],
    });
  });

  it('wraps from the last column onto the first column of the next row', () => {
    const store = createTestStore(['c1', 'c2', 'c3']);
    focusColumn(store, 'c1', FocusType.columnComment);

    arrowRight(store.state, move(MoveKey.ArrowRight));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.columnName,
      columnId: 'c2',
      prevSelectColumnId: 'c2',
      selectColumnIds: ['c2'],
    });
  });

  it('appends to the selection when wrapping rows with shift', () => {
    const store = createTestStore(['c1', 'c2', 'c3']);
    focusColumn(store, 'c1', FocusType.columnComment);

    arrowRight(store.state, move(MoveKey.ArrowRight, true));

    expect(getFocus(store).selectColumnIds).toEqual(['c1', 'c2']);
  });

  it('replaces the selection when wrapping rows with Tab', () => {
    const store = createTestStore(['c1', 'c2', 'c3']);
    focusColumn(store, 'c1', FocusType.columnComment);

    arrowRight(store.state, move(MoveKey.Tab, true));

    expect(getFocus(store).selectColumnIds).toEqual(['c2']);
  });

  it('moves one column type right and collapses the selection', () => {
    const store = createTestStore(['c1', 'c2']);
    focusColumn(store, 'c1', FocusType.columnName);
    focusColumn(store, 'c2', FocusType.columnName, { $mod: true });
    expect(getFocus(store).selectColumnIds).toEqual(['c1', 'c2']);

    arrowRight(store.state, move(MoveKey.ArrowRight));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.columnDataType,
      columnId: 'c2',
      prevSelectColumnId: 'c2',
      selectColumnIds: ['c2'],
    });
  });

  it('keeps the selection when moving one column type right with shift', () => {
    const store = createTestStore(['c1', 'c2']);
    focusColumn(store, 'c1', FocusType.columnName);
    focusColumn(store, 'c2', FocusType.columnName, { $mod: true });

    arrowRight(store.state, move(MoveKey.ArrowRight, true));

    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.columnDataType,
      selectColumnIds: ['c1', 'c2'],
    });
  });

  it('walks through the column types revealed by the show flags', () => {
    const store = createTestStore(['c1']);
    reveal(store, Show.columnUnique | Show.columnAutoIncrement);
    focusColumn(store, 'c1', FocusType.columnNotNull);

    arrowRight(store.state, move(MoveKey.ArrowRight));
    expect(getFocus(store).focusType).toBe(FocusType.columnUnique);

    arrowRight(store.state, move(MoveKey.ArrowRight));
    expect(getFocus(store).focusType).toBe(FocusType.columnAutoIncrement);
  });
});

describe('focusMoveTable integration', () => {
  it('routes Tab to the right and shift + Tab to the left', () => {
    const store = createTestStore(['c1', 'c2']);
    focusColumn(store, 'c1', FocusType.columnName);

    store.dispatchSync(
      focusMoveTableAction({ moveKey: MoveKey.Tab, shiftKey: false })
    );
    expect(getFocus(store).focusType).toBe(FocusType.columnDataType);

    store.dispatchSync(
      focusMoveTableAction({ moveKey: MoveKey.Tab, shiftKey: true })
    );
    expect(getFocus(store).focusType).toBe(FocusType.columnName);
  });

  it('walks the whole grid with the arrow keys', () => {
    const store = createTestStore(['c1', 'c2']);
    focusTable(store, FocusType.tableName);

    store.dispatchSync(
      focusMoveTableAction({ moveKey: MoveKey.ArrowDown, shiftKey: false })
    );
    expect(getFocus(store)).toMatchObject({
      focusType: FocusType.columnName,
      columnId: 'c1',
    });

    store.dispatchSync(
      focusMoveTableAction({ moveKey: MoveKey.ArrowDown, shiftKey: false })
    );
    expect(getFocus(store).columnId).toBe('c2');

    store.dispatchSync(
      focusMoveTableAction({ moveKey: MoveKey.ArrowUp, shiftKey: false })
    );
    expect(getFocus(store).columnId).toBe('c1');
  });
});
