import { Show } from "../store/Canvas";
import { Table, Column, ColumnWidth } from "../store/Table";
import { ColumnFocus, ColumnFocusModel } from "./ColumnFocusModel";

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

  focus(focusType: FocusType, column?: Column): void;
  selected(event?: MouseEvent): void;
  move(event: KeyboardEvent): void;
  columnSelectAll(): Column[];
  primaryKey(): void;
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

  focus(focusType: FocusType, column?: Column) {
    throw new Error("Method not implemented.");
  }
  selected(event?: MouseEvent) {
    throw new Error("Method not implemented.");
  }
  move(event: KeyboardEvent) {
    throw new Error("Method not implemented.");
  }
  columnSelectAll(): Column[] {
    throw new Error("Method not implemented.");
  }
  primaryKey() {
    throw new Error("Method not implemented.");
  }
}
