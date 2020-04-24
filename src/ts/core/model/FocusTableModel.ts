import { Subscription } from "rxjs";
import { Store } from "../Store";
import { Table, Column } from "../store/Table";
import { Logger } from "../Logger";
import { FocusColumn, FocusColumnModel } from "./FocusColumnModel";
import {
  FocusMoveTable,
  FocusTargetTable,
  FocusTargetColumn,
} from "../command/editor";
import {
  focusEnd,
  focusEndColumn,
  selectEndColumn,
  selectAllColumn,
} from "../helper/FocusTableHelper";
import { getData, getIndex, range } from "../Helper";

export type FocusType =
  | "tableName"
  | "tableComment"
  | "columnName"
  | "columnDataType"
  | "columnNotNull"
  | "columnDefault"
  | "columnComment";

interface FocusData {
  focusTargetTable?: FocusTargetTable;
  focusTargetColumn?: FocusTargetColumn;
}

export interface FocusTable {
  readonly id: string;
  readonly currentFocus: FocusType;
  readonly currentFocusId: string;
  readonly selectColumns: Column[];
  focusName: boolean;
  focusComment: boolean;
  focusColumns: FocusColumn[];

  move(focusMoveTable: FocusMoveTable): void;
  focus(focusData: FocusData): void;
  selectAll(): void;
  selectEnd(): void;
  destroy(): void;
}

export class FocusTableModel implements FocusTable {
  focusName = true;
  focusComment = false;
  focusColumns: FocusColumn[] = [];
  private _observeCall = true;
  private _table: Table;
  private _store: Store;
  private _currentFocusColumn: FocusColumn | null = null;
  private _subscriptionList: Subscription[] = [];

  get id() {
    return this._table.id;
  }

  get currentFocus(): FocusType {
    if (this._currentFocusColumn?.currentFocus) {
      return this._currentFocusColumn.currentFocus;
    } else if (this.focusComment) {
      return "tableComment";
    }
    return "tableName";
  }

  get currentFocusId(): string {
    if (this._currentFocusColumn === null) {
      return this.id;
    } else {
      return this._currentFocusColumn.id;
    }
  }

  get selectColumns(): Column[] {
    return this.focusColumns
      .filter((focusColumn) => focusColumn.select)
      .map((focusColumn) => getData(this._table.columns, focusColumn.id))
      .filter((column) => column !== null) as Column[];
  }

  constructor(table: Table, store: Store) {
    const { show } = store.canvasState;
    this._table = table;
    this._store = store;
    this._table.columns.forEach((column) => {
      this.focusColumns.push(new FocusColumnModel(column, show));
    });
    this._subscriptionList.push(
      store.observe(this._table.columns, () => this.createFocusColumns())
    );
  }

  move(focusMoveTable: FocusMoveTable) {
    const { show } = this._store.canvasState;
    if (!focusMoveTable.shiftKey) {
      selectEndColumn(this.focusColumns);
    }
    switch (focusMoveTable.moveKey) {
      case "ArrowUp":
        if (this.focusColumns.length !== 0) {
          if (this._currentFocusColumn === null) {
            // move table -> column
            focusEnd(this);
            this._currentFocusColumn = this.focusColumns[
              this.focusColumns.length - 1
            ];
            this._currentFocusColumn.select = true;
            this._currentFocusColumn.focusName = true;
          } else {
            const index = getIndex(
              this.focusColumns,
              this._currentFocusColumn.id
            );
            if (index !== null) {
              if (index === 0) {
                // move column -> table
                focusEnd(this);
                selectEndColumn(this.focusColumns);
                this._currentFocusColumn = null;
                this.focusName = true;
              } else {
                // move column -> column
                const currentFocus = this._currentFocusColumn.currentFocus;
                if (currentFocus) {
                  focusEnd(this);
                  this._currentFocusColumn = this.focusColumns[index - 1];
                  this._currentFocusColumn.select = true;
                  this._currentFocusColumn.focus(currentFocus);
                }
              }
            }
          }
        }
        break;
      case "ArrowDown":
        if (this.focusColumns.length !== 0) {
          if (this._currentFocusColumn === null) {
            // move table -> column
            focusEnd(this);
            this._currentFocusColumn = this.focusColumns[0];
            this._currentFocusColumn.select = true;
            this._currentFocusColumn.focusName = true;
          } else {
            const index = getIndex(
              this.focusColumns,
              this._currentFocusColumn.id
            );
            if (index !== null) {
              if (index === this.focusColumns.length - 1) {
                // move column -> table
                focusEnd(this);
                selectEndColumn(this.focusColumns);
                this._currentFocusColumn = null;
                this.focusName = true;
              } else {
                // move column -> column
                const currentFocus = this._currentFocusColumn.currentFocus;
                if (currentFocus) {
                  focusEnd(this);
                  this._currentFocusColumn = this.focusColumns[index + 1];
                  this._currentFocusColumn.select = true;
                  this._currentFocusColumn.focus(currentFocus);
                }
              }
            }
          }
        }
        break;
      case "ArrowLeft":
        if (this._currentFocusColumn === null && show.tableComment) {
          // move table -> table
          focusEndColumn(this.focusColumns);
          selectEndColumn(this.focusColumns);
          this.focusName = !this.focusName;
          this.focusComment = !this.focusComment;
        } else if (this._currentFocusColumn) {
          // move column -> column
          this._currentFocusColumn.select = true;
          this._currentFocusColumn.preFocus();
        }
        break;
      case "ArrowRight":
        if (this._currentFocusColumn === null && show.tableComment) {
          // move table -> table
          focusEndColumn(this.focusColumns);
          selectEndColumn(this.focusColumns);
          this.focusName = !this.focusName;
          this.focusComment = !this.focusComment;
        } else if (this._currentFocusColumn) {
          // move column -> column
          this._currentFocusColumn.select = true;
          this._currentFocusColumn.nextFocus();
        }
        break;
    }
    this._observeCall = !this._observeCall;
  }

