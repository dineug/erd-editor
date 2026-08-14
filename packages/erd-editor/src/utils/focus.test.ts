import { describe, expect, it } from 'vitest';

import { FocusTable, FocusType } from '@/engine/modules/editor/state';
import {
  isEdit,
  isFocus,
  isSelectColumn,
  lastCursorFocus,
} from '@/utils/focus';

const createFocusTable = (value?: Partial<FocusTable>): FocusTable => ({
  tableId: 'table-1',
  columnId: null,
  focusType: FocusType.tableName,
  selectColumnIds: [],
  prevSelectColumnId: null,
  edit: false,
  ...value,
});

describe('isFocus', () => {
  it('returns false when there is no focus table', () => {
    expect(isFocus(null, FocusType.tableName, 'table-1')).toBe(false);
  });

  it('returns false when the table id does not match', () => {
    expect(isFocus(createFocusTable(), FocusType.tableName, 'table-2')).toBe(
      false
    );
  });

  it('matches the table name regardless of the column id', () => {
    const focusTable = createFocusTable({
      focusType: FocusType.tableName,
      columnId: 'column-1',
    });

    expect(isFocus(focusTable, FocusType.tableName, 'table-1')).toBe(true);
    expect(isFocus(focusTable, FocusType.tableName, 'table-1', 'other')).toBe(
      true
    );
  });

  it('matches the table comment only when the focus type is the same', () => {
    const focusTable = createFocusTable({ focusType: FocusType.tableComment });

    expect(isFocus(focusTable, FocusType.tableComment, 'table-1')).toBe(true);
    expect(isFocus(focusTable, FocusType.tableName, 'table-1')).toBe(false);
  });

  it('requires both the column id and the focus type for column focus types', () => {
    const focusTable = createFocusTable({
      focusType: FocusType.columnName,
      columnId: 'column-1',
    });

    expect(
      isFocus(focusTable, FocusType.columnName, 'table-1', 'column-1')
    ).toBe(true);
    expect(
      isFocus(focusTable, FocusType.columnName, 'table-1', 'column-2')
    ).toBe(false);
    expect(
      isFocus(focusTable, FocusType.columnDataType, 'table-1', 'column-1')
    ).toBe(false);
  });

  it('defaults the column id to null so a table level focus type never matches a column', () => {
    const focusTable = createFocusTable({
      focusType: FocusType.columnComment,
      columnId: null,
    });

    expect(isFocus(focusTable, FocusType.columnComment, 'table-1')).toBe(true);
    expect(
      isFocus(focusTable, FocusType.columnComment, 'table-1', 'column-1')
    ).toBe(false);
  });

  it('returns false when the focus type is a column type but the focus table is on the name', () => {
    const focusTable = createFocusTable({ focusType: FocusType.tableName });

    expect(
      isFocus(focusTable, FocusType.columnUnique, 'table-1', 'column-1')
    ).toBe(false);
  });
});

describe('isSelectColumn', () => {
  it('returns false when there is no focus table', () => {
    expect(isSelectColumn(null, 'table-1', 'column-1')).toBe(false);
  });

  it('returns false when the table id does not match', () => {
    const focusTable = createFocusTable({ selectColumnIds: ['column-1'] });

    expect(isSelectColumn(focusTable, 'table-2', 'column-1')).toBe(false);
  });

  it('returns true only for ids inside selectColumnIds', () => {
    const focusTable = createFocusTable({
      selectColumnIds: ['column-1', 'column-3'],
    });

    expect(isSelectColumn(focusTable, 'table-1', 'column-1')).toBe(true);
    expect(isSelectColumn(focusTable, 'table-1', 'column-3')).toBe(true);
    expect(isSelectColumn(focusTable, 'table-1', 'column-2')).toBe(false);
  });

  it('returns false when nothing is selected', () => {
    expect(isSelectColumn(createFocusTable(), 'table-1', 'column-1')).toBe(
      false
    );
  });
});

describe('isEdit', () => {
  it('returns false when there is no focus table', () => {
    expect(isEdit(null, FocusType.tableName, 'table-1')).toBe(false);
  });

  it('returns false when the table id does not match', () => {
    const focusTable = createFocusTable({ edit: true });

    expect(isEdit(focusTable, FocusType.tableName, 'table-2')).toBe(false);
  });

  it('requires the edit flag for table level focus types', () => {
    expect(
      isEdit(
        createFocusTable({ focusType: FocusType.tableName, edit: false }),
        FocusType.tableName,
        'table-1'
      )
    ).toBe(false);
    expect(
      isEdit(
        createFocusTable({ focusType: FocusType.tableName, edit: true }),
        FocusType.tableName,
        'table-1'
      )
    ).toBe(true);
  });

  it('returns false when the table level focus type differs', () => {
    const focusTable = createFocusTable({
      focusType: FocusType.tableComment,
      edit: true,
    });

    expect(isEdit(focusTable, FocusType.tableName, 'table-1')).toBe(false);
    expect(isEdit(focusTable, FocusType.tableComment, 'table-1')).toBe(true);
  });

  it('requires the column id, the focus type and the edit flag for column focus types', () => {
    const focusTable = createFocusTable({
      focusType: FocusType.columnDataType,
      columnId: 'column-1',
      edit: true,
    });

    expect(
      isEdit(focusTable, FocusType.columnDataType, 'table-1', 'column-1')
    ).toBe(true);
    expect(
      isEdit(focusTable, FocusType.columnDataType, 'table-1', 'column-2')
    ).toBe(false);
    expect(
      isEdit(focusTable, FocusType.columnName, 'table-1', 'column-1')
    ).toBe(false);
    expect(
      isEdit(
        createFocusTable({
          focusType: FocusType.columnDataType,
          columnId: 'column-1',
          edit: false,
        }),
        FocusType.columnDataType,
        'table-1',
        'column-1'
      )
    ).toBe(false);
  });
});

describe('lastCursorFocus', () => {
  it('moves the caret to the end of the value and focuses the input', () => {
    const input = document.createElement('input');
    input.value = 'hello world';
    document.body.append(input);

    lastCursorFocus(input);

    expect(input.selectionStart).toBe(11);
    expect(input.selectionEnd).toBe(11);
    expect(document.activeElement).toBe(input);

    input.remove();
  });

  it('handles an empty value', () => {
    const input = document.createElement('input');
    document.body.append(input);

    lastCursorFocus(input);

    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(0);
    expect(document.activeElement).toBe(input);

    input.remove();
  });
});
