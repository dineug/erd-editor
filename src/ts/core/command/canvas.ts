import { CommandEffect } from "../Command";
import { Store } from "../Store";
import { Logger } from "../Logger";
import {
  ShowKey,
  Database,
  CanvasType,
  Language,
  NameCase,
} from "../store/Canvas";

export interface MoveCanvas {
  scrollTop: number;
  scrollLeft: number;
}
export function moveCanvas(
  scrollTop: number,
  scrollLeft: number
): CommandEffect<MoveCanvas> {
  return {
    name: "canvas.move",
    data: {
      scrollTop,
      scrollLeft,
    },
  };
}
export function moveCanvasExecute(store: Store, data: MoveCanvas) {
  Logger.debug("moveCanvasExecute");
  const { canvasState } = store;
  canvasState.scrollTop = data.scrollTop;
  canvasState.scrollLeft = data.scrollLeft;
}

export interface ResizeCanvas {
  width: number;
  height: number;
}
export function resizeCanvas(
  width: number,
  height: number
): CommandEffect<ResizeCanvas> {
  return {
    name: "canvas.resize",
    data: {
      width,
      height,
    },
  };
}
export function resizeCanvasExecute(store: Store, data: ResizeCanvas) {
  Logger.debug("resizeCanvasExecute");
  const { canvasState } = store;
  canvasState.width = data.width;
  canvasState.height = data.height;
}

export interface ChangeCanvasShow {
  showKey: ShowKey;
  value: boolean;
}
export function changeCanvasShow(
  store: Store,
  showKey: ShowKey
): CommandEffect<ChangeCanvasShow> {
  const { show } = store.canvasState;
  return {
    name: "canvas.changeShow",
    data: {
      showKey,
      value: !show[showKey],
    },
  };
}
export function changeCanvasShowExecute(store: Store, data: ChangeCanvasShow) {
  Logger.debug("changeCanvasShowExecute");
  const { show } = store.canvasState;
  show[data.showKey] = data.value;
}

export interface ChangeDatabase {
  database: Database;
}
export function changeDatabase(
  database: Database
): CommandEffect<ChangeDatabase> {
  return {
    name: "canvas.changeDatabase",
    data: {
      database,
    },
  };
}
export function changeDatabaseExecute(store: Store, data: ChangeDatabase) {
  Logger.debug("changeDatabaseExecute");
  store.canvasState.database = data.database;
}

export interface ChangeCanvasType {
  canvasType: CanvasType;
}
export function changeCanvasType(
  canvasType: CanvasType
): CommandEffect<ChangeCanvasType> {
  return {
    name: "canvas.changeCanvasType",
    data: {
      canvasType,
    },
  };
}
export function changeCanvasTypeExecute(store: Store, data: ChangeCanvasType) {
  Logger.debug("changeCanvasTypeExecute");
  store.canvasState.canvasType = data.canvasType;
}

export interface ChangeLanguage {
  language: Language;
}
export function changeLanguage(
  language: Language
): CommandEffect<ChangeLanguage> {
  return {
    name: "canvas.changeLanguage",
    data: {
      language,
    },
  };
}
export function changeLanguageExecute(store: Store, data: ChangeLanguage) {
  Logger.debug("changeLanguageExecute");
  store.canvasState.language = data.language;
}

export interface ChangeNameCase {
  nameCase: NameCase;
}

export function changeTableCase(
  nameCase: NameCase
): CommandEffect<ChangeNameCase> {
  return {
    name: "canvas.changeTableCase",
    data: {
      nameCase,
    },
  };
}
export function changeTableCaseExecute(store: Store, data: ChangeNameCase) {
  Logger.debug("changeTableCaseExecute");
  store.canvasState.tableCase = data.nameCase;
}

export function changeColumnCase(
  nameCase: NameCase
): CommandEffect<ChangeNameCase> {
  return {
    name: "canvas.changeColumnCase",
    data: {
      nameCase,
    },
  };
}
export function changeColumnCaseExecute(store: Store, data: ChangeNameCase) {
  Logger.debug("changeColumnCaseExecute");
  store.canvasState.columnCase = data.nameCase;
}
