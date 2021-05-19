import {
  FilterState,
  FocusType,
} from '@@types/engine/store/editor/filter.state';
import { FocusMove } from '@@types/engine/command/editor/filter.cmd';
import { focusFilterTypes } from '@/engine/store/editor/filter.state';
import { getIndex } from '@/core/helper';
import { appendSelectFilters } from './filter.helper';

export const isFilterFocusType = (focusType: FocusType) =>
  focusFilterTypes.includes(focusType as any);

export const isFilters = (state: FilterState) => !!state.filters.length;

function isFirstRowFilter({ filters, focus }: FilterState) {
  if (!focus || !focus.filterId) return;
  const index = getIndex(filters, focus.filterId);
  return index === 0;
}

export function isLastRowFilter({ filters, focus }: FilterState) {
  if (!focus || !focus.filterId) return;
  const index = getIndex(filters, focus.filterId);
  return index === filters.length - 1;
}

export function isLastFilterColumn({ focus }: FilterState) {
  if (!focus || !focus.filterId) return;
  const index = focusFilterTypes.indexOf(focus.focusType as any);
  return index === focusFilterTypes.length - 1;
}

function isFirstFilterColumn({ focus }: FilterState) {
  if (!focus || !focus.filterId) return;
  const index = focusFilterTypes.indexOf(focus.focusType as any);
  return index === 0;
}

function getNextRightFilterColumnType(state: FilterState): FocusType {
  const { focus } = state;
  if (!focus || !focus.filterId) return 'columnType';

  const index = focusFilterTypes.indexOf(focus.focusType as any);
  return isLastFilterColumn(state)
    ? focusFilterTypes[0]
    : focusFilterTypes[index + 1];
}

function getNextLeftFilterColumnType(state: FilterState): FocusType {
  const { focus } = state;
  if (!focus || !focus.filterId) return 'columnType';

  const index = focusFilterTypes.indexOf(focus.focusType as any);
  return isFirstFilterColumn(state)
    ? focusFilterTypes[focusFilterTypes.length - 1]
    : focusFilterTypes[index - 1];
}

export function getRemoveFirstFilterId(
  { focus, filters }: FilterState,
  filterIds: string[]
) {
  if (!focus?.filterId) return null;

  const filterIndex = getIndex(filters, focus.filterId);

  if (filterIndex <= 0) return null;

  let filterId = null;
  for (let i = filterIndex; i >= 0; i--) {
    const filter = filters[i];

    if (!filterIds.includes(filter.id)) {
      filterId = filter.id;
      break;
    }
  }

  return filterId;
}

export function arrowUp(state: FilterState, data: FocusMove) {
  const { focus, filters } = state;
  if (!focus) return;

  if (isFilterFocusType(focus.focusType)) {
    if (isFirstRowFilter(state)) {
      focus.focusType = 'operatorType';
      focus.filterId = null;
      focus.prevSelectFilterId = null;
      focus.selectFilterIds = [];
    } else if (focus.filterId) {
      const index = getIndex(filters, focus.filterId);
      const filter = filters[index - 1];

      focus.filterId = filter.id;
      focus.prevSelectFilterId = filter.id;
      if (data.shiftKey && data.moveKey !== 'Tab') {
        focus.selectFilterIds = appendSelectFilters(
          focus.selectFilterIds,
          filter.id
        );
      } else {
        focus.selectFilterIds = [filter.id];
      }
    }
  } else {
    if (isFilters(state)) {
      const filterId = filters[filters.length - 1].id;

      focus.focusType = 'value';
      focus.filterId = filterId;
      focus.prevSelectFilterId = filterId;
      focus.selectFilterIds = [filterId];
    }
  }
}

export function arrowDown(state: FilterState, data: FocusMove) {
  const { focus, filters } = state;
  if (!focus) return;

  if (isFilterFocusType(focus.focusType)) {
    if (isLastRowFilter(state)) {
      focus.focusType = 'operatorType';
      focus.filterId = null;
      focus.prevSelectFilterId = null;
      focus.selectFilterIds = [];
    } else if (focus.filterId) {
      const index = getIndex(filters, focus.filterId);
      const filter = filters[index + 1];

      focus.filterId = filter.id;
      focus.prevSelectFilterId = filter.id;
      if (data.shiftKey && data.moveKey !== 'Tab') {
        focus.selectFilterIds = appendSelectFilters(
          focus.selectFilterIds,
          filter.id
        );
      } else {
        focus.selectFilterIds = [filter.id];
      }
    }
  } else {
    if (isFilters(state)) {
      const filterId = filters[0].id;

      focus.focusType = 'columnType';
      focus.filterId = filterId;
      focus.prevSelectFilterId = filterId;
      focus.selectFilterIds = [filterId];
    }
  }
}

export function arrowRight(state: FilterState, data: FocusMove) {
  const { focus, filters } = state;
  if (!focus) return;

  if (isFilterFocusType(focus.focusType)) {
    if (isLastFilterColumn(state)) {
      if (isLastRowFilter(state)) {
        focus.focusType = 'operatorType';
        focus.filterId = null;
        focus.prevSelectFilterId = null;
        focus.selectFilterIds = [];
      } else if (focus.filterId) {
        const index = getIndex(filters, focus.filterId);
        const filter = filters[index + 1];

        focus.focusType = 'columnType';
        focus.filterId = filter.id;
        focus.prevSelectFilterId = filter.id;
        if (data.shiftKey && data.moveKey !== 'Tab') {
          focus.selectFilterIds = appendSelectFilters(
            focus.selectFilterIds,
            filter.id
          );
        } else {
          focus.selectFilterIds = [filter.id];
        }
      }
    } else {
      focus.focusType = getNextRightFilterColumnType(state);
      if (!data.shiftKey && focus.filterId) {
        focus.prevSelectFilterId = focus.filterId;
        focus.selectFilterIds = [focus.filterId];
      }
    }
  } else {
    if (isFilters(state)) {
      const filterId = filters[0].id;

      focus.focusType = 'columnType';
      focus.filterId = filterId;
      focus.prevSelectFilterId = filterId;
      focus.selectFilterIds = [filterId];
    }
  }
}

export function arrowLeft(state: FilterState, data: FocusMove) {
  const { focus, filters } = state;
  if (!focus) return;

  if (isFilterFocusType(focus.focusType)) {
    if (isFirstFilterColumn(state)) {
      if (isFirstRowFilter(state)) {
        focus.focusType = 'operatorType';
        focus.filterId = null;
        focus.prevSelectFilterId = null;
        focus.selectFilterIds = [];
      } else if (focus.filterId) {
        const index = getIndex(filters, focus.filterId);
        const filter = filters[index - 1];

        focus.focusType = 'value';
        focus.filterId = filter.id;
        focus.prevSelectFilterId = filter.id;
        if (data.shiftKey && data.moveKey !== 'Tab') {
          focus.selectFilterIds = appendSelectFilters(
            focus.selectFilterIds,
            filter.id
          );
        } else {
          focus.selectFilterIds = [filter.id];
        }
      }
    } else {
      focus.focusType = getNextLeftFilterColumnType(state);
      if (!data.shiftKey && focus.filterId) {
        focus.prevSelectFilterId = focus.filterId;
        focus.selectFilterIds = [focus.filterId];
      }
    }
  } else {
    if (isFilters(state)) {
      const filterId = filters[filters.length - 1].id;

      focus.focusType = 'value';
      focus.filterId = filterId;
      focus.prevSelectFilterId = filterId;
      focus.selectFilterIds = [filterId];
    }
  }
}
