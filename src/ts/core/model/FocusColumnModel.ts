import { Show, Setting } from "../store/Canvas";
import { Column } from "../store/Table";
import { FocusType } from "./FocusTableModel";
import {
  focusColumnEnd,
  currentFocusShowList,
} from "../helper/FocusTableHelper";

export type FocusColumnKey =
  | "focusUnique"
  | "focusAutoIncrement"
  | "focusName"
  | "focusDataType"
  | "focusNotNull"
  | "focusDefault"
  | "focusComment";
export const focusColumnKeyFocusTypeKeyMap: { [key: string]: FocusType } = {
  focusUnique: "columnUnique",
  focusAutoIncrement: "columnAutoIncrement",
  focusName: "columnName",
  focusDataType: "columnDataType",
  focusNotNull: "columnNotNull",
  focusDefault: "columnDefault",
  focusComment: "columnComment",
};
export const focusTypeKeyFocusColumnKeyMap: {
  [key: string]: FocusColumnKey;
} = {
  columnUnique: "focusUnique",
  columnAutoIncrement: "focusAutoIncrement",
  columnName: "focusName",
  columnDataType: "focusDataType",
  columnNotNull: "focusNotNull",
  columnDefault: "focusDefault",
  columnComment: "focusComment",
};

export interface FocusColumn {
  readonly id: string;
  readonly currentFocus: FocusType | null;
  select: boolean;
  focusUnique: boolean;
  focusAutoIncrement: boolean;
  focusName: boolean;
  focusDataType: boolean;
  focusNotNull: boolean;
  focusDefault: boolean;
  focusComment: boolean;

  focus(focusType: FocusType): void;
  nextFocus(): void;
  preFocus(): void;
  isLastFocus(): boolean;
  isFirstFocus(): boolean;
}

export class FocusColumnModel implements FocusColumn {
  select = false;
  focusUnique = false;
  focusAutoIncrement = false;
  focusName = false;
  focusDataType = false;
  focusNotNull = false;
  focusDefault = false;
  focusComment = false;

  private _column: Column;
  private _show: Show;
  private _setting: Setting;

  get id() {
    return this._column.id;
  }

  get currentFocus(): FocusType | null {
    let focusType: FocusType | null = null;
    Object.keys(focusColumnKeyFocusTypeKeyMap).forEach((key) => {
      const k = key as FocusColumnKey;
      if (this[k]) {
        focusType = focusColumnKeyFocusTypeKeyMap[k];
      }
    });
    return focusType;
  }

  private get currentFocusShowList(): FocusType[] {
    return currentFocusShowList(this._show, this._setting);
  }

  constructor(column: Column, show: Show, setting: Setting) {
    this._column = column;
    this._show = show;
    this._setting = setting;
  }

  focus(focusType: FocusType) {
    const focusColumnKey = focusTypeKeyFocusColumnKeyMap[focusType];
    this[focusColumnKey] = true;
  }

  nextFocus() {
    const focusType = this.currentFocus;
    if (focusType) {
      const focusTypes = this.currentFocusShowList;
      let index = focusTypes.indexOf(focusType);
      if (index === focusTypes.length - 1) {
        index = -1;
      }
      const nextFocusType = focusTypes[index + 1];
      const focusColumnKey = focusTypeKeyFocusColumnKeyMap[nextFocusType];
      focusColumnEnd([this]);
      this[focusColumnKey] = true;
    }
  }

  preFocus() {
    const focusType = this.currentFocus;
    if (focusType) {
      const focusTypes = this.currentFocusShowList;
      let index = focusTypes.indexOf(focusType);
      if (index === 0) {
        index = focusTypes.length;
      }
      const preFocusType = focusTypes[index - 1];
      const focusColumnKey = focusTypeKeyFocusColumnKeyMap[preFocusType];
      focusColumnEnd([this]);
      this[focusColumnKey] = true;
    }
  }

  isLastFocus(): boolean {
    const focusType = this.currentFocus;
    if (focusType) {
      const focusTypes = this.currentFocusShowList;
      const index = focusTypes.indexOf(focusType);
      return index === focusTypes.length - 1;
    }
    return false;
  }

  isFirstFocus(): boolean {
    const focusType = this.currentFocus;
    if (focusType) {
      const focusTypes = this.currentFocusShowList;
      const index = focusTypes.indexOf(focusType);
      return index === 0;
    }
    return false;
  }
}
