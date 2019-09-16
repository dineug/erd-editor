import {SIZE_MIN_WIDTH, SIZE_MARGIN_RIGHT, SIZE_TABLE_HEIGHT, SIZE_COLUMN_HEIGHT} from '@/ts/layout';
import tableStore, {Table, Column, TableUI} from '@/store/table';
import {uuid} from '@/ts/util';
import {zIndexNext} from '@/store/table/tableHandler';
import canvasStore from '@/store/canvas';

export default class TableModel implements Table {
  public readonly id: string;
  public name: string = '';
  public comment: string = '';
  public columns: Column[] = [];
  public ui: TableUI;

  constructor() {
    this.id = uuid();
    this.ui = {
      active: true,
      top: 100 - canvasStore.state.y,
      left: 200 - canvasStore.state.x,
      widthName: SIZE_MIN_WIDTH,
      widthComment: SIZE_MIN_WIDTH,
      zIndex: zIndexNext(tableStore.state.tables),
    };
  }

  public width(): number {
    let width = this.ui.widthName + SIZE_MARGIN_RIGHT;
    if (canvasStore.state.show.tableComment) {
      width += this.ui.widthComment + SIZE_MARGIN_RIGHT;
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
}
