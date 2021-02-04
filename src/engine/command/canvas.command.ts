import {
  MoveCanvas,
  ResizeCanvas,
  ChangeCanvasShow,
  ChangeDatabase,
  ChangeDatabaseName,
  ChangeCanvasType,
  ChangeLanguage,
  ChangeNameCase,
  ChangeRelationshipDataTypeSync,
  MoveColumnOrder,
} from '@@types/engine/command/canvas.command';
import { IStore } from '@/internal-types/store';

export function executeMoveCanvas(store: IStore, data: MoveCanvas) {
  const { canvasState } = store;
  canvasState.scrollTop = data.scrollTop;
  canvasState.scrollLeft = data.scrollLeft;
}

export function executeResizeCanvas(store: IStore, data: ResizeCanvas) {
  const { canvasState } = store;
  canvasState.width = data.width;
  canvasState.height = data.height;
}

export function executeChangeCanvasShow(store: IStore, data: ChangeCanvasShow) {
  const { tables } = store.tableState;
  const { relationships } = store.relationshipState;
  const { show } = store.canvasState;
  show[data.showKey] = data.value;
  // relationshipSort(tables, relationships);
}

export function executeChangeDatabase(store: IStore, data: ChangeDatabase) {
  store.canvasState.database = data.database;
}

export function executeChangeDatabaseName(
  store: IStore,
  data: ChangeDatabaseName
) {
  store.canvasState.databaseName = data.value;
}

export function executeChangeCanvasType(store: IStore, data: ChangeCanvasType) {
  store.canvasState.canvasType = data.canvasType;
}

export function executeChangeLanguage(store: IStore, data: ChangeLanguage) {
  store.canvasState.language = data.language;
}

export function executeChangeTableCase(store: IStore, data: ChangeNameCase) {
  store.canvasState.tableCase = data.nameCase;
}

export function executeChangeColumnCase(store: IStore, data: ChangeNameCase) {
  store.canvasState.columnCase = data.nameCase;
}

export function executeChangeRelationshipDataTypeSync(
  store: IStore,
  data: ChangeRelationshipDataTypeSync
) {
  store.canvasState.setting.relationshipDataTypeSync = data.value;
}

export function executeMoveColumnOrder(store: IStore, data: MoveColumnOrder) {
  const { columnOrder } = store.canvasState.setting;

  if (data.columnType === data.targetColumnType) return;

  const targetIndex = columnOrder.indexOf(data.targetColumnType);
  const currentIndex = columnOrder.indexOf(data.columnType);
  if (targetIndex !== -1 && currentIndex !== -1) {
    columnOrder.splice(currentIndex, 1);
    columnOrder.splice(targetIndex, 0, data.columnType);
  }
}
