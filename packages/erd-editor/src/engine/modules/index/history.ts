import { PushUndoHistory } from '@/engine/history.actions';
import { query } from '@/utils/collection/query';

import { ActionType } from './actions';
import {
  addIndexAction,
  changeIndexNameAction,
  changeIndexUniqueAction,
  removeIndexAction,
} from './atom.actions';

const addIndex: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof addIndexAction>
) => {
  undoActions.push(removeIndexAction({ id }));
};

const removeIndex: PushUndoHistory = (
  undoActions,
  { payload: { id } }: ReturnType<typeof removeIndexAction>,
  { collections }
) => {
  const index = query(collections).collection('indexEntities').selectById(id);
  if (!index) return;

  undoActions.push(
    addIndexAction({
      id,
      tableId: index.tableId,
    })
  );
};

const changeIndexName: PushUndoHistory = (
  undoActions,
  { payload: { id, tableId } }: ReturnType<typeof changeIndexNameAction>,
  { collections }
) => {
  const index = query(collections).collection('indexEntities').selectById(id);
  if (!index) return;

  undoActions.push(
    changeIndexNameAction({
      id,
      tableId,
      value: index.name,
    })
  );
};

const changeIndexUnique: PushUndoHistory = (
  undoActions,
  {
    payload: { id, tableId, value },
  }: ReturnType<typeof changeIndexUniqueAction>,
  { collections }
) => {
  const index = query(collections).collection('indexEntities').selectById(id);
  if (!index) return;

  undoActions.push(
    changeIndexUniqueAction({
      id,
      tableId,
      value: !value,
    })
  );
};

export const indexPushUndoHistoryMap = {
  [ActionType.addIndex]: addIndex,
  [ActionType.removeIndex]: removeIndex,
  [ActionType.changeIndexName]: changeIndexName,
  [ActionType.changeIndexUnique]: changeIndexUnique,
};
