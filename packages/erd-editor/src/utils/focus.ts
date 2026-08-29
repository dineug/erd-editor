import {
  FocusTable,
  FocusType,
  SharedFocus,
} from '@/engine/modules/editor/state';

export function isFocus(
  focusTable: Pick<FocusTable, 'tableId' | 'columnId' | 'focusType'> | null,
  focusType: FocusType,
  tableId: string,
  columnId: string | null = null
): boolean {
  if (!focusTable || tableId !== focusTable.tableId) return false;

  switch (focusType) {
    case 'tableName':
    case 'tableComment':
      return focusType === focusTable.focusType;
  }

  return columnId === focusTable.columnId && focusType === focusTable.focusType;
}

export const isSelectColumn = (
  focusTable: FocusTable | null,
  tableId: string,
  columnId: string
) =>
  focusTable?.tableId === tableId &&
  focusTable.selectColumnIds.includes(columnId);

export function isEdit(
  focusTable: FocusTable | null,
  focusType: FocusType,
  tableId: string,
  columnId: string | null = null
) {
  if (focusTable?.tableId !== tableId) return false;

  switch (focusType) {
    case FocusType.tableName:
    case FocusType.tableComment:
      return focusType === focusTable.focusType && focusTable.edit;
  }

  return (
    columnId === focusTable.columnId &&
    focusType === focusTable.focusType &&
    focusTable.edit
  );
}

export function lastCursorFocus(input: HTMLInputElement) {
  const len = input.value.length;
  input.selectionStart = len;
  input.selectionEnd = len;
  input.focus();
}

export const toSharedFocus = (
  focusTable: FocusTable | null
): SharedFocus | null =>
  focusTable
    ? {
        tableId: focusTable.tableId,
        columnId: focusTable.columnId,
        focusType: focusTable.focusType,
      }
    : null;

export const toSharedFocusKey = (focus: SharedFocus | null) =>
  focus ? JSON.stringify([focus.tableId, focus.columnId, focus.focusType]) : '';
