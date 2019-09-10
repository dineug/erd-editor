import Vue from 'vue';
import Vuex from 'vuex';
import {
  tableAdd,
  tableMove,
} from './table/tableController';

Vue.use(Vuex);

export interface State {
  tables: Table[];
}

export interface Table {
  id: string;
  name: string;
  comment: string;
  columns: Column[];
  ui: TableUI;

  width(): number;
}

export interface TableUI {
  active: boolean;
  top: number;
  left: number;
  widthName: number;
  widthComment: number;
  height: number;
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
}

export default new Vuex.Store<State>({
  state: {
    tables: [],
  },
  getters: {},
  mutations: {
    tableAdd,
    tableMove,
  },
  actions: {},
});
