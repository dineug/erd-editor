import {Table, TableUI, Column, Commit, ColumnWidth} from '@/store/table';
import ColumnFocusModel, {ColumnFocus} from './ColumnFocusModel';
import {log, isData, getData} from '@/ts/util';
import Key from '@/models/Key';
import StoreManagement from '@/store/StoreManagement';
import {Bus} from '@/ts/EventBus';

export const enum FocusType {
  tableName = 'tableName',
  tableComment = 'tableComment',
  columnName = 'columnName',
  columnDataType = 'columnDataType',
  columnNotNull = 'columnNotNull',
  columnDefault = 'columnDefault',
  columnComment = 'columnComment',
}

export interface TableFocus extends Table {
  focusName: boolean;
  focusComment: boolean;
  focusColumns: ColumnFocus[];

  focus(focusType: FocusType, column?: Column): void;
  move(event: KeyboardEvent): void;
  watchColumns(): void;
  columnRemove(): void;
  primaryKey(): void;
}

export default class TableFocusModel implements TableFocus {
  public focusName: boolean = true;
  public focusComment: boolean = false;
  public focusColumns: ColumnFocus[] = [];
  private table: Table;
  private currentFocusTable: boolean = true;
  private currentColumn: Column | null = null;
  private readonly store: StoreManagement;

