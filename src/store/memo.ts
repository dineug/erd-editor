import Vue from "vue";
import Vuex from "vuex";
import {
  memoAdd,
  memoMove,
  memoRemove,
  memoRemoveAll,
  memoSelect,
  memoSelectAll,
  memoSelectAllEnd,
  memoMultipleSelect
} from "./memo/memoController";
import { dataInit } from "@/data/memo";

Vue.use(Vuex);

export interface State {
  memos: Memo[];
}

export interface Memo {
  id: string;
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
  init = "init",
  load = "load",
  memoAdd = "memoAdd",
  memoMove = "memoMove",
  memoRemove = "memoRemove",
  memoRemoveAll = "memoRemoveAll",
  memoSelect = "memoSelect",
  memoSelectAll = "memoSelectAll",
  memoSelectAllEnd = "memoSelectAllEnd",
  memoMultipleSelect = "memoMultipleSelect"
}

export function createStore() {
  return new Vuex.Store<State>({
    state: {
      memos: []
    },
    mutations: {
      init(state: State) {
        const initData = dataInit() as any;
        const data = state as any;
        Object.keys(state).forEach(key => {
          data[key] = initData[key];
        });
      },
      load(state: State, load: State) {
        const stateData = state as any;
        const loadData = load as any;
        Object.keys(state).forEach(key => {
          if (loadData[key] !== undefined) {
            stateData[key] = loadData[key];
          }
        });
      },
      memoAdd,
      memoMove,
      memoRemove,
      memoRemoveAll,
      memoSelect,
      memoSelectAll,
      memoSelectAllEnd,
      memoMultipleSelect
    }
  });
}
