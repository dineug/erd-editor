import { uuid } from '@/core/helper';
import { Index, OrderType } from '@@types/engine/store/table.state';

import { createCommand } from './helper';

export const addIndex = (tableId: string) =>
  createCommand('index.add', {
    id: uuid(),
    tableId,
  });

export const removeIndex = (indexIds: string[]) =>
  createCommand('index.remove', {
    indexIds,
  });

export const changeIndexName = (indexId: string, value: string) =>
  createCommand('index.changeName', {
    indexId,
    value,
  });

export const changeIndexUnique = (indexId: string, value: boolean) =>
  createCommand('index.changeUnique', {
    indexId,
    value,
  });

export const addIndexColumn = (indexId: string, columnId: string) =>
  createCommand('index.addColumn', {
    indexId,
    columnId,
  });

export const removeIndexColumn = (indexId: string, columnId: string) =>
  createCommand('index.removeColumn', {
    indexId,
    columnId,
  });

export const moveIndexColumn = (
  indexId: string,
  columnId: string,
  targetColumnId: string
) =>
  createCommand('index.moveColumn', {
    indexId,
    columnId,
    targetColumnId,
  });

export const changeIndexColumnOrderType = (
  indexId: string,
  columnId: string,
  value: OrderType
) =>
  createCommand('index.changeColumnOrderType', {
    indexId,
    columnId,
    value,
  });

export const loadIndex = (index: Index) => createCommand('index.load', index);
