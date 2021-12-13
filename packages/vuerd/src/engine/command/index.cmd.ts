import { getData, getIndex } from '@/core/helper';
import { IndexModel } from '@/engine/store/models/index.model';
import { ExecuteCommand } from '@/internal-types/command';
import { IndexCommandMap } from '@@types/engine/command/index.cmd';
import {
  AddIndex,
  AddIndexColumn,
  ChangeIndexColumnOrderType,
  ChangeIndexUnique,
  ChangeIndexValue,
  MoveIndexColumn,
  RemoveIndex,
  RemoveIndexColumn,
} from '@@types/engine/command/index.cmd';
import { State } from '@@types/engine/store';
import { Index } from '@@types/engine/store/table.state';

export function executeAddIndex(
  { tableState: { indexes } }: State,
  data: AddIndex
) {
  indexes.push(new IndexModel({ addIndex: data }));
}

export function executeRemoveIndex(
  { tableState: { indexes } }: State,
  data: RemoveIndex
) {
  for (let i = 0; i < indexes.length; i++) {
    const id = indexes[i].id;

    if (data.indexIds.includes(id)) {
      indexes.splice(i, 1);
      i--;
    }
  }
}

export function executeChangeIndexName(
  { tableState: { indexes } }: State,
  data: ChangeIndexValue
) {
  const index = getData(indexes, data.indexId);
  if (!index) return;

  index.name = data.value;
}

export function executeChangeIndexUnique(
  { tableState: { indexes } }: State,
  data: ChangeIndexUnique
) {
  const index = getData(indexes, data.indexId);
  if (!index) return;

  index.unique = data.value;
}

export function executeAddIndexColumn(
  { tableState: { indexes } }: State,
  data: AddIndexColumn
) {
  const index = getData(indexes, data.indexId);
  if (!index || index.columns.some(column => column.id === data.columnId))
    return;

  index.columns.push({
    id: data.columnId,
    orderType: 'ASC',
  });
}

export function executeRemoveIndexColumn(
  { tableState: { indexes } }: State,
  data: RemoveIndexColumn
) {
  const index = getData(indexes, data.indexId);
  if (!index) return;

  const targetIndex = getIndex(index.columns, data.columnId);
  if (targetIndex === -1) return;

  index.columns.splice(targetIndex, 1);
}

export function executeMoveIndexColumn(
  { tableState: { indexes } }: State,
  data: MoveIndexColumn
) {
  const index = getData(indexes, data.indexId);
  if (!index || data.columnId === data.targetColumnId) return;

  const currentColumn = getData(index.columns, data.columnId);
  if (!currentColumn) return;

  const currentIndex = getIndex(index.columns, data.columnId);
  if (currentIndex === -1) return;

  const targetIndex = getIndex(index.columns, data.targetColumnId);
  if (targetIndex === -1) return;

  index.columns.splice(currentIndex, 1);
  index.columns.splice(targetIndex, 0, currentColumn);
}

export function executeChangeIndexColumnOrderType(
  { tableState: { indexes } }: State,
  data: ChangeIndexColumnOrderType
) {
  const index = getData(indexes, data.indexId);
  if (!index) return;

  const column = getData(index.columns, data.columnId);
  if (!column) return;

  column.orderType = data.value;
}

export function executeLoadIndex(
  { tableState: { indexes } }: State,
  data: Index
) {
  indexes.push(new IndexModel({ loadIndex: data }));
}

export const executeIndexCommandMap: Record<
  keyof IndexCommandMap,
  ExecuteCommand
> = {
  'index.add': executeAddIndex,
  'index.remove': executeRemoveIndex,
  'index.changeName': executeChangeIndexName,
  'index.changeUnique': executeChangeIndexUnique,
  'index.addColumn': executeAddIndexColumn,
  'index.removeColumn': executeRemoveIndexColumn,
  'index.moveColumn': executeMoveIndexColumn,
  'index.changeColumnOrderType': executeChangeIndexColumnOrderType,
  'index.load': executeLoadIndex,
};
