import { FocusTable, FocusType } from "../model/FocusTableModel";
import {
  FocusColumn,
  FocusColumnKey,
  focusColumnKeyFocusTypeKeyMap,
} from "../model/FocusColumnModel";
import { Show, Setting } from "../store/Canvas";

export function focusTableEnd(focusTable: FocusTable) {
  focusTable.focusName = false;
  focusTable.focusComment = false;
}

export function focusColumnEnd(focusColumns: FocusColumn[]) {
  focusColumns.forEach((focusColumn) => {
    Object.keys(focusColumnKeyFocusTypeKeyMap).forEach((key) => {
      const k = key as FocusColumnKey;
      focusColumn[k] = false;
    });
  });
}

export function focusEnd(focusTable: FocusTable) {
  focusTableEnd(focusTable);
  focusColumnEnd(focusTable.focusColumns);
}

export function selectEndColumn(focusColumns: FocusColumn[]) {
  focusColumns.forEach((focusColumn) => (focusColumn.select = false));
}

export function selectAllColumn(focusColumns: FocusColumn[]) {
  focusColumns.forEach((focusColumn) => (focusColumn.select = true));
}

export function currentFocusShowList(
  show: Show,
  setting: Setting
): FocusType[] {
  const focusTypes: FocusType[] = [];
  setting.columnOrder.forEach((columnType) => {
    if (columnType === "columnName") {
      focusTypes.push(columnType);
    } else if (show[columnType]) {
      focusTypes.push(columnType);
    }
  });
  return focusTypes;
}
