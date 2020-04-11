import { Show } from "../store/Canvas";
import { Table, Column, ColumnWidth } from "../store/Table";
import { ColumnFocus, ColumnFocusModel } from "./ColumnFocusModel";
import { TableFocusMove } from "../command/editor";

export type FocusType =
  | "tableName"
  | "tableComment"
  | "columnName"
  | "columnDataType"
  | "columnNotNull"
  | "columnDefault"
  | "columnComment";

export interface TableFocus {
  readonly id: string;
  focusName: boolean;
  focusComment: boolean;
  focusColumns: ColumnFocus[];

  move(tableFocusMove: TableFocusMove): void;
}

export class TableFocusModel implements TableFocus {
  focusName = true;
  focusComment = false;
  focusColumns: ColumnFocus[] = [];
  private table: Table;
  private show: Show;

  get id() {
    return this.table.id;
  }

  constructor(table: Table, show: Show) {
    this.table = table;
    this.show = show;
    this.table.columns.forEach(column => {
      this.focusColumns.push(new ColumnFocusModel(column, show));
    });
  }

  move(tableFocusMove: TableFocusMove) {
    switch (tableFocusMove.moveKey) {
      case "ArrowUp":
        if (this.focusColumns.length !== 0) {
        }
        break;
      case "ArrowDown":
        if (this.focusColumns.length !== 0) {
        }
        break;
      case "ArrowLeft":
        if (this.isFocusTable) {
          if (this.show.tableComment) {
            this.focusName = !this.focusName;
            this.focusComment = !this.focusComment;
          }
        }
        break;
      case "ArrowRight":
        if (this.isFocusTable) {
          if (this.show.tableComment) {
            this.focusName = !this.focusName;
            this.focusComment = !this.focusComment;
          }
        }
        break;
    }
  }

  private get isFocusTable(): boolean {
    return this.focusName || this.focusComment;
  }
}
