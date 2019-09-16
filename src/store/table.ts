import Vue from 'vue';
import Vuex from 'vuex';
import {
  tableAdd,
  tableMove,
  tableRemove,
  tableSelect,
  tableSelectAllEnd,
  tableFocusStart,
  tableFocusEnd,
  tableFocus,
  tableFocusMove,
} from './table/tableController';
import {
  columnAdd,
  columnFocus,
} from './table/columnController';
import {TableFocus} from '@/models/TableFocusModel';

Vue.use(Vuex);

export interface State {
  tables: Table[];
  tableFocus: TableFocus | null;
}

export interface Table {
  id: string;
  name: string;
  comment: string;
  columns: Column[];
  ui: TableUI;

  width(): number;
  height(): number;
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
  id: string;
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
  tableSelect = 'tableSelect',
  tableSelectAllEnd = 'tableSelectAllEnd',
  tableFocusStart = 'tableFocusStart',
  tableFocusEnd = 'tableFocusEnd',
  tableFocus = 'tableFocus',
  tableFocusMove = 'tableFocusMove',
  columnAdd = 'columnAdd',
  columnFocus = 'columnFocus',
}

export default new Vuex.Store<State>({
  state: {
    tables: [],
    tableFocus: null,
  },
  getters: {},
  mutations: {
    tableAdd,
    tableMove,
    tableRemove,
    tableSelect,
    tableSelectAllEnd,
    tableFocusStart,
    tableFocusEnd,
    tableFocus,
    tableFocusMove,
    columnAdd,
    columnFocus,
  },
  actions: {},
});
