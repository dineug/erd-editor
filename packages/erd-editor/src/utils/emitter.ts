import {
  Action,
  AnyAction,
  createAction,
  DOMTemplateLiterals,
} from '@dineug/r-html';
import { safeCallback } from '@dineug/shared';

import { type Point, ValuesType } from '@/internal-types';
import { ThemeOptions } from '@/themes/radix-ui-theme';
import type { GridObject } from '@/utils/draw-relationship';

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
  openThemeBuilder: 'openThemeBuilder',
  setThemeOptions: 'setThemeOptions',
  mouseTrackerStart: 'mouseTrackerStart',
  mouseTrackerEnd: 'mouseTrackerEnd',
  openDiffViewer: 'openDiffViewer',
  updateObjectGridMap: 'updateObjectGridMap',
  calcPathFinding: 'calcPathFinding',
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
  [InternalActionType.openThemeBuilder]: void;
  [InternalActionType.setThemeOptions]: Partial<ThemeOptions>;
  [InternalActionType.mouseTrackerStart]: void;
  [InternalActionType.mouseTrackerEnd]: void;
  [InternalActionType.openDiffViewer]: {
    value: string;
  };
  [InternalActionType.updateObjectGridMap]: GridObject & {
    id: string;
  };
  [InternalActionType.calcPathFinding]: {
    id: string;
    start: Point;
    end: Point;
    resolve: (lines: Array<[Point, Point]>) => void;
  };
};

type ListenerRecord = {
  [P in keyof InternalActionMap]: (
    action: Action<P, InternalActionMap>
  ) => void;
};

export class Emitter {
  #observers = new Set<Partial<ListenerRecord>>();

  on(listeners: Partial<ListenerRecord>) {
    this.#observers.has(listeners) || this.#observers.add(listeners);

    return () => {
      this.#observers.delete(listeners);
    };
  }

  emit(action: AnyAction) {
    this.#observers.forEach(listeners => {
      const listener = Reflect.get(listeners, action.type);
      safeCallback(listener, action);
    });
  }

  clear() {
    this.#observers.clear();
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

export const openThemeBuilderAction = createAction<
  InternalActionMap[typeof InternalActionType.openThemeBuilder]
>(InternalActionType.openThemeBuilder);

export const setThemeOptionsAction = createAction<
  InternalActionMap[typeof InternalActionType.setThemeOptions]
>(InternalActionType.setThemeOptions);

export const mouseTrackerStartAction = createAction<
  InternalActionMap[typeof InternalActionType.mouseTrackerStart]
>(InternalActionType.mouseTrackerStart);

export const mouseTrackerEndAction = createAction<
  InternalActionMap[typeof InternalActionType.mouseTrackerEnd]
>(InternalActionType.mouseTrackerEnd);

export const openDiffViewerAction = createAction<
  InternalActionMap[typeof InternalActionType.openDiffViewer]
>(InternalActionType.openDiffViewer);

export const updateObjectGridMapAction = createAction<
  InternalActionMap[typeof InternalActionType.updateObjectGridMap]
>(InternalActionType.updateObjectGridMap);

export const calcPathFindingAction = createAction<
  InternalActionMap[typeof InternalActionType.calcPathFinding]
>(InternalActionType.calcPathFinding);
