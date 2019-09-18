import {SIZE_MIN_WIDTH, SIZE_COLUMN_OPTION_NN, SIZE_MARGIN_RIGHT} from '@/ts/layout';
import {Column, ColumnOption, ColumnUI} from '@/store/table';
import {uuid} from '@/ts/util';
import canvasStore from '@/store/canvas';

export default class ColumnModel implements Column {
  public id: string;
  public name: string = '';
  public comment: string = '';
  public dataType: string = '';
  public default: string = '';
  public option: ColumnOption;
  public ui: ColumnUI;

  constructor(column?: Column) {
    if (column) {
      this.id = column.id;
      this.name = column.name;
      this.comment = column.comment;
      this.dataType = column.dataType;
      this.default = column.default;
      this.option = column.option;
      this.ui = column.ui;
    } else {
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
  }

  public width(): number {
    let width = this.ui.widthName + SIZE_MARGIN_RIGHT;
    if (canvasStore.state.show.columnComment) {
      width += this.ui.widthComment + SIZE_MARGIN_RIGHT;
    }
    if (canvasStore.state.show.columnDataType) {
      width += this.ui.widthDataType + SIZE_MARGIN_RIGHT;
    }
    if (canvasStore.state.show.columnDefault) {
      width += this.ui.widthDefault + SIZE_MARGIN_RIGHT;
    }
    if (canvasStore.state.show.columnNotNull) {
      width += SIZE_COLUMN_OPTION_NN + SIZE_MARGIN_RIGHT;
    }
    return width;
  }

}
