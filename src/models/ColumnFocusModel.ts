import { Column, ColumnOption, ColumnUI } from "@/store/table";
import { FocusType } from "./TableFocusModel";
import StoreManagement from "@/store/StoreManagement";

export interface ColumnFocus extends Column {
  selected: boolean;
  focusName: boolean;
  focusDataType: boolean;
  focusNotNull: boolean;
  focusDefault: boolean;
  focusComment: boolean;

  currentFocus(): FocusType;
  nextFocus(): FocusType;
  preFocus(): FocusType;
}

export default class ColumnFocusModel implements ColumnFocus {
  public selected: boolean = false;
  public focusName: boolean = false;
  public focusDataType: boolean = false;
  public focusNotNull: boolean = false;
  public focusDefault: boolean = false;
  public focusComment: boolean = false;
  private column: Column;
  private store: StoreManagement;

  constructor(store: StoreManagement, column: Column, columnFocus?: any) {
    this.store = store;
    this.column = column;
    if (columnFocus) {
      this.selected = columnFocus.selected;
      this.focusName = columnFocus.focusName;
      this.focusDataType = columnFocus.focusDataType;
      this.focusNotNull = columnFocus.focusNotNull;
      this.focusDefault = columnFocus.focusDefault;
      this.focusComment = columnFocus.focusComment;
    }
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

  public currentFocus(): FocusType {
    let focusType = FocusType.columnName;
    if (this.focusName) {
      focusType = FocusType.columnName;
    } else if (this.focusComment) {
      focusType = FocusType.columnComment;
    } else if (this.focusDataType) {
      focusType = FocusType.columnDataType;
    } else if (this.focusNotNull) {
      focusType = FocusType.columnNotNull;
    } else if (this.focusDefault) {
      focusType = FocusType.columnDefault;
    }
    return focusType;
  }

  public nextFocus(): FocusType {
    const focusTypes = this.currentShowFocus();
    const focusType = this.currentFocus();
    let index = focusTypes.indexOf(focusType);
    if (index === focusTypes.length - 1) {
      index = -1;
    }
    return focusTypes[index + 1];
  }

  public preFocus(): FocusType {
    const focusTypes = this.currentShowFocus();
    const focusType = this.currentFocus();
    let index = focusTypes.indexOf(focusType);
    if (index === 0) {
      index = focusTypes.length;
    }
    return focusTypes[index - 1];
  }

  private currentShowFocus(): FocusType[] {
    const focusTypes: FocusType[] = [FocusType.columnName];
    if (this.store.canvasStore.state.show.columnDataType) {
      focusTypes.push(FocusType.columnDataType);
    }
    if (this.store.canvasStore.state.show.columnNotNull) {
      focusTypes.push(FocusType.columnNotNull);
    }
    if (this.store.canvasStore.state.show.columnDefault) {
      focusTypes.push(FocusType.columnDefault);
    }
    if (this.store.canvasStore.state.show.columnComment) {
      focusTypes.push(FocusType.columnComment);
    }
    return focusTypes;
  }
}
