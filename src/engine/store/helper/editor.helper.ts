import { FocusTable, FocusType } from '@@types/engine/store/editor.state';

export function isFocus(
  focusTable: FocusTable | null,
  focusType: FocusType,
  tableId: string,
  columnId: string | null = null
): boolean {
  if (!focusTable || tableId !== focusTable.table.id) return false;

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
  focusTable?.table.id === tableId &&
  focusTable.selectColumnIds.includes(columnId);
