import Vue from 'vue';
import Vuex from 'vuex';
import {
  relationshipAdd,
  relationshipEditStart,
  relationshipEditEnd,
} from './relationship/relationshipController';
import {dataInit} from '@/data/relationship';

Vue.use(Vuex);

export interface State {
  relationships: Relationship[];
  edit: Relationship | null;
}

export const enum RelationshipType {
  ZeroOne = 'ZeroOne',
  ZeroOneN = 'ZeroOneN',
  ZeroN = 'ZeroN',
  One = 'One',
  OneN = 'OneN',
  OneOnly = 'OneOnly',
  N = 'N',
}

export interface Relationship {
  id: string;
  identification: boolean;
  relationshipType: RelationshipType;
  start: Point | null;
  end: Point | null;
}

export interface Point {
  tableId: string;
  x: number;
  y: number;
  columnIds: string[];
}

export const enum Commit {
  init = 'init',
  load = 'load',
  relationshipAdd = 'relationshipAdd',
  relationshipEditStart = 'relationshipEditStart',
  relationshipEditEnd = 'relationshipEditEnd',
}

export function createStore() {
  return new Vuex.Store<State>({
    state: {
      relationships: [],
      edit: null,
    },
    getters: {},
    mutations: {
      init(state: State) {
        const initData = dataInit() as any;
        const data = state as any;
        Object.keys(state).forEach((key) => {
          data[key] = initData[key];
        });
      },
      load(state: State, load: State) {
        const stateData = state as any;
        const loadData = load as any;
        Object.keys(state).forEach((key) => {
          stateData[key] = loadData[key];
        });
        state.edit = null;
      },
      relationshipAdd,
      relationshipEditStart,
      relationshipEditEnd,
    },
    actions: {},
  });
}
