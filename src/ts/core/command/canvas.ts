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
export function executeMoveCanvas(store: Store, data: MoveCanvas) {
  Logger.debug("executeMoveCanvas");
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
export function executeResizeCanvas(store: Store, data: ResizeCanvas) {
  Logger.debug("executeResizeCanvas");
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
export function executeChangeCanvasShow(store: Store, data: ChangeCanvasShow) {
  Logger.debug("executeChangeCanvasShow");
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
export function executeChangeDatabase(store: Store, data: ChangeDatabase) {
  Logger.debug("executeChangeDatabase");
  store.canvasState.database = data.database;
}

export interface ChangeDatabaseName {
  value: string;
}
export function changeDatabaseName(
  value: string
): CommandEffect<ChangeDatabaseName> {
  return {
    name: "canvas.changeDatabaseName",
    data: {
      value,
    },
  };
}
export function executeChangeDatabaseName(
  store: Store,
  data: ChangeDatabaseName
) {
  Logger.debug("executeChangeDatabaseName");
  store.canvasState.databaseName = data.value;
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
export function executeChangeCanvasType(store: Store, data: ChangeCanvasType) {
  Logger.debug("executeChangeCanvasType");
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
export function executeChangeLanguage(store: Store, data: ChangeLanguage) {
  Logger.debug("executeChangeLanguage");
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
export function executeChangeTableCase(store: Store, data: ChangeNameCase) {
  Logger.debug("executeChangeTableCase");
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
export function executeChangeColumnCase(store: Store, data: ChangeNameCase) {
  Logger.debug("executeChangeColumnCase");
  store.canvasState.columnCase = data.nameCase;
}
