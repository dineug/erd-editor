import {
  SIZE_TABLE_HEIGHT,
  SIZE_COLUMN_HEIGHT,
  SIZE_MARGIN_RIGHT,
  SIZE_COLUMN_CLOSE,
  SIZE_COLUMN_KEY,
} from "../Layout";
import { Table, TableUI, Column, ColumnWidth } from "../store/Table";
import { Show } from "../store/Canvas";
import { AddTable } from "../command/table";
import {
  getMaxWidthColumn,
  getDefaultWidthColumn,
} from "../helper/TableHelper";

interface TableData {
  addTable?: AddTable;
}

export class TableModel implements Table {
  id: string;
  name = "";
  comment = "";
  columns: Column[] = [];
  ui: TableUI;
  show: Show;

  constructor(data: TableData, show: Show) {
    const { addTable } = data;
    this.show = show;
    if (addTable) {
      const { id, ui } = addTable;
      this.id = id;
      this.ui = Object.assign({}, ui);
    } else {
      throw new Error("not found table");
    }
  }

  width(): number {
    // table header width
    let width = this.ui.widthName + SIZE_MARGIN_RIGHT;
    if (this.show.tableComment) {
      width += this.ui.widthComment + SIZE_MARGIN_RIGHT;
    }
    // default width column
    const defaultWidthColumn =
      getDefaultWidthColumn(this.show) +
      SIZE_COLUMN_CLOSE +
      SIZE_COLUMN_KEY +
      SIZE_MARGIN_RIGHT;
    if (width < defaultWidthColumn) {
      width = defaultWidthColumn;
    }
    // max width column
    const maxWidthColumn =
      this.maxWidthColumn().width +
      SIZE_COLUMN_CLOSE +
      SIZE_COLUMN_KEY +
      SIZE_MARGIN_RIGHT;
    if (width < maxWidthColumn) {
      width = maxWidthColumn;
    }
    return width;
  }

  height(): number {
    return SIZE_TABLE_HEIGHT + this.columns.length * SIZE_COLUMN_HEIGHT;
  }

  maxWidthColumn(): ColumnWidth {
    return getMaxWidthColumn(this.columns, this.show);
  }
}
