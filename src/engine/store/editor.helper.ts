import { FocusTable, FocusType } from '@@types/engine/store/editor.state';

export function isFocus(
  focusTable: FocusTable | null,
  focusType: FocusType,
  tableId: string,
  columnId: string | null = null
): boolean {
  if (!focusTable) return false;

  switch (focusType) {
    case 'tableName':
    case 'tableComment':
      return tableId === focusTable.tableId;
  }

  if (!columnId) return false;

  return columnId === focusTable.columnId && focusType === focusTable.focusType;
}

export const isSelectColumn = (
  focusTable: FocusTable | null,
  columnId: string
) =>
  !!focusTable?.selectColumnIds.some(
    selectColumnId => selectColumnId === columnId
  );
