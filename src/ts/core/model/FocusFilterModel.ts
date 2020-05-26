import { Subscription } from "rxjs";
import { Store } from "../Store";
import { FilterState } from "../store/Editor";
import {
  FocusFilterState,
  FocusFilterStateModel,
} from "./FocusFilterStateModel";
import {
  FocusMoveFilter,
  FocusTargetFilter,
  FocusTargetFilterState,
} from "../command/editor";
import {
  selectAllFilterState,
  selectEndFilterState,
  focusEndFilterState,
  focusEnd,
} from "../helper/FocusFilterHelper";
import { Logger } from "../Logger";
import { getData, getIndex, range } from "../Helper";

export type FocusType =
  | "filterOperatorType"
  | "columnType"
  | "filterCode"
  | "value";

interface FocusData {
  focusTargetFilter?: FocusTargetFilter;
  focusTargetFilterState?: FocusTargetFilterState;
}

export interface FocusFilter {
  readonly currentFocus: FocusType;
  readonly currentFocusId: string | null;
  readonly selectFilterStateList: FilterState[];
  focusFilterOperatorType: boolean;
  focusFilterStateList: FocusFilterState[];

  move(focusMoveFilter: FocusMoveFilter): void;
  focus(focusData: FocusData): void;
  selectAll(): void;
  selectEnd(): void;
  destroy(): void;
}

export class FocusFilterModel implements FocusFilter {
  focusFilterOperatorType = true;
  focusFilterStateList: FocusFilterState[] = [];

  private _observeCall = true;
  private _currentFocusFilterState: FocusFilterState | null = null;
  private _subscriptionList: Subscription[] = [];
  private _filterStateList: FilterState[];

  constructor(filterStateList: FilterState[], store: Store) {
    this._filterStateList = filterStateList;
    filterStateList.forEach((filterState) => {
      this.focusFilterStateList.push(new FocusFilterStateModel(filterState));
    });
    this._subscriptionList.push(
      store.observe(filterStateList, () => this.createFocusFilterStateList())
    );
  }

  get currentFocus(): FocusType {
    if (this._currentFocusFilterState?.currentFocus) {
      return this._currentFocusFilterState.currentFocus;
    }
    return "filterOperatorType";
  }

  get currentFocusId(): string | null {
    if (this._currentFocusFilterState?.currentFocus) {
      return this._currentFocusFilterState.id;
    }
    return null;
  }

  get selectFilterStateList(): FilterState[] {
    return this.focusFilterStateList
      .filter((focusFilterState) => focusFilterState.select)
      .map((focusFilterState) =>
        getData(this._filterStateList, focusFilterState.id)
      )
      .filter((filterState) => filterState !== null) as FilterState[];
  }

  move(focusMoveFilter: FocusMoveFilter) {
    if (!focusMoveFilter.shiftKey) {
      selectEndFilterState(this.focusFilterStateList);
    }
    switch (focusMoveFilter.moveKey) {
      case "ArrowUp":
        if (this.focusFilterStateList.length !== 0) {
          if (this._currentFocusFilterState === null) {
            // move 1 -> N
            focusEnd(this);
            this._currentFocusFilterState = this.focusFilterStateList[
              this.focusFilterStateList.length - 1
            ];
            this._currentFocusFilterState.select = true;
            this._currentFocusFilterState.focusColumnType = true;
          } else {
            const index = getIndex(
              this.focusFilterStateList,
              this._currentFocusFilterState.id
            );
            if (index !== null) {
              if (index === 0) {
                // move N -> 1
                focusEndFilterState(this.focusFilterStateList);
                selectEndFilterState(this.focusFilterStateList);
                this._currentFocusFilterState = null;
                this.focusFilterOperatorType = true;
              } else {
                // move N -> N
                const currentFocus = this._currentFocusFilterState.currentFocus;
                if (currentFocus) {
                  focusEnd(this);
                  this._currentFocusFilterState = this.focusFilterStateList[
                    index - 1
                  ];
                  this._currentFocusFilterState.select = true;
                  this._currentFocusFilterState.focus(currentFocus);
                }
              }
            }
          }
        }
        break;
      case "ArrowDown":
        if (this.focusFilterStateList.length !== 0) {
          if (this._currentFocusFilterState === null) {
            // move 1 -> N
            focusEnd(this);
            this._currentFocusFilterState = this.focusFilterStateList[0];
            this._currentFocusFilterState.select = true;
            this._currentFocusFilterState.focusColumnType = true;
          } else {
            const index = getIndex(
              this.focusFilterStateList,
              this._currentFocusFilterState.id
            );
            if (index !== null) {
              if (index === this.focusFilterStateList.length - 1) {
                // move N -> 1
                focusEndFilterState(this.focusFilterStateList);
                selectEndFilterState(this.focusFilterStateList);
                this._currentFocusFilterState = null;
                this.focusFilterOperatorType = true;
              } else {
                // move N -> N
                const currentFocus = this._currentFocusFilterState.currentFocus;
                if (currentFocus) {
                  focusEnd(this);
                  this._currentFocusFilterState = this.focusFilterStateList[
                    index + 1
                  ];
                  this._currentFocusFilterState.select = true;
                  this._currentFocusFilterState.focus(currentFocus);
                }
              }
            }
          }
        }
        break;
      case "ArrowLeft":
        if (this._currentFocusFilterState) {
          // move N -> N
          this._currentFocusFilterState.select = true;
          this._currentFocusFilterState.preFocus();
        }
        break;
      case "ArrowRight":
        if (this._currentFocusFilterState) {
          // move N -> N
          this._currentFocusFilterState.select = true;
          this._currentFocusFilterState.nextFocus();
        }
        break;
    }
    this._observeCall = !this._observeCall;
  }

