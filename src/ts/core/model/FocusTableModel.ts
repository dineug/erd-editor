import { Show } from "../store/Canvas";
import { Table, Column, ColumnWidth } from "../store/Table";
import { FocusColumn, FocusColumnModel } from "./FocusColumnModel";
import { FocusMoveTable } from "../command/editor";

export type FocusType =
  | "tableName"
  | "tableComment"
  | "columnName"
  | "columnDataType"
  | "columnNotNull"
  | "columnDefault"
  | "columnComment";

export interface FocusTable {
  readonly id: string;
  readonly currentFocus: FocusType;
  readonly currentFocusId: string;
  focusName: boolean;
  focusComment: boolean;
  focusColumns: FocusColumn[];

  move(focusMoveTable: FocusMoveTable): void;
}

export class FocusTableModel implements FocusTable {
  focusName = true;
  focusComment = false;
  focusColumns: FocusColumn[] = [];
  private table: Table;
  private show: Show;

  get id() {
    return this.table.id;
  }

  get currentFocus(): FocusType {
    throw new Error("Method not implemented.");
  }
  get currentFocusId(): string {
    throw new Error("Method not implemented.");
  }

  private get isFocusTable(): boolean {
    return this.focusName || this.focusComment;
  }

  constructor(table: Table, show: Show) {
    this.table = table;
    this.show = show;
    this.table.columns.forEach(column => {
      this.focusColumns.push(new FocusColumnModel(column, show));
    });
  }

  move(focusMoveTable: FocusMoveTable) {
    switch (focusMoveTable.moveKey) {
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
}
