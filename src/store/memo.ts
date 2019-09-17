import Vue from 'vue';
import Vuex from 'vuex';
import {
  memoAdd,
  memoMove,
  memoRemove,
  memoRemoveAll,
  memoSelect,
  memoSelectAll,
  memoSelectAllEnd,
} from './memo/memoController';

Vue.use(Vuex);

export interface State {
  memos: Memo[];
}

export interface Memo {
  readonly id: string;
  value: string;
  ui: MemoUI;
}

export interface MemoUI {
  active: boolean;
  top: number;
  left: number;
  width: number;
  height: number;
  zIndex: number;
}

export const enum Commit {
  memoAdd = 'memoAdd',
  memoMove = 'memoMove',
  memoRemove = 'memoRemove',
  memoRemoveAll = 'memoRemoveAll',
  memoSelect = 'memoSelect',
  memoSelectAll = 'memoSelectAll',
  memoSelectAllEnd = 'memoSelectAllEnd',
}

export default new Vuex.Store<State>({
  state: {
    memos: [],
  },
  getters: {},
  mutations: {
    memoAdd,
    memoMove,
    memoRemove,
    memoRemoveAll,
    memoSelect,
    memoSelectAll,
    memoSelectAllEnd,
  },
  actions: {},
});
