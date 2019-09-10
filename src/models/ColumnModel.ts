import {SIZE_MIN_WIDTH, SIZE_COLUMN_OPTION, SIZE_COLUMN_OPTION_NN} from '@/ts/layout';
import {Column, ColumnOption, ColumnUI} from '@/store/table';
import {uuid} from '@/ts/util';
import canvasStore from '@/store/canvas';

export default class ColumnModel implements Column {
  public readonly id: string;
  public name: string = '';
  public comment: string = '';
  public dataType: string = '';
  public default: string = '';
  public option: ColumnOption;
  public ui: ColumnUI;

  constructor() {
    this.id = uuid();
    this.option = {
      autoIncrement: false,
      primaryKey: false,
      unique: false,
      notNull: false,
    };
    this.ui = {
      active: false,
      pk: false,
      fk: false,
      pfk: false,
      widthName: SIZE_MIN_WIDTH,
      widthComment: SIZE_MIN_WIDTH,
      widthDataType: SIZE_MIN_WIDTH,
      widthDefault: SIZE_MIN_WIDTH,
    };
  }

  public width(): number {
    let width = this.ui.widthName;
    if (canvasStore.state.show.columnComment) {
      width += this.ui.widthComment;
    }
    if (canvasStore.state.show.columnDataType) {
      width += this.ui.widthDataType;
    }
    if (canvasStore.state.show.columnDefault) {
      width += this.ui.widthDefault;
    }
    if (canvasStore.state.show.columnAutoIncrement) {
      width += SIZE_COLUMN_OPTION;
    }
    if (canvasStore.state.show.columnPrimaryKey) {
      width += SIZE_COLUMN_OPTION;
    }
    if (canvasStore.state.show.columnUnique) {
      width += SIZE_COLUMN_OPTION;
    }
    if (canvasStore.state.show.columnNotNull) {
      width += SIZE_COLUMN_OPTION_NN;
    }
    return width;
  }

}
