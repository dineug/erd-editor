import { PushUndoHistory } from '@/engine/history.actions';
import { query } from '@/utils/collection/query';

import { ActionType } from './actions';
import {
  addIndexColumnAction,
  changeIndexColumnOrderTypeAction,
  moveIndexColumnAction,
  removeIndexColumnAction,
} from './atom.actions';

const addIndexColumn: PushUndoHistory = (
  undoActions,
  { payload: { id, indexId, tableId } }: ReturnType<typeof addIndexColumnAction>
) => {
  undoActions.push(removeIndexColumnAction({ id, indexId, tableId }));
};

const removeIndexColumn: PushUndoHistory = (
  undoActions,
  {
    payload: { id, indexId, tableId },
  }: ReturnType<typeof removeIndexColumnAction>,
  { collections }
) => {
  const indexColumn = query(collections)
    .collection('indexColumnEntities')
    .selectById(id);
  if (!indexColumn) return;

  undoActions.push(
    addIndexColumnAction({
      id,
      indexId,
      tableId,
      columnId: indexColumn.columnId,
    })
  );
};

const moveIndexColumn: PushUndoHistory = (
  undoActions,
  {
    payload: { id, indexId, tableId, targetId },
  }: ReturnType<typeof moveIndexColumnAction>,
  { collections }
) => {
  const index = query(collections)
    .collection('indexEntities')
    .selectById(indexId);
  if (!index) return;

  const i = index.indexColumnIds.indexOf(id);
  if (i === -1) return;

  const targetIndex = index.indexColumnIds.indexOf(targetId);
  if (targetIndex === -1) return;

  const revertIndex = i < targetIndex ? i + 1 : i - 1;
  const newTargetId = index.indexColumnIds[revertIndex];

  undoActions.push(
    moveIndexColumnAction({
      indexId,
      tableId,
      id,
      targetId: newTargetId,
    })
  );
};

const changeIndexColumnOrderType: PushUndoHistory = (
  undoActions,
  {
    payload: { id, indexId, columnId },
  }: ReturnType<typeof changeIndexColumnOrderTypeAction>,
  { collections }
) => {
  const indexColumn = query(collections)
    .collection('indexColumnEntities')
    .selectById(id);
  if (!indexColumn) return;

  undoActions.push(
    changeIndexColumnOrderTypeAction({
      id,
      indexId,
      columnId,
      value: indexColumn.orderType,
    })
  );
};

export const indexColumnPushUndoHistoryMap = {
  [ActionType.addIndexColumn]: addIndexColumn,
  [ActionType.removeIndexColumn]: removeIndexColumn,
  [ActionType.moveIndexColumn]: moveIndexColumn,
  [ActionType.changeIndexColumnOrderType]: changeIndexColumnOrderType,
};
