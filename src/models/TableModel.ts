import {SIZE_MIN_WIDTH} from '@/ts/layout';
import {Table, Column, TableUI} from '@/store/table';
import {uuid} from '@/ts/util';
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
      active: false,
      top: 100 - canvasStore.state.y,
      left: 200 - canvasStore.state.x,
      widthName: SIZE_MIN_WIDTH,
      widthComment: SIZE_MIN_WIDTH,
      height: 50,
      zIndex: 1,
    };
  }

  public width(): number {
    let width = this.ui.widthName;
    if (canvasStore.state.show.tableComment) {
      width += this.ui.widthComment;
    }
    return width;
  }
}