  focus(focusData: FocusData) {
    const { focusTargetTable, focusTargetColumn } = focusData;
    if (focusTargetTable) {
      // focus table
      focusEnd(this);
      selectEndColumn(this.focusColumns);
      this._currentFocusColumn = null;
      if (focusTargetTable.focusType === "tableComment") {
        this.focusComment = true;
      } else {
        this.focusName = true;
      }
    } else if (focusTargetColumn) {
      // focus column
      const targetFocusColumn = getData(
        this.focusColumns,
        focusTargetColumn.columnId
      );
      if (targetFocusColumn) {
        focusEnd(this);
        if (focusTargetColumn.shiftKey && this._currentFocusColumn) {
          // multiple range select
          const currentIndex = getIndex(
            this.focusColumns,
            this._currentFocusColumn.id
          );
          const targetIndex = getIndex(this.focusColumns, targetFocusColumn.id);
          if (currentIndex !== null && targetIndex !== null) {
            range(currentIndex, targetIndex).forEach((index) => {
              this.focusColumns[index].select = true;
            });
          }
        } else if (!focusTargetColumn.ctrlKey) {
          selectEndColumn(this.focusColumns);
        }
        this._currentFocusColumn = targetFocusColumn;
        this._currentFocusColumn.select = true;
        this._currentFocusColumn.focus(focusTargetColumn.focusType);
      }
    }
  }

  selectAll() {
    selectAllColumn(this.focusColumns);
    this._observeCall = !this._observeCall;
  }
  selectEnd() {
    selectEndColumn(this.focusColumns);
    this._observeCall = !this._observeCall;
  }

  destroy() {
    this._subscriptionList.forEach((sub) => sub.unsubscribe());
  }

  private createFocusColumns() {
    Logger.debug("FocusTableModel createFocusColumns");
    const { show } = this._store.canvasState;
    const oldColumnsSize = this.focusColumns.length;
    const columnsSize = this._table.columns.length;
    let currentColumnIndex: number | null = null;
    let currentFocusType: FocusType = "columnName";
    if (this._currentFocusColumn?.currentFocus) {
      currentColumnIndex = getIndex(
        this.focusColumns,
        this._currentFocusColumn.id
      );
      currentFocusType = this._currentFocusColumn.currentFocus;
    }

    this.focusColumns = [];
    this._table.columns.forEach((column) => {
      this.focusColumns.push(new FocusColumnModel(column, show));
    });

    // currentFocusColumn reload
    if (this._currentFocusColumn?.currentFocus) {
      const targetFocusColumn = getData(
        this.focusColumns,
        this._currentFocusColumn.id
      );
      if (targetFocusColumn) {
        targetFocusColumn.select = true;
        targetFocusColumn.focus(this._currentFocusColumn.currentFocus);
        this._currentFocusColumn = targetFocusColumn;
      }
    }

    if (oldColumnsSize < columnsSize) {
      // addColumn focus
      focusEnd(this);
      selectEndColumn(this.focusColumns);
      this._currentFocusColumn = this.focusColumns[
        this.focusColumns.length - 1
      ];
      this._currentFocusColumn.select = true;
      this._currentFocusColumn.focus("columnName");
    } else if (oldColumnsSize > columnsSize && currentColumnIndex !== null) {
      // removeColumn focus
      focusEnd(this);
      if (columnsSize === 0) {
        this._currentFocusColumn = null;
        this.focusName = true;
      } else {
        let targetIndex = this.focusColumns.length - 1;
        if (currentColumnIndex === 0) {
          targetIndex = 0;
        } else if (currentColumnIndex - 1 < columnsSize) {
          targetIndex = currentColumnIndex - 1;
        }
        selectEndColumn(this.focusColumns);
        this._currentFocusColumn = this.focusColumns[targetIndex];
        this._currentFocusColumn.select = true;
        this._currentFocusColumn.focus(currentFocusType);
      }
    }
  }
}
