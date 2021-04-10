import { Store } from '@@types/engine/store';
import { MoveKey } from '@@types/engine/store/editor.state';
import { FocusFilterType } from '@@types/engine/store/editor/filter.state';
import {
  isFilterFocusType,
  isLastFilterColumn,
  isLastRowFilter,
  isFilters,
  getRemoveFirstFilterId,
} from '@/engine/command/helper/editor/filter.focus.helper';
import {
  filterActive,
  filterActiveEnd,
  filterFocus,
  focusFilterEnd,
  addFilter,
  focusFilter,
  focusMoveFilter,
  removeFilter,
} from './filter.cmd.helper';

export function* filterActive$() {
  yield filterActive();
  yield filterFocus();
}

export function* filterActiveEnd$() {
  yield filterActiveEnd();
  yield focusFilterEnd();
}

export function* addFilter$() {
  const addFilterCmd = addFilter();
  yield addFilterCmd;
  yield focusFilter(addFilterCmd.data.id, 'columnType');
}

export function* removeFilter$(
  { editorState: { filterState } }: Store,
  filterIds: string[]
) {
  if (filterState.focus && filterState.focus.filterId) {
    const filterId = getRemoveFirstFilterId(filterState, filterIds);

    if (filterId) {
      yield focusFilter(
        filterId,
        filterState.focus.focusType as FocusFilterType
      );
    } else {
      yield filterFocus();
    }
  }

  yield removeFilter(filterIds);
}

export function* focusMoveFilter$(
  { editorState: { filterState } }: Store,
  moveKey: MoveKey,
  shiftKey: boolean
) {
  const { focus } = filterState;
  if (!focus) return;

  if (
    (moveKey === 'Tab' &&
      !shiftKey &&
      isFilterFocusType(focus.focusType) &&
      isLastFilterColumn(filterState) &&
      isLastRowFilter(filterState)) ||
    (!isFilterFocusType(focus.focusType) && !isFilters(filterState))
  ) {
    yield addFilter$();
  } else {
    yield focusMoveFilter(moveKey, shiftKey);
  }
}
