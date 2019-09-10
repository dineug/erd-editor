import Vue from 'vue';
import Vuex from 'vuex';
import {dataShow} from '@/data/canvas';

Vue.use(Vuex);

export interface State {
  width: number;
  height: number;
  x: number;
  y: number;
  show: Show;
}

export interface Show {
  tableComment: boolean;
  columnComment: boolean;
  columnDataType: boolean;
  columnDefault: boolean;
  columnAutoIncrement: boolean;
  columnPrimaryKey: boolean;
  columnUnique: boolean;
  columnNotNull: boolean;
  relationship: boolean;
}

export const enum Commit {
  move = 'move',
}

export default new Vuex.Store<State>({
  state: {
    width: 2000,
    height: 2000,
    x: 0,
    y: 0,
    show: dataShow,
  },
  getters: {},
  mutations: {
    move(state: State, payload: {x: number, y: number}) {
      const {x, y} = payload;
      state.x += x;
      state.y += y;
    },
  },
  actions: {},
});
