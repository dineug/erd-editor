import {Table, TableUI, TableFocus, Column, ColumnFocus} from '@/store/table';
import ColumnFocusModel from './ColumnFocusModel';
import {log} from '@/ts/util';

export default class TableFocusModel implements TableFocus {
  public focusColumns: ColumnFocus[] = [];
  private table: Table;
  private nameFocus: boolean = false;
  private commentFocus: boolean = false;

  constructor(table: Table) {
    this.table = table;
    this.table.columns.forEach((column: Column) => {
      this.focusColumns.push(new ColumnFocusModel(column));
    });
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
    log.debug('get columns');
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

  get focusName(): boolean {
    return this.nameFocus;
  }
  set focusName(focusName: boolean) {
    this.nameFocus = focusName;
    this.commentFocus = false;
  }
  get focusComment(): boolean {
    return this.commentFocus;
  }
  set focusComment(focusComment: boolean) {
    this.commentFocus = focusComment;
    this.nameFocus = false;
  }

  private watchColumns() {
    log.debug('TableFocusModel watchColumns');
    const columns = this.columns;
  }

}
