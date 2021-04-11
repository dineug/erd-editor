import { Filter } from '@@types/engine/store/editor/filter.state';
import * as R from 'ramda';
import { getIndex, range } from '@/core/helper';

export const appendSelectFilters = (filterIds: string[], filterId: string) =>
  R.uniq([...filterIds, filterId]);

export function selectRangeFilters(
  filters: Filter[],
  fromFilterId: string | null,
  toFilterId: string
) {
  if (!fromFilterId || fromFilterId === toFilterId) return [toFilterId];

  const fromIndex = getIndex(filters, fromFilterId);
  const toIndex = getIndex(filters, toFilterId);

  if (fromIndex === -1) return [toFilterId];

  return range(fromIndex, toIndex).map(index => filters[index].id);
}

export const appendSelectRangeFilters = (
  filters: Filter[],
  filterIds: string[],
  fromFilterId: string | null,
  toFilterId: string
) =>
  R.uniq([
    ...filterIds,
    ...selectRangeFilters(filters, fromFilterId, toFilterId),
  ]);