  constructor(store: StoreManagement, table: Table, tableFocus?: any) {
    this.store = store;
    this.table = table;
    if (tableFocus) {
      tableFocus.focusColumns.forEach((value: any) => value.id = value.column.id);
      this.table.columns.forEach((column: Column) => {
        const columnFocus = getData(tableFocus.focusColumns, column.id);
        this.focusColumns.push(new ColumnFocusModel(store, column, columnFocus));
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
      this.table.columns.forEach((column: Column) => this.focusColumns.push(new ColumnFocusModel(store, column)));
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
    this.focusAllEnd();
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

  public move(event: KeyboardEvent) {
    if (event.key === Key.Tab) {
      event.preventDefault();
    }
    if (event.key === Key.Enter || this.store.tableStore.state.edit) {
      this.edit(event);
    } else if (event.key === Key.ArrowLeft) {
      if (this.currentFocusTable) {
        if (this.focusName && this.store.canvasStore.state.show.tableComment) {
          this.focus(FocusType.tableComment);
        } else {
          this.focus(FocusType.tableName);
        }
      } else if (this.currentColumn) {
        const focusColumn = getData(this.focusColumns, this.currentColumn.id);
        if (focusColumn) {
          this.focus(focusColumn.preFocus(), this.currentColumn);
        }
      }
    } else if (event.key === Key.ArrowRight || event.key === Key.Tab) {
      if (this.currentFocusTable) {
        if (this.focusName && this.store.canvasStore.state.show.tableComment) {
          this.focus(FocusType.tableComment);
        } else {
          this.focus(FocusType.tableName);
        }
      } else if (this.currentColumn) {
        const focusColumn = getData(this.focusColumns, this.currentColumn.id);
        if (focusColumn) {
          this.focus(focusColumn.nextFocus(), this.currentColumn);
        }
      }
    } else if (event.key === Key.ArrowUp) {
      if (this.currentFocusTable) {
        if (this.columns.length !== 0) {
          this.focus(FocusType.columnName, this.columns[this.columns.length - 1]);
        }
      } else if (this.currentColumn) {
        const focusColumn = getData(this.focusColumns, this.currentColumn.id);
        if (focusColumn) {
          const index = this.columns.indexOf(this.currentColumn);
          if (index === 0) {
            this.focus(FocusType.tableName);
          } else {
            this.focus(focusColumn.currentFocus(), this.columns[index - 1]);
          }
        }
      }
    } else if (event.key === Key.ArrowDown) {
      if (this.currentFocusTable) {
        if (this.columns.length !== 0) {
          this.focus(FocusType.columnName, this.columns[0]);
        }
      } else if (this.currentColumn) {
        const focusColumn = getData(this.focusColumns, this.currentColumn.id);
        if (focusColumn) {
          const index = this.columns.indexOf(this.currentColumn);
          if (index === this.columns.length - 1) {
            this.focus(FocusType.tableName);
          } else {
            this.focus(focusColumn.currentFocus(), this.columns[index + 1]);
          }
        }
      }
    }
  }

  public watchColumns() {
    log.debug('TableFocusModel watchColumns');
    const oldFocusColumns = [...this.focusColumns];
    this.focusColumns = [];
    this.table.columns.forEach((column: Column) => {
      const columnFocus = new ColumnFocusModel(this.store, column);
      const oldColumnFocus = getData(oldFocusColumns, column.id);
      if (oldColumnFocus) {
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
    if (!isAdd && oldFocusColumns.length > this.focusColumns.length && this.currentColumn) {
      const focusColumn = getData(oldFocusColumns, this.currentColumn.id);
      if (focusColumn) {
        const index = oldFocusColumns.indexOf(focusColumn);
        if (index === 0) {
          this.focus(FocusType.tableName);
        } else {
          this.focus(focusColumn.currentFocus(), this.columns[index - 1]);
        }
      }
    }
    if (isAdd) {
      this.focus(FocusType.columnName, this.columns[this.columns.length - 1]);
    }
  }

  public columnRemove() {
    if (this.currentColumn) {
      const index = this.table.columns.indexOf(this.currentColumn);
      this.table.columns.splice(index, 1);
    }
  }

  public primaryKey() {
    if (this.currentColumn) {
      if (this.currentColumn.ui.pfk) {
        this.currentColumn.ui.fk = true;
        this.currentColumn.ui.pfk = false;
        this.currentColumn.option.primaryKey = false;
      } else if (this.currentColumn.ui.fk) {
        this.currentColumn.ui.fk = false;
        this.currentColumn.ui.pfk = true;
        this.currentColumn.option.primaryKey = true;
      } else {
        this.currentColumn.option.primaryKey = !this.currentColumn.ui.pk;
        this.currentColumn.ui.pk = !this.currentColumn.ui.pk;
      }
    }
  }

  private focusAllEnd() {
    this.tableFocusAllEnd();
    this.columnFocusAllEnd();
  }

  private tableFocusAllEnd() {
    this.focusName = false;
    this.focusComment = false;
  }

  private columnFocusAllEnd() {
    this.focusColumns.forEach((value) => {
      value.focusName = false;
      value.focusComment = false;
      value.focusDataType = false;
      value.focusDefault = false;
      value.focusNotNull = false;
    });
  }

  private edit(event: KeyboardEvent) {
    log.debug('TableFocusModel edit');
    if (this.store.tableStore.state.edit) {
      if (!event.altKey && (event.key === Key.Enter || event.key === Key.Tab)) {
        this.store.tableStore.commit(Commit.tableEditEnd, this.store);
      }
    } else {
      if (!event.altKey && event.key === Key.Enter) {
        if (this.currentFocusTable) {
          const focusType = this.focusName ? FocusType.tableName : FocusType.tableComment;
          this.store.tableStore.commit(Commit.tableEditStart, {
            id: this.table.id,
            focusType,
          });
        } else if (this.currentColumn) {
          const focusColumn = getData(this.focusColumns, this.currentColumn.id);
          if (focusColumn) {
            const focusType = focusColumn.currentFocus();
            if (focusType === FocusType.columnNotNull) {
              this.currentColumn.option.notNull = !this.currentColumn.option.notNull;
              this.store.eventBus.$emit(Bus.ERD.input);
            } else {
              this.store.tableStore.commit(Commit.tableEditStart, {
                id: this.currentColumn.id,
                focusType,
              });
            }
          }
        }
      }
    }
  }

}


