import Vue from 'vue';
import Vuex from 'vuex';
import {dataShow, dataInit} from '@/data/canvas';
import {log} from '@/ts/util';

Vue.use(Vuex);

export interface State {
  width: number;
  height: number;
  x: number;
  y: number;
  show: Show;
  focus: boolean;
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
  init = 'init',
  load = 'load',
  move = 'move',
  focus = 'focus',
}

export function createStore() {
  return new Vuex.Store<State>({
    state: {
      width: 2000,
      height: 2000,
      x: 0,
      y: 0,
      show: dataShow(),
      focus: false,
    },
    getters: {},
    mutations: {
      init(state: State) {
        const stateData = state as any;
        const initData = dataInit() as any;
        Object.keys(state).forEach((key) => {
          stateData[key] = initData[key];
        });
      },
      load(state: State, load: State) {
        const stateData = state as any;
        const loadData = load as any;
        Object.keys(state).forEach((key) => {
          stateData[key] = loadData[key];
        });
      },
      move(state: State, payload: {x: number, y: number}) {
        log.debug('canvasStore move');
        const {x, y} = payload;
        state.x += x;
        state.y += y;
      },
      focus(state: State, focus: boolean) {
        log.debug(`canvasStore focus: ${focus}`);
        state.focus = focus;
      },
    },
    actions: {},
  });
}
