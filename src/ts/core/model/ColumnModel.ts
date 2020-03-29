import { SIZE_MIN_WIDTH } from "../Layout";
import { Column, ColumnOption, ColumnUI } from "../store/Table";
import { AddColumn } from "../Command/column";

export class ColumnModel implements Column {
  id: string;
  name = "";
  comment = "";
  dataType = "";
  default = "";
  option: ColumnOption = {
    autoIncrement: false,
    primaryKey: false,
    unique: false,
    notNull: false
  };
  ui: ColumnUI = {
    active: false,
    pk: false,
    fk: false,
    pfk: false,
    widthName: SIZE_MIN_WIDTH,
    widthComment: SIZE_MIN_WIDTH,
    widthDataType: SIZE_MIN_WIDTH,
    widthDefault: SIZE_MIN_WIDTH
  };

  constructor(data: { addColumn?: AddColumn }) {
    const { addColumn } = data;
    if (addColumn) {
      const { id } = addColumn;
      this.id = id;
    } else {
      throw new Error("not found column");
    }
  }
}
