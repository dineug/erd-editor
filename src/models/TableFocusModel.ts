import { Table, TableUI, Column, Commit, ColumnWidth } from "@/store/table";
import { Commit as RelationshipCommit } from "@/store/relationship";
import ColumnFocusModel, { ColumnFocus } from "./ColumnFocusModel";
import { log, isData, getData } from "@/ts/util";
import Key from "@/models/Key";
import StoreManagement from "@/store/StoreManagement";
import { Bus } from "@/ts/EventBus";
import { getSelect } from "@/store/table/tableHelper";
import {
  focusAllEnd,
  selectedMove,
  moveArrowLeft,
  moveArrowRight,
  moveArrowUp,
  moveArrowDown
} from "./TableFocusHelper";

export const enum FocusType {
  tableName = "tableName",
  tableComment = "tableComment",
  columnName = "columnName",
  columnDataType = "columnDataType",
  columnNotNull = "columnNotNull",
  columnDefault = "columnDefault",
  columnComment = "columnComment"
}

export interface TableFocus extends Table {
  focusName: boolean;
  focusComment: boolean;
  focusColumns: ColumnFocus[];

  focus(focusType: FocusType, column?: Column): void;
  selected(event?: MouseEvent): void;
  move(event: KeyboardEvent): void;
  watchColumns(): void;
  columnSelectAll(): Column[];
  primaryKey(): void;
}

export default class TableFocusModel implements TableFocus {
  public focusName: boolean = true;
  public focusComment: boolean = false;
  public focusColumns: ColumnFocus[] = [];
  private readonly table: Table;
  private readonly store: StoreManagement;
  private currentFocusTable: boolean = true;
  private currentColumn: Column | null = null;

  constructor(store: StoreManagement, table: Table, tableFocus?: any) {
    this.store = store;
    this.table = table;
    if (tableFocus) {
      tableFocus.focusColumns.forEach(
        (value: any) => (value.id = value.column.id)
      );
      this.table.columns.forEach((column: Column) => {
        const columnFocus = getData(tableFocus.focusColumns, column.id);
        this.focusColumns.push(
          new ColumnFocusModel(store, column, columnFocus)
        );
      });
      this.focusName = tableFocus.focusName;
      this.focusComment = tableFocus.focusComment;
      this.currentFocusTable = tableFocus.currentFocusTable;
      if (tableFocus.currentColumn) {
        const column = getData(this.table.columns, tableFocus.currentColumn.id);
        if (column) {
          this.currentColumn = column;
        }
      } else {
        this.currentColumn = tableFocus.currentColumn;
      }
    } else {
      this.table.columns.forEach((column: Column) =>
        this.focusColumns.push(new ColumnFocusModel(store, column))
      );
    }
  }

  get id(): string {
    return this.table.id;
  }

  get name(): string {
    return this.table.name;
  }

  get comment(): string {
    return this.table.comment;
  }

  get columns(): Column[] {
    return this.table.columns;
  }

  get ui(): TableUI {
    return this.table.ui;
  }

  public width(): number {
    return this.table.width();
  }

  public height(): number {
    return this.table.height();
  }

  public maxWidthColumn(): ColumnWidth {
    return this.table.maxWidthColumn();
  }

  public focus(focusType: FocusType, column?: Column) {
    focusAllEnd(this);
    switch (focusType) {
      case FocusType.tableName:
        this.focusName = true;
        this.currentFocusTable = true;
        this.currentColumn = null;
        break;
      case FocusType.tableComment:
        this.focusComment = true;
        this.currentFocusTable = true;
        this.currentColumn = null;
        break;
    }
    if (column) {
      const currentColumnFocus = getData(this.focusColumns, column.id);
      if (currentColumnFocus) {
        this.currentFocusTable = false;
        this.currentColumn = column;
        switch (focusType) {
          case FocusType.columnName:
            currentColumnFocus.focusName = true;
            break;
          case FocusType.columnComment:
            currentColumnFocus.focusComment = true;
            break;
          case FocusType.columnDataType:
            currentColumnFocus.focusDataType = true;
            break;
          case FocusType.columnDefault:
            currentColumnFocus.focusDefault = true;
            break;
          case FocusType.columnNotNull:
            currentColumnFocus.focusNotNull = true;
            break;
        }
      }
    }
  }

  public selected(event?: MouseEvent) {
    if (this.currentColumn && event) {
      if (event.shiftKey || event.ctrlKey) {
        for (const column of this.focusColumns) {
          if (column.id === this.currentColumn.id) {
            column.selected = true;
            break;
          }
        }
        if (event.shiftKey) {
          const index = getSelect(this.focusColumns);
          log.debug(index);
          if (index.min !== -1 && index.max !== -1) {
            for (let i = index.min; i <= index.max; i++) {
              this.focusColumns[i].selected = true;
            }
          }
        }
      } else {
        selectedMove(this, this.currentColumn);
      }
    } else {
      this.focusColumns.forEach(column => (column.selected = false));
    }
  }

