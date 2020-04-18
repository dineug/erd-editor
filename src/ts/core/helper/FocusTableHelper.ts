import { FocusTable } from "../model/FocusTableModel";
import {
  FocusColumn,
  FocusColumnKey,
  focusColumnKeyFocusTypeKeyMap,
} from "../model/FocusColumnModel";

export function focusEndTable(focusTable: FocusTable) {
  focusTable.focusName = false;
  focusTable.focusComment = false;
}

export function focusEndColumn(focusColumns: FocusColumn[]) {
  focusColumns.forEach(focusColumn => {
    Object.keys(focusColumnKeyFocusTypeKeyMap).forEach(key => {
      const k = key as FocusColumnKey;
      focusColumn[k] = false;
    });
  });
}

export function focusEnd(focusTable: FocusTable) {
  focusEndTable(focusTable);
  focusEndColumn(focusTable.focusColumns);
}

export function selectEndColumn(focusColumns: FocusColumn[]) {
  focusColumns.forEach(focusColumn => (focusColumn.select = false));
}

export function selectAllColumn(focusColumns: FocusColumn[]) {
  focusColumns.forEach(focusColumn => (focusColumn.select = true));
}
