import Vue from 'vue';
import Vuex from 'vuex';
import {
  tableAdd,
  tableMove,
  tableRemove,
  tableRemoveAll,
  tableSelect,
  tableSelectAll,
  tableSelectAllEnd,
  tableFocusStart,
  tableFocusEnd,
  tableFocus,
  tableFocusMove,
  tableEditStart,
  tableEditEnd,
} from './table/tableController';
import {
  columnAdd,
  columnAddAll,
  columnFocus,
  columnRemove,
  columnRemoveAll,
} from './table/columnController';
import {TableFocus, FocusType} from '@/models/TableFocusModel';

Vue.use(Vuex);

export interface State {
  tables: Table[];
  tableFocus: TableFocus | null;
  edit: Edit | null;
}

export interface Edit {
  id: string;
  focusType: FocusType;
}

export interface Table {
  readonly id: string;
  name: string;
  comment: string;
  columns: Column[];
  ui: TableUI;

  width(): number;
  height(): number;
  maxWidthColumn(): ColumnWidth;
}

export interface ColumnWidth {
  width: number;
  name: number;
  comment: number;
  dataType: number;
  default: number;
  notNull: number;
}

export interface TableUI {
  active: boolean;
  top: number;
  left: number;
  widthName: number;
  widthComment: number;
  zIndex: number;
}

export interface Column {
  readonly id: string;
  name: string;
  comment: string;
  dataType: string;
  default: string;
  option: ColumnOption;
  ui: ColumnUI;

  width(): number;
}

export interface ColumnOption {
  autoIncrement: boolean;
  primaryKey: boolean;
  unique: boolean;
  notNull: boolean;
}

export interface ColumnUI {
  active: boolean;
  pk: boolean;
  fk: boolean;
  pfk: boolean;
  widthName: number;
  widthComment: number;
  widthDataType: number;
  widthDefault: number;
}

export const enum Commit {
  tableAdd = 'tableAdd',
  tableMove = 'tableMove',
  tableRemove = 'tableRemove',
  tableRemoveAll = 'tableRemoveAll',
  tableSelect = 'tableSelect',
  tableSelectAll = 'tableSelectAll',
  tableSelectAllEnd = 'tableSelectAllEnd',
  tableFocusStart = 'tableFocusStart',
  tableFocusEnd = 'tableFocusEnd',
  tableFocus = 'tableFocus',
  tableFocusMove = 'tableFocusMove',
  tableEditStart = 'tableEditStart',
  tableEditEnd = 'tableEditEnd',
  columnAdd = 'columnAdd',
  columnAddAll = 'columnAddAll',
  columnFocus = 'columnFocus',
  columnRemove = 'columnRemove',
  columnRemoveAll = 'columnRemoveAll',
}

export default new Vuex.Store<State>({
  state: {
    tables: [],
    tableFocus: null,
    edit: null,
  },
  getters: {},
  mutations: {
    tableAdd,
    tableMove,
    tableRemove,
    tableRemoveAll,
    tableSelect,
    tableSelectAll,
    tableSelectAllEnd,
    tableFocusStart,
    tableFocusEnd,
    tableFocus,
    tableFocusMove,
    tableEditStart,
    tableEditEnd,
    columnAdd,
    columnAddAll,
    columnFocus,
    columnRemove,
    columnRemoveAll,
  },
  actions: {},
});
