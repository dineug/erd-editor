import {Table, TableUI, Column} from '@/store/table';
import ColumnFocusModel, {ColumnFocus} from './ColumnFocusModel';
import {log, isData, getData} from '@/ts/util';
import Key from '@/models/Key';
import canvasStore from '@/store/canvas';

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
}

export default class TableFocusModel implements TableFocus {
  public focusName: boolean = false;
  public focusComment: boolean = false;
  public focusColumns: ColumnFocus[] = [];
  private table: Table;
  private currentFocusTable: boolean = false;
  private currentColumn: Column | null = null;

  constructor(table: Table) {
    this.table = table;
    this.table.columns.forEach((column: Column) => this.focusColumns.push(new ColumnFocusModel(column)));
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
    if (event.key === Key.ArrowLeft) {
      if (this.currentFocusTable) {
        if (this.focusName && canvasStore.state.show.tableComment) {
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
    } else if (event.key === Key.ArrowRight) {
      if (this.currentFocusTable) {
        if (this.focusName && canvasStore.state.show.tableComment) {
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
      const columnFocus = new ColumnFocusModel(column);
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
    if (isAdd) {
      this.focus(FocusType.columnName, this.columns[this.columns.length - 1]);
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
}


