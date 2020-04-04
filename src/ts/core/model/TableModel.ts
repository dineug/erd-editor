import {
  SIZE_MIN_WIDTH,
  SIZE_MARGIN_RIGHT,
  SIZE_TABLE_HEIGHT,
  SIZE_COLUMN_HEIGHT,
  SIZE_COLUMN_OPTION_NN,
  SIZE_COLUMN_CLOSE,
  SIZE_COLUMN_KEY,
} from "../Layout";
import { Table, TableUI, Column, ColumnWidth } from "../store/Table";
import { AddTable } from "../command/table";

export class TableModel implements Table {
  id: string;
  name = "";
  comment = "";
  columns: Column[] = [];
  ui: TableUI;

  constructor(data: { addTable?: AddTable }) {
    const { addTable } = data;
    if (addTable) {
      const { id, ui } = addTable;
      this.id = id;
      this.ui = Object.assign({}, ui);
    } else {
      throw new Error("not found table");
    }
  }

  width(): number {
    // throw new Error("Method not implemented.");
    return 100;
  }
  height(): number {
    return SIZE_TABLE_HEIGHT + this.columns.length * SIZE_COLUMN_HEIGHT;
  }
  maxWidthColumn(): ColumnWidth {
    throw new Error("Method not implemented.");
  }
}
