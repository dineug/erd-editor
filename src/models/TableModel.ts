import {
  SIZE_MIN_WIDTH,
  SIZE_MARGIN_RIGHT,
  SIZE_TABLE_HEIGHT,
  SIZE_COLUMN_HEIGHT,
  SIZE_COLUMN_OPTION_NN,
} from '@/ts/layout';
import tableStore, {Table, Column, TableUI} from '@/store/table';
import memoStore from '@/store/memo';
import canvasStore from '@/store/canvas';
import {uuid} from '@/ts/util';
import {zIndexNext, pointNext} from '@/store/table/tableHandler';

export default class TableModel implements Table {
  public readonly id: string;
  public name: string = '';
  public comment: string = '';
  public columns: Column[] = [];
  public ui: TableUI;

  constructor() {
    this.id = uuid();
    const point = pointNext(tableStore.state.tables, memoStore.state.memos);
    this.ui = {
      active: true,
      top: point.top,
      left: point.left,
      widthName: SIZE_MIN_WIDTH,
      widthComment: SIZE_MIN_WIDTH,
      zIndex: zIndexNext(tableStore.state.tables, memoStore.state.memos),
    };
  }

  public width(): number {
    let width = this.ui.widthName + SIZE_MARGIN_RIGHT;
    if (canvasStore.state.show.tableComment) {
      width += this.ui.widthComment + SIZE_MARGIN_RIGHT;
    }
    const defaultColumnWidth = this.defaultColumnWidth();
    if (width < defaultColumnWidth) {
      width = defaultColumnWidth;
    }
    this.columns.forEach((column) => {
      const columnWidth = column.width();
      if (columnWidth > width) {
        width = columnWidth;
      }
    });
    return width;
  }

  public height(): number {
    return SIZE_TABLE_HEIGHT + (this.columns.length * SIZE_COLUMN_HEIGHT);
  }

  private defaultColumnWidth(): number {
    let width = SIZE_MIN_WIDTH + SIZE_MARGIN_RIGHT;
    if (canvasStore.state.show.columnComment) {
      width += SIZE_MIN_WIDTH + SIZE_MARGIN_RIGHT;
    }
    if (canvasStore.state.show.columnDataType) {
      width += SIZE_MIN_WIDTH + SIZE_MARGIN_RIGHT;
    }
    if (canvasStore.state.show.columnDefault) {
      width += SIZE_MIN_WIDTH + SIZE_MARGIN_RIGHT;
    }
    if (canvasStore.state.show.columnNotNull) {
      width += SIZE_COLUMN_OPTION_NN + SIZE_MARGIN_RIGHT;
    }
    return width;
  }

}
