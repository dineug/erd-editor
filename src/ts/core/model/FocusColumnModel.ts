import { Show } from "../store/Canvas";
import { Column } from "../store/Table";
import { FocusType } from "./FocusTableModel";

export interface FocusColumn {
  readonly id: string;
  readonly currentFocus: FocusType;
  readonly nextFocus: FocusType;
  readonly preFocus: FocusType;
  selected: boolean;
  focusName: boolean;
  focusDataType: boolean;
  focusNotNull: boolean;
  focusDefault: boolean;
  focusComment: boolean;
}

export class FocusColumnModel implements FocusColumn {
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
  get currentFocus(): FocusType {
    throw new Error("Method not implemented.");
  }
  get nextFocus(): FocusType {
    throw new Error("Method not implemented.");
  }
  get preFocus(): FocusType {
    throw new Error("Method not implemented.");
  }

  constructor(column: Column, show: Show) {
    this.column = column;
    this.show = show;
  }
}