  public move(event: KeyboardEvent) {
    if (event.key === Key.Tab) {
      event.preventDefault();
    }
    if (
      this.store.tableStore.state.edit ||
      event.key === Key.F2 ||
      event.key === Key.Enter ||
      event.key === Key.Escape
    ) {
      this.edit(event);
    } else if (event.key === Key.ArrowLeft) {
      moveArrowLeft(
        this.store,
        this,
        this.currentFocusTable,
        this.currentColumn,
        event
      );
    } else if (event.key === Key.ArrowRight || event.key === Key.Tab) {
      moveArrowRight(
        this.store,
        this,
        this.currentFocusTable,
        this.currentColumn,
        event
      );
    } else if (event.key === Key.ArrowUp) {
      moveArrowUp(
        this.store,
        this,
        this.currentFocusTable,
        this.currentColumn,
        event
      );
    } else if (event.key === Key.ArrowDown) {
      moveArrowDown(
        this.store,
        this,
        this.currentFocusTable,
        this.currentColumn,
        event
      );
    }
  }

  public watchColumns() {
    log.debug("TableFocusModel watchColumns");
    const oldFocusColumns = [...this.focusColumns];
    this.focusColumns = [];
    this.table.columns.forEach((column: Column) => {
      const columnFocus = new ColumnFocusModel(this.store, column);
      const oldColumnFocus = getData(oldFocusColumns, column.id);
      if (oldColumnFocus) {
        columnFocus.selected = oldColumnFocus.selected;
        columnFocus.focusName = oldColumnFocus.focusName;
        columnFocus.focusComment = oldColumnFocus.focusComment;
        columnFocus.focusDataType = oldColumnFocus.focusDataType;
        columnFocus.focusDefault = oldColumnFocus.focusDefault;
        columnFocus.focusNotNull = oldColumnFocus.focusNotNull;
      }
      this.focusColumns.push(columnFocus);
    });

    let isAdd = false;
    this.table.columns.forEach((column: Column) => {
      if (isData(oldFocusColumns, column.id)) {
        isAdd = true;
      }
    });
    if (
      !isAdd &&
      oldFocusColumns.length > this.focusColumns.length &&
      this.currentColumn
    ) {
      const focusColumn = getData(oldFocusColumns, this.currentColumn.id);
      if (focusColumn) {
        let index = oldFocusColumns.indexOf(focusColumn);
        if (this.columns.length < index) {
          index = this.columns.length;
        }
        if (index === 0) {
          this.focus(FocusType.tableName);
          selectedMove(this, this.currentColumn);
        } else {
          this.focus(focusColumn.currentFocus(), this.columns[index - 1]);
          selectedMove(this, this.currentColumn);
        }
      }
    }
    if (isAdd) {
      this.focus(FocusType.columnName, this.columns[this.columns.length - 1]);
      selectedMove(this, this.currentColumn);
    }
  }

  public columnSelectAll(): Column[] {
    const columns: Column[] = [];
    const len = this.focusColumns.length;
    for (let i = 0; i < len; i++) {
      if (this.focusColumns[i].selected) {
        columns.push(this.columns[i]);
      }
    }
    return columns;
  }

  public primaryKey() {
    if (this.currentColumn) {
      if (this.currentColumn.ui.pfk) {
        this.currentColumn.ui.fk = true;
        this.currentColumn.ui.pfk = false;
        this.currentColumn.option.primaryKey = false;
        this.store.relationshipStore.commit(
          RelationshipCommit.relationshipIdentification,
          {
            table: this.table,
            column: this.currentColumn
          }
        );
      } else if (this.currentColumn.ui.fk) {
        this.currentColumn.ui.fk = false;
        this.currentColumn.ui.pfk = true;
        this.currentColumn.option.primaryKey = true;
        this.store.relationshipStore.commit(
          RelationshipCommit.relationshipIdentification,
          {
            table: this.table,
            column: this.currentColumn
          }
        );
      } else {
        this.currentColumn.option.primaryKey = !this.currentColumn.ui.pk;
        this.currentColumn.ui.pk = !this.currentColumn.ui.pk;
      }
    }
  }

  private edit(event: KeyboardEvent) {
    log.debug("TableFocusModel edit");
    if (this.store.tableStore.state.edit) {
      if (
        !event.altKey &&
        (event.key === Key.Enter ||
          event.key === Key.Tab ||
          event.key === Key.Escape)
      ) {
        this.store.tableStore.commit(Commit.tableEditEnd, this.store);
      }
    } else {
      if (!event.altKey && (event.key === Key.Enter || event.key === Key.F2)) {
        if (this.currentFocusTable) {
          const focusType = this.focusName
            ? FocusType.tableName
            : FocusType.tableComment;
          this.store.tableStore.commit(Commit.tableEditStart, {
            id: this.table.id,
            focusType
          });
        } else if (this.currentColumn) {
          const focusColumn = getData(this.focusColumns, this.currentColumn.id);
          if (focusColumn) {
            const focusType = focusColumn.currentFocus();
            if (focusType === FocusType.columnNotNull) {
              this.currentColumn.option.notNull = !this.currentColumn.option
                .notNull;
              this.store.eventBus.$emit(Bus.ERD.input);
            } else {
              this.store.tableStore.commit(Commit.tableEditStart, {
                id: this.currentColumn.id,
                focusType
              });
            }
          }
        }
      }
    }
  }
}
