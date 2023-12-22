import { getData, getIndex } from '@/core/helper';
import {
  arrowDown,
  arrowLeft,
  arrowRight,
  arrowUp,
} from '@/engine/command/helper/editor/filter.focus.helper';
import {
  appendSelectFilters,
  appendSelectRangeFilters,
  selectRangeFilters,
} from '@/engine/command/helper/editor/filter.helper';
import { FilterModel } from '@/engine/store/models/filter.model';
import { ExecuteCommand } from '@/internal-types/command';
import {
  AddFilter,
  changeFilterCode,
  ChangeFilterColumnType,
  ChangeFilterValue,
  ChangeOperatorType,
  FilterCommandMap,
  Focus,
  FocusFilter,
  FocusMove,
  MoveFilter,
  RemoveFilter,
} from '@@types/engine/command/editor/filter.cmd';
import { State } from '@@types/engine/store';
import { Draggable, Filter } from '@@types/engine/store/editor/filter.state';

export function executeFilterActive({ editorState: { filterState } }: State) {
  filterState.active = true;
}

export function executeFilterActiveEnd({
  editorState: { filterState },
}: State) {
  filterState.active = false;
}

export function executeAddFilter(
  {
    editorState: {
      filterState: { filters },
    },
  }: State,
  data: AddFilter
) {
  filters.push(new FilterModel({ addFilter: data }));
}

export function executeRemoveFilter(
  {
    editorState: {
      filterState: { filters },
    },
  }: State,
  data: RemoveFilter
) {
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i];

    if (data.filterIds.includes(filter.id)) {
      filters.splice(i, 1);
      i--;
    }
  }
}

export function executeChangeFilterColumnType(
  {
    editorState: {
      filterState: { filters },
    },
  }: State,
  data: ChangeFilterColumnType
) {
  const filter = getData(filters, data.filterId);
  if (!filter) return;

  filter.columnType = data.columnType;
}

export function executeChangeFilterCode(
  {
    editorState: {
      filterState: { filters },
    },
  }: State,
  data: changeFilterCode
) {
  const filter = getData(filters, data.filterId);
  if (!filter) return;

  filter.filterCode = data.filterCode;
}

export function executeChangeFilterValue(
  {
    editorState: {
      filterState: { filters },
    },
  }: State,
  data: ChangeFilterValue
) {
  const filter = getData(filters, data.filterId);
  if (!filter) return;

  filter.value = data.value;
}

export function executeMoveFilter(
  {
    editorState: {
      filterState: { filters },
    },
  }: State,
  data: MoveFilter
) {
  const currentFilters: Filter[] = [];

  data.filterIds.forEach(filterId => {
    const filter = getData(filters, filterId);

    filter && currentFilters.push(filter);
  });

  const targetFilter = getData(filters, data.targetFilterId);

  if (
    !currentFilters.length ||
    !targetFilter ||
    data.filterIds.includes(data.targetFilterId)
  )
    return;

  const targetIndex = getIndex(filters, targetFilter.id);
  if (targetIndex === -1) return;

  currentFilters.forEach(currentFilter => {
    const currentIndex = getIndex(filters, currentFilter.id);
    if (currentIndex === -1) return;

    filters.splice(currentIndex, 1);
  });

  filters.splice(targetIndex, 0, ...currentFilters);
}

export function executeChangeFilterOperatorType(
  { editorState: { filterState } }: State,
  data: ChangeOperatorType
) {
  filterState.operatorType = data.operatorType;
}

export function executeFilterFocus(
  { editorState: { filterState } }: State,
  data: Focus
) {
  if (filterState.focus) {
    filterState.focus.focusType = 'operatorType';
    filterState.focus.filterId = null;
    filterState.focus.prevSelectFilterId = null;
    filterState.focus.selectFilterIds = [];
  } else {
    filterState.focus = {
      focusType: 'operatorType',
      filterId: null,
      prevSelectFilterId: null,
      selectFilterIds: [],
      edit: false,
    };
  }
}

