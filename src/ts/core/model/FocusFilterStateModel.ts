import { FilterState } from "../store/Editor";
import { FocusType } from "./FocusFilterModel";
import { focusFilterStateEnd } from "../helper/FocusFilterHelper";

export type FocusFilterStateKey =
  | "focusColumnType"
  | "focusFilterCode"
  | "focusValue";
export const focusFilterStateKeyFocusTypeKeyMap: {
  [key: string]: FocusType;
} = {
  focusColumnType: "columnType",
  focusFilterCode: "filterCode",
  focusValue: "value",
};
export const focusTypeKeyFocusFilterStateKeyMap: {
  [key: string]: FocusFilterStateKey;
} = {
  columnType: "focusColumnType",
  filterCode: "focusFilterCode",
  value: "focusValue",
};
export const focusTypes: FocusType[] = ["columnType", "filterCode", "value"];

export interface FocusFilterState {
  readonly id: string;
  readonly currentFocus: FocusType | null;
  select: boolean;
  focusColumnType: boolean;
  focusFilterCode: boolean;
  focusValue: boolean;

  focus(focusType: FocusType): void;
  nextFocus(): void;
  preFocus(): void;
  isLastFocus(): boolean;
  isFirstFocus(): boolean;
}

export class FocusFilterStateModel implements FocusFilterState {
  select = false;
  focusColumnType = false;
  focusFilterCode = false;
  focusValue = false;

  private _filterState: FilterState;

  get id() {
    return this._filterState.id;
  }

  get currentFocus(): FocusType | null {
    let focusType: FocusType | null = null;
    Object.keys(focusFilterStateKeyFocusTypeKeyMap).forEach((key) => {
      const k = key as FocusFilterStateKey;
      if (this[k]) {
        focusType = focusFilterStateKeyFocusTypeKeyMap[k];
      }
    });
    return focusType;
  }

  constructor(filterState: FilterState) {
    this._filterState = filterState;
  }

  focus(focusType: FocusType) {
    const focusFilterStateKey = focusTypeKeyFocusFilterStateKeyMap[focusType];
    this[focusFilterStateKey] = true;
  }

  nextFocus() {
    const focusType = this.currentFocus;
    if (focusType) {
      let index = focusTypes.indexOf(focusType);
      if (index === focusTypes.length - 1) {
        index = -1;
      }
      const nextFocusType = focusTypes[index + 1];
      const focusFilterStateKey =
        focusTypeKeyFocusFilterStateKeyMap[nextFocusType];
      focusFilterStateEnd([this]);
      this[focusFilterStateKey] = true;
    }
  }

  preFocus() {
    const focusType = this.currentFocus;
    if (focusType) {
      let index = focusTypes.indexOf(focusType);
      if (index === 0) {
        index = focusTypes.length;
      }
      const preFocusType = focusTypes[index - 1];
      const focusFilterStateKey =
        focusTypeKeyFocusFilterStateKeyMap[preFocusType];
      focusFilterStateEnd([this]);
      this[focusFilterStateKey] = true;
    }
  }

  isLastFocus(): boolean {
    const focusType = this.currentFocus;
    if (focusType) {
      const index = focusTypes.indexOf(focusType);
      return index === focusTypes.length - 1;
    }
    return false;
  }

  isFirstFocus(): boolean {
    const focusType = this.currentFocus;
    if (focusType) {
      const index = focusTypes.indexOf(focusType);
      return index === 0;
    }
    return false;
  }
}
