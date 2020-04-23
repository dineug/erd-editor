import { Show, ShowKey } from "../store/Canvas";
import { Column } from "../store/Table";
import { FocusType } from "./FocusTableModel";
import { focusEndColumn } from "../helper/FocusTableHelper";

const showKeys: ShowKey[] = [
  "columnDataType",
  "columnNotNull",
  "columnDefault",
  "columnComment",
];
export type FocusColumnKey =
  | "focusName"
  | "focusDataType"
  | "focusNotNull"
  | "focusDefault"
  | "focusComment";
export const focusColumnKeyFocusTypeKeyMap: { [key: string]: FocusType } = {
  focusName: "columnName",
  focusDataType: "columnDataType",
  focusNotNull: "columnNotNull",
  focusDefault: "columnDefault",
  focusComment: "columnComment",
};
export const focusTypeKeyFocusColumnKeyMap: {
  [key: string]: FocusColumnKey;
} = {
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
  focusName: boolean;
  focusDataType: boolean;
  focusNotNull: boolean;
  focusDefault: boolean;
  focusComment: boolean;

  focus(focusType: FocusType): void;
  nextFocus(): void;
  preFocus(): void;
}

export class FocusColumnModel implements FocusColumn {
  select = false;
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
    const focusTypes: FocusType[] = ["columnName"];
    showKeys.forEach((showKey) => {
      if (this.show[showKey]) {
        focusTypes.push(showKey as FocusType);
      }
    });
    return focusTypes;
  }

  constructor(column: Column, show: Show) {
    this.column = column;
    this.show = show;
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
      focusEndColumn([this]);
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
      focusEndColumn([this]);
      this[focusColumnKey] = true;
    }
  }
}
