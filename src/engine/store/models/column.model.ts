import {
  Column,
  ColumnOption,
  ColumnUI,
} from '@@types/engine/store/table.state';
import { AddColumn, AddCustomColumn } from '@@types/engine/command/column.cmd';
import { SIZE_MIN_WIDTH } from '@/core/layout';

interface ColumnData {
  addColumn?: AddColumn;
  addCustomColumn?: AddCustomColumn;
}

export class ColumnModel implements Column {
  id: string;
  name = '';
  comment = '';
  dataType = '';
  default = '';
  option: ColumnOption = {
    autoIncrement: false,
    primaryKey: false,
    unique: false,
    notNull: false,
  };
  ui: ColumnUI = {
    active: false,
    pk: false,
    fk: false,
    pfk: false,
    widthName: SIZE_MIN_WIDTH,
    widthComment: SIZE_MIN_WIDTH,
    widthDataType: SIZE_MIN_WIDTH,
    widthDefault: SIZE_MIN_WIDTH,
  };

  constructor(data: ColumnData) {
    const { addColumn, addCustomColumn } = data;
    if (addColumn) {
      const { id } = addColumn;
      this.id = id;
    } else if (addCustomColumn) {
      const { id, option, ui, value } = addCustomColumn;
      this.id = id;
      if (option) {
        this.option = Object.assign(this.option, option);
      }
      if (ui) {
        this.ui = Object.assign(this.ui, ui);
      }
      if (value) {
        this.name = value.name;
        this.comment = value.comment;
        this.dataType = value.dataType;
        this.default = value.default;
        this.ui.widthName = value.widthName;
        this.ui.widthComment = value.widthComment;
        this.ui.widthDataType = value.widthDataType;
        this.ui.widthDefault = value.widthDefault;
      }
    } else {
      throw new Error('not found column');
    }
  }
}
