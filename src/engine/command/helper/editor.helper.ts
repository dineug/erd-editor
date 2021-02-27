import { Column } from '@@types/engine/store/table.state';
import * as R from 'ramda';
import { getIndex, range } from '@/core/helper';

export const appendSelectColumns = (columnIds: string[], columnId: string) =>
  R.uniq([...columnIds, columnId]);

export function selectRangeColumns(
  columns: Column[],
  fromColumnId: string | null,
  toColumnId: string
) {
  if (!fromColumnId || fromColumnId === toColumnId) return [toColumnId];

  const fromIndex = getIndex(columns, fromColumnId);
  const toIndex = getIndex(columns, toColumnId);

  if (fromIndex === -1) return [toColumnId];

  return range(fromIndex, toIndex).map(index => columns[index].id);
}

export const appendSelectRangeColumns = (
  columns: Column[],
  columnIds: string[],
  fromColumnId: string | null,
  toColumnId: string
) =>
  R.uniq([
    ...columnIds,
    ...selectRangeColumns(columns, fromColumnId, toColumnId),
  ]);
