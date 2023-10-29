import { uniq } from 'lodash-es';

import { safeRange } from '@/utils';

export function appendSelectColumns(columnIds: string[], columnId: string) {
  return uniq([...columnIds, columnId]);
}

export function selectRangeColumns(
  columnIds: string[],
  fromColumnId: string | null,
  toColumnId: string
) {
  if (!fromColumnId || fromColumnId === toColumnId) return [toColumnId];

  const fromIndex = columnIds.indexOf(fromColumnId);
  const toIndex = columnIds.indexOf(toColumnId);

  if (fromIndex === -1) return [toColumnId];

  return safeRange(fromIndex, toIndex).map(index => columnIds[index]);
}

export function appendSelectRangeColumns(
  columnIds: string[],
  selectColumnIds: string[],
  fromColumnId: string | null,
  toColumnId: string
) {
  return uniq([
    ...selectColumnIds,
    ...selectRangeColumns(columnIds, fromColumnId, toColumnId),
  ]);
}
