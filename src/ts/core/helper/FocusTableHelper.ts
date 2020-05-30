import { FocusTable, FocusType } from "../model/FocusTableModel";
import {
  FocusColumn,
  FocusColumnKey,
  focusColumnKeyFocusTypeKeyMap,
} from "../model/FocusColumnModel";
import { Show, Setting } from "../store/Canvas";

export function focusEndTable(focusTable: FocusTable) {
  focusTable.focusName = false;
  focusTable.focusComment = false;
}

export function focusEndColumn(focusColumns: FocusColumn[]) {
  focusColumns.forEach((focusColumn) => {
    Object.keys(focusColumnKeyFocusTypeKeyMap).forEach((key) => {
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
    switch (columnType) {
      case "columnName":
        focusTypes.push(columnType);
        break;
      case "columnDataType":
        if (show.columnDataType) {
          focusTypes.push(columnType);
        }
        break;
      case "columnNotNull":
        if (show.columnNotNull) {
          focusTypes.push(columnType);
        }
        break;
      case "columnDefault":
        if (show.columnDefault) {
          focusTypes.push(columnType);
        }
        break;
      case "columnComment":
        if (show.columnComment) {
          focusTypes.push(columnType);
        }
        break;
    }
  });
  return focusTypes;
}
