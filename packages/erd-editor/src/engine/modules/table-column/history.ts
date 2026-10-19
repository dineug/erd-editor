import { query } from '@dineug/erd-editor-schema';

import { ColumnOption } from '@/constants/schema';
import { PushUndoHistory } from '@/engine/history.actions';
import { bHas } from '@/utils/bit';

import { ActionType } from './actions';
import {
  addColumnAction,
  changeColumnAutoIncrementAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnDomainAction,
  changeColumnLogicalNameAction,
  changeColumnNameAction,
  changeColumnNameDerivedAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
  moveColumnAction,
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

const changeColumnLogicalName: PushUndoHistory = (
  undoActions,
  {
    payload: { id, tableId },
  }: ReturnType<typeof changeColumnLogicalNameAction>,
  { collections }
) => {
  const column = query(collections)
    .collection('tableColumnEntities')
    .selectById(id);
  if (!column) return;

  undoActions.push(
    changeColumnLogicalNameAction({ id, tableId, value: column.logicalName })
  );
};

const changeColumnDomain: PushUndoHistory = (
  undoActions,
  { payload: { id, tableId } }: ReturnType<typeof changeColumnDomainAction>,
  { collections }
) => {
  const column = query(collections)
    .collection('tableColumnEntities')
    .selectById(id);
  if (!column) return;

  undoActions.push(
    changeColumnDomainAction({ id, tableId, value: column.domainId })
  );
};

/**
 * Undoes with the bit the column held before the batch, unlike the other
 * option bits' negation, so an undo of a write that changed nothing keeps it.
 */
const changeColumnNameDerived: PushUndoHistory = (
  undoActions,
  {
    payload: { id, tableId },
  }: ReturnType<typeof changeColumnNameDerivedAction>,
  { collections }
) => {
  const column = query(collections)
    .collection('tableColumnEntities')
    .selectById(id);
  if (!column) return;

  undoActions.push(
    changeColumnNameDerivedAction({
      id,
      tableId,
      value: bHas(column.options, ColumnOption.nameDerived),
    })
  );
};

const moveColumn: PushUndoHistory = (
  undoActions,
  { payload: { id, tableId, targetId } }: ReturnType<typeof moveColumnAction>,
  { collections }
) => {
  const table = query(collections)
    .collection('tableEntities')
    .selectById(tableId);
  if (!table) return;

  const index = table.columnIds.indexOf(id);
  if (index === -1) return;

  const targetIndex = table.columnIds.indexOf(targetId);
  if (targetIndex === -1) return;

  const revertIndex = index < targetIndex ? index + 1 : index - 1;
  const newTargetId = table.columnIds[revertIndex];

  undoActions.push(
    moveColumnAction({
      id,
      tableId,
      targetId: newTargetId,
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
  [ActionType.moveColumn]: moveColumn,
  [ActionType.changeColumnLogicalName]: changeColumnLogicalName,
  [ActionType.changeColumnDomain]: changeColumnDomain,
  [ActionType.changeColumnNameDerived]: changeColumnNameDerived,
};