export function executeFocusFilter(
  { editorState: { filterState } }: State,
  data: FocusFilter
) {
  if (filterState.focus) {
    const focus = filterState.focus;
    focus.filterId = data.filterId;
    focus.focusType = data.focusType;

    if (data.ctrlKey && data.shiftKey) {
      focus.selectFilterIds = appendSelectRangeFilters(
        filterState.filters,
        focus.selectFilterIds,
        focus.prevSelectFilterId,
        focus.filterId
      );
    } else if (data.shiftKey) {
      focus.selectFilterIds = selectRangeFilters(
        filterState.filters,
        focus.prevSelectFilterId,
        focus.filterId
      );
    } else if (data.ctrlKey) {
      focus.selectFilterIds = appendSelectFilters(
        focus.selectFilterIds,
        data.filterId
      );
    } else {
      focus.selectFilterIds = [data.filterId];
    }

    focus.prevSelectFilterId = data.filterId;
  } else {
    filterState.focus = {
      focusType: data.focusType,
      filterId: data.filterId,
      prevSelectFilterId: data.filterId,
      selectFilterIds: [data.filterId],
      edit: false,
    };
  }
}

export function executeFocusFilterEnd({ editorState: { filterState } }: State) {
  filterState.focus = null;
}

export function executeFocusMoveFilter(
  { editorState: { filterState } }: State,
  data: FocusMove
) {
  if (!filterState.focus) return;
  filterState.focus.edit = false;

  switch (data.moveKey) {
    case 'ArrowUp':
      arrowUp(filterState, data);
      break;
    case 'ArrowDown':
      arrowDown(filterState, data);
      break;
    case 'ArrowLeft':
      arrowLeft(filterState, data);
      break;
    case 'ArrowRight':
      arrowRight(filterState, data);
      break;
    case 'Tab':
      data.shiftKey
        ? arrowLeft(filterState, data)
        : arrowRight(filterState, data);
      break;
  }
}

export function executeEditFilter({
  editorState: {
    filterState: { focus },
  },
}: State) {
  if (!focus) return;
  focus.edit = true;
}

export function executeEditFilterEnd({
  editorState: {
    filterState: { focus },
  },
}: State) {
  if (!focus) return;
  focus.edit = false;
}

export function executeSelectAllFilter({
  editorState: {
    filterState: { focus, filters },
  },
}: State) {
  if (!focus) return;
  focus.selectFilterIds = filters.map(filter => filter.id);
}

export function executeDraggableFilter(
  { editorState: { filterState } }: State,
  data: Draggable
) {
  filterState.draggable = data;
}

export function executeDraggableFilterEnd({
  editorState: { filterState },
}: State) {
  filterState.draggable = null;
}

export const executeFilterCommandMap: Record<
  keyof FilterCommandMap,
  ExecuteCommand
> = {
  'editor.filter.active': executeFilterActive,
  'editor.filter.activeEnd': executeFilterActiveEnd,
  'editor.filter.add': executeAddFilter,
  'editor.filter.remove': executeRemoveFilter,
  'editor.filter.changeColumnType': executeChangeFilterColumnType,
  'editor.filter.changeFilterCode': executeChangeFilterCode,
  'editor.filter.changeValue': executeChangeFilterValue,
  'editor.filter.move': executeMoveFilter,
  'editor.filter.changeOperatorType': executeChangeFilterOperatorType,
  'editor.filter.focus': executeFilterFocus,
  'editor.filter.focusFilter': executeFocusFilter,
  'editor.filter.focusEnd': executeFocusFilterEnd,
  'editor.filter.focusMove': executeFocusMoveFilter,
  'editor.filter.edit': executeEditFilter,
  'editor.filter.editEnd': executeEditFilterEnd,
  'editor.filter.selectAll': executeSelectAllFilter,
  'editor.filter.draggable': executeDraggableFilter,
  'editor.filter.draggableEnd': executeDraggableFilterEnd,
};
