import {
  SIZE_MIN_WIDTH,
  SIZE_MARGIN_RIGHT,
  SIZE_TABLE_HEIGHT,
  SIZE_COLUMN_HEIGHT,
  SIZE_COLUMN_OPTION_NN,
  SIZE_COLUMN_CLOSE,
  SIZE_COLUMN_KEY
} from "../Layout";
import { Table, TableUI, Column, ColumnWidth } from "../store/Table";
import { TableAdd } from "../Command/table";

export class TableModel implements Table {
  id: string;
  name: string;
  comment: string;
  columns: Column[];
  ui: TableUI;

  constructor(table: TableAdd) {
    const { id, name, comment, columns, ui } = table;
    this.id = id;
    this.name = name;
    this.comment = comment;
    this.columns = columns;
    this.ui = ui;
  }

  width(): number {
    // throw new Error("Method not implemented.");
    return 100;
  }
  height(): number {
    // throw new Error("Method not implemented.");
    return 100;
  }
  maxWidthColumn(): ColumnWidth {
    throw new Error("Method not implemented.");
  }
}
