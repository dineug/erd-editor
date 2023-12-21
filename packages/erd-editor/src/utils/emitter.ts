import {
  Action,
  AnyAction,
  createAction,
  DOMTemplateLiterals,
} from '@dineug/r-html';
import { safeCallback } from '@dineug/shared';

import { ValuesType } from '@/internal-types';

const InternalActionType = {
  openColorPicker: 'openColorPicker',
  closeColorPicker: 'closeColorPicker',
  openToast: 'openToast',
  loadShikiService: 'loadShikiService',
  openTableProperties: 'openTableProperties',
  dragendColumnAll: 'dragendColumnAll',
  copy: 'copy',
  paste: 'paste',
  schemaGC: 'schemaGC',
  toggleSearch: 'toggleSearch',
} as const;
type InternalActionType = ValuesType<typeof InternalActionType>;

type InternalActionMap = {
  [InternalActionType.openColorPicker]: {
    x: number;
    y: number;
    color: string;
  };
  [InternalActionType.closeColorPicker]: void;
  [InternalActionType.openToast]: {
    message: DOMTemplateLiterals;
    close?: Promise<void>;
  };
  [InternalActionType.loadShikiService]: void;
  [InternalActionType.openTableProperties]: {
    tableId: string;
  };
  [InternalActionType.dragendColumnAll]: void;
  [InternalActionType.copy]: {
    event: ClipboardEvent;
  };
  [InternalActionType.paste]: {
    event: ClipboardEvent;
  };
  [InternalActionType.schemaGC]: void;
  [InternalActionType.toggleSearch]: void;
};

type Reducer<K extends keyof M, M> = (action: Action<K, M>) => void;
type ReducerRecord<K extends keyof M, M> = {
  [P in K]: Reducer<P, M>;
};

export class Emitter<M extends InternalActionMap = InternalActionMap> {
  #observers = new Set<Partial<ReducerRecord<keyof M, M>>>();

  on(reducers: Partial<ReducerRecord<keyof M, M>>) {
    this.#observers.has(reducers) || this.#observers.add(reducers);

    return () => {
      this.#observers.delete(reducers);
    };
  }

  emit(action: AnyAction) {
    this.#observers.forEach(reducers => {
      const reducer = Reflect.get(reducers, action.type);
      safeCallback(reducer, action);
    });
  }
}

export const openColorPickerAction = createAction<
  InternalActionMap[typeof InternalActionType.openColorPicker]
>(InternalActionType.openColorPicker);

export const closeColorPickerAction = createAction<
  InternalActionMap[typeof InternalActionType.closeColorPicker]
>(InternalActionType.closeColorPicker);

export const openToastAction = createAction<
  InternalActionMap[typeof InternalActionType.openToast]
>(InternalActionType.openToast);

export const loadShikiServiceAction = createAction<
  InternalActionMap[typeof InternalActionType.loadShikiService]
>(InternalActionType.loadShikiService);

export const openTablePropertiesAction = createAction<
  InternalActionMap[typeof InternalActionType.openTableProperties]
>(InternalActionType.openTableProperties);

export const dragendColumnAllAction = createAction<
  InternalActionMap[typeof InternalActionType.dragendColumnAll]
>(InternalActionType.dragendColumnAll);

export const copyAction = createAction<
  InternalActionMap[typeof InternalActionType.copy]
>(InternalActionType.copy);

export const pasteAction = createAction<
  InternalActionMap[typeof InternalActionType.paste]
>(InternalActionType.paste);

export const schemaGCAction = createAction<
  InternalActionMap[typeof InternalActionType.schemaGC]
>(InternalActionType.schemaGC);

export const toggleSearchAction = createAction<
InternalActionMap[typeof InternalActionType.toggleSearch]
>(InternalActionType.toggleSearch);