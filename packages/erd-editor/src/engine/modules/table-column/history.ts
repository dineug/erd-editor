import { PushUndoHistory } from '@/engine/history.actions';
import { query } from '@/utils/collection/query';

import { ActionType } from './actions';
import {
  addColumnAction,
  changeColumnAutoIncrementAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
  removeColumnAction,
} from './atom.actions';

const addColumn: PushUndoHistory = (
  undoActions,
  { payload: { id, tableId } }: ReturnType<typeof addColumnAction>
) => {
  undoActions.push(removeColumnAction({ id, tableId }));
};

const removeColumn: PushUndoHistory = (
  undoActions,
  { payload: { id, tableId } }: ReturnType<typeof removeColumnAction>
) => {
  undoActions.push(addColumnAction({ id, tableId }));
};

const changeColumnName: PushUndoHistory = (
  undoActions,
  { payload: { id, tableId } }: ReturnType<typeof changeColumnNameAction>,
  { collections }
) => {
  const column = query(collections)
    .collection('tableColumnEntities')
    .selectById(id);
  if (!column) return;

  undoActions.push(changeColumnNameAction({ id, tableId, value: column.name }));
};

const changeColumnDataType: PushUndoHistory = (
  undoActions,
  { payload: { id, tableId } }: ReturnType<typeof changeColumnDataTypeAction>,
  { collections }
) => {
  const column = query(collections)
    .collection('tableColumnEntities')
    .selectById(id);
  if (!column) return;

  undoActions.push(
    changeColumnDataTypeAction({ id, tableId, value: column.dataType })
  );
};

const changeColumnDefault: PushUndoHistory = (
  undoActions,
  { payload: { id, tableId } }: ReturnType<typeof changeColumnDefaultAction>,
  { collections }
) => {
  const column = query(collections)
    .collection('tableColumnEntities')
    .selectById(id);
  if (!column) return;

  undoActions.push(
    changeColumnDefaultAction({ id, tableId, value: column.default })
  );
};

const changeComment: PushUndoHistory = (
  undoActions,
  { payload: { id, tableId } }: ReturnType<typeof changeColumnCommentAction>,
  { collections }
) => {
  const column = query(collections)
    .collection('tableColumnEntities')
    .selectById(id);
  if (!column) return;

  undoActions.push(
    changeColumnCommentAction({ id, tableId, value: column.comment })
  );
};

const changeColumnAutoIncrement: PushUndoHistory = (
  undoActions,
  {
    payload: { id, tableId, value },
  }: ReturnType<typeof changeColumnAutoIncrementAction>,
  { collections }
) => {
  const column = query(collections)
    .collection('tableColumnEntities')
    .selectById(id);
  if (!column) return;

  undoActions.push(
    changeColumnAutoIncrementAction({
      id,
      tableId,
      value: !value,
    })
  );
};

const changeColumnNotNull: PushUndoHistory = (
  undoActions,
  {
    payload: { id, tableId, value },
  }: ReturnType<typeof changeColumnNotNullAction>,
  { collections }
) => {
  const column = query(collections)
    .collection('tableColumnEntities')
    .selectById(id);
  if (!column) return;

  undoActions.push(
    changeColumnNotNullAction({
      id,
      tableId,
      value: !value,
    })
  );
};

const changeColumnPrimaryKey: PushUndoHistory = (
  undoActions,
  {
    payload: { id, tableId, value },
  }: ReturnType<typeof changeColumnPrimaryKeyAction>,
  { collections }
) => {
  const column = query(collections)
    .collection('tableColumnEntities')
    .selectById(id);
  if (!column) return;

  undoActions.push(
    changeColumnPrimaryKeyAction({
      id,
      tableId,
      value: !value,
    })
  );
};

const changeColumnUnique: PushUndoHistory = (
  undoActions,
  {
    payload: { id, tableId, value },
  }: ReturnType<typeof changeColumnUniqueAction>,
  { collections }
) => {
  const column = query(collections)
    .collection('tableColumnEntities')
    .selectById(id);
  if (!column) return;

  undoActions.push(
    changeColumnUniqueAction({
      id,
      tableId,
      value: !value,
    })
  );
};

export const tableColumnPushUndoHistoryMap = {
  [ActionType.addColumn]: addColumn,
  [ActionType.removeColumn]: removeColumn,
  [ActionType.changeColumnName]: changeColumnName,
  [ActionType.changeColumnDataType]: changeColumnDataType,
  [ActionType.changeColumnDefault]: changeColumnDefault,
  [ActionType.changeColumnComment]: changeComment,
  [ActionType.changeColumnAutoIncrement]: changeColumnAutoIncrement,
  [ActionType.changeColumnNotNull]: changeColumnNotNull,
  [ActionType.changeColumnPrimaryKey]: changeColumnPrimaryKey,
  [ActionType.changeColumnUnique]: changeColumnUnique,
};