  focus(focusData: FocusData) {
    const { focusTargetFilter, focusTargetFilterState } = focusData;
    if (focusTargetFilter) {
      focusEndFilterState(this.focusFilterStateList);
      selectEndFilterState(this.focusFilterStateList);
      this._currentFocusFilterState = null;
      this.focusFilterOperatorType = true;
    } else if (focusTargetFilterState) {
      const targetFocusColumn = getData(
        this.focusFilterStateList,
        focusTargetFilterState.filterStateId
      );
      if (targetFocusColumn) {
        focusEnd(this);
        if (focusTargetFilterState.shiftKey && this._currentFocusFilterState) {
          // multiple range select
          const currentIndex = getIndex(
            this.focusFilterStateList,
            this._currentFocusFilterState.id
          );
          const targetIndex = getIndex(
            this.focusFilterStateList,
            targetFocusColumn.id
          );
          if (currentIndex !== null && targetIndex !== null) {
            range(currentIndex, targetIndex).forEach((index) => {
              this.focusFilterStateList[index].select = true;
            });
          }
        } else if (!focusTargetFilterState.ctrlKey) {
          selectEndFilterState(this.focusFilterStateList);
        }
        this._currentFocusFilterState = targetFocusColumn;
        this._currentFocusFilterState.select = true;
        this._currentFocusFilterState.focus(focusTargetFilterState.focusType);
      }
    }
  }

  selectAll() {
    selectAllFilterState(this.focusFilterStateList);
    this._observeCall = !this._observeCall;
  }

  selectEnd() {
    selectEndFilterState(this.focusFilterStateList);
    this._observeCall = !this._observeCall;
  }

  destroy() {
    this._subscriptionList.forEach((sub) => sub.unsubscribe());
  }

  private createFocusFilterStateList() {
    const oldSize = this.focusFilterStateList.length;
    const size = this._filterStateList.length;
    let currentFilterStateIndex: number | null = null;
    let currentFocusType: FocusType = "columnType";
    if (this._currentFocusFilterState?.currentFocus) {
      currentFilterStateIndex = getIndex(
        this.focusFilterStateList,
        this._currentFocusFilterState.id
      );
      currentFocusType = this._currentFocusFilterState.currentFocus;
    }

    this.focusFilterStateList = [];
    this._filterStateList.forEach((filterState) => {
      this.focusFilterStateList.push(new FocusFilterStateModel(filterState));
    });

    // currentFocus reload
    if (this._currentFocusFilterState?.currentFocus) {
      const targetFocusColumn = getData(
        this.focusFilterStateList,
        this._currentFocusFilterState.id
      );
      if (targetFocusColumn) {
        targetFocusColumn.select = true;
        targetFocusColumn.focus(this._currentFocusFilterState.currentFocus);
        this._currentFocusFilterState = targetFocusColumn;
      }
    }

    if (oldSize < size) {
      // add focus
      focusEnd(this);
      selectEndFilterState(this.focusFilterStateList);
      this._currentFocusFilterState = this.focusFilterStateList[
        this.focusFilterStateList.length - 1
      ];
      this._currentFocusFilterState.select = true;
      this._currentFocusFilterState.focus("columnType");
    } else if (oldSize > size && currentFilterStateIndex !== null) {
      // remove focus
      focusEnd(this);
      if (size === 0) {
        this._currentFocusFilterState = null;
        this.focusFilterOperatorType = true;
      } else {
        let targetIndex = this.focusFilterStateList.length - 1;
        if (currentFilterStateIndex === 0) {
          targetIndex = 0;
        } else if (currentFilterStateIndex - 1 < size) {
          targetIndex = currentFilterStateIndex - 1;
        }
        selectEndFilterState(this.focusFilterStateList);
        this._currentFocusFilterState = this.focusFilterStateList[targetIndex];
        this._currentFocusFilterState.select = true;
        this._currentFocusFilterState.focus(currentFocusType);
      }
    }
  }
}
