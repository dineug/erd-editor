import { Show } from "../store/Canvas";
import { Column } from "../store/Table";
import { FocusType } from "./TableFocusModel";

export interface ColumnFocus {
  readonly id: string;
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

export class ColumnFocusModel implements ColumnFocus {
  selected = false;
  focusName = false;
  focusDataType = false;
  focusNotNull = false;
  focusDefault = false;
  focusComment = false;
  private column: Column;
  private show: Show;

  get id() {
    return this.column.id;
  }

  constructor(column: Column, show: Show) {
    this.column = column;
    this.show = show;
  }

  currentFocus(): FocusType {
    throw new Error("Method not implemented.");
  }
  nextFocus(): FocusType {
    throw new Error("Method not implemented.");
  }
  preFocus(): FocusType {
    throw new Error("Method not implemented.");
  }
}
