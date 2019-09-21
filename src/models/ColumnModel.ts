import {SIZE_MIN_WIDTH} from '@/ts/layout';
import {Column, ColumnOption, ColumnUI} from '@/store/table';
import {uuid} from '@/ts/util';
import StoreManagement from '@/store/StoreManagement';

export default class ColumnModel implements Column {
  public id: string;
  public name: string = '';
  public comment: string = '';
  public dataType: string = '';
  public default: string = '';
  public option: ColumnOption;
  public ui: ColumnUI;
  private store: StoreManagement;

  constructor(store: StoreManagement, column?: Column) {
    this.store = store;
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

}
