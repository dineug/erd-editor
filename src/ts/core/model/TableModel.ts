import {
  SIZE_TABLE_HEADER_HEIGHT,
  SIZE_COLUMN_HEIGHT,
  SIZE_COLUMN_MARGIN_RIGHT,
  SIZE_COLUMN_CLOSE,
  SIZE_COLUMN_KEY,
  SIZE_MIN_WIDTH,
  SIZE_START_X,
  SIZE_START_Y,
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
  ui: TableUI = {
    active: false,
    left: SIZE_START_X,
    top: SIZE_START_Y,
    zIndex: 2,
    widthName: SIZE_MIN_WIDTH,
    widthComment: SIZE_MIN_WIDTH,
  };

  private _show: Show;

  constructor(data: TableData, show: Show) {
    const { addTable } = data;
    this._show = show;
    if (addTable) {
      const { id, ui } = addTable;
      this.id = id;
      this.ui = Object.assign(this.ui, ui);
    } else {
      throw new Error("not found table");
    }
  }

  width(): number {
    // table header width
    let width = this.ui.widthName + SIZE_COLUMN_MARGIN_RIGHT;
    if (this._show.tableComment) {
      width += this.ui.widthComment + SIZE_COLUMN_MARGIN_RIGHT;
    }
    // default width column
    const defaultWidthColumn =
      getDefaultWidthColumn(this._show) +
      SIZE_COLUMN_CLOSE +
      SIZE_COLUMN_KEY +
      SIZE_COLUMN_MARGIN_RIGHT;
    if (width < defaultWidthColumn) {
      width = defaultWidthColumn;
    }
    // max width column
    const maxWidthColumn =
      this.maxWidthColumn().width +
      SIZE_COLUMN_CLOSE +
      SIZE_COLUMN_KEY +
      SIZE_COLUMN_MARGIN_RIGHT;
    if (width < maxWidthColumn) {
      width = maxWidthColumn;
    }
    return width;
  }

  height(): number {
    return SIZE_TABLE_HEADER_HEIGHT + this.columns.length * SIZE_COLUMN_HEIGHT;
  }

  maxWidthColumn(): ColumnWidth {
    return getMaxWidthColumn(this.columns, this._show);
  }
}
