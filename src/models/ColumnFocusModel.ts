import {Column, ColumnOption, ColumnUI} from '@/store/table';
import {FocusType} from './TableFocusModel';
import canvasStore from '@/store/canvas';

export interface ColumnFocus extends Column {
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
  public focusName: boolean = false;
  public focusDataType: boolean = false;
  public focusNotNull: boolean = false;
  public focusDefault: boolean = false;
  public focusComment: boolean = false;
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
    if (canvasStore.state.show.columnDataType) {
      focusTypes.push(FocusType.columnDataType);
    }
    if (canvasStore.state.show.columnNotNull) {
      focusTypes.push(FocusType.columnNotNull);
    }
    if (canvasStore.state.show.columnDefault) {
      focusTypes.push(FocusType.columnDefault);
    }
    if (canvasStore.state.show.columnComment) {
      focusTypes.push(FocusType.columnComment);
    }
    return focusTypes;
  }

}
