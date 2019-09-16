import {Column, ColumnOption, ColumnUI, ColumnFocus} from '@/store/table';

export default class ColumnFocusModel implements ColumnFocus {
  public focusName: boolean = false;
  public focusComment: boolean = false;
  public focusDataType: boolean = false;
  public focusDefault: boolean = false;
  public focusAutoIncrement: boolean = false;
  public focusPrimaryKey: boolean = false;
  public focusUnique: boolean = false;
  public focusNotNull: boolean = false;
  private column: Column;

  constructor(column: Column) {
    this.column = column;
  }

  get id(): string {
    return this.column.id;
  }
  get name(): string {
    return this.column.name;
  }
  get comment(): string {
    return this.column.comment;
  }
  get dataType(): string {
    return this.column.dataType;
  }
  get default(): string {
    return this.column.default;
  }
  get option(): ColumnOption {
    return this.column.option;
  }
  get ui(): ColumnUI {
    return this.column.ui;
  }
  public width(): number {
    return this.column.width();
  }

}
