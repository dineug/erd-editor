import {
  FocusFilterState,
  FocusFilterStateKey,
  focusFilterStateKeyFocusTypeKeyMap,
} from "../model/FocusFilterStateModel";
import { FocusFilter } from "../model/FocusFilterModel";

export function focusFilterStateEnd(focusFilterStateList: FocusFilterState[]) {
  focusFilterStateList.forEach((focusFilterState) => {
    Object.keys(focusFilterStateKeyFocusTypeKeyMap).forEach((key) => {
      const k = key as FocusFilterStateKey;
      focusFilterState[k] = false;
    });
  });
}

export function focusEnd(focusFilter: FocusFilter) {
  focusFilter.focusFilterOperatorType = false;
  focusFilterStateEnd(focusFilter.focusFilterStateList);
}

export function selectEndFilterState(focusFilterStateList: FocusFilterState[]) {
  focusFilterStateList.forEach(
    (focusFilterState) => (focusFilterState.select = false)
  );
}

export function selectAllFilterState(focusFilterStateList: FocusFilterState[]) {
  focusFilterStateList.forEach(
    (focusFilterState) => (focusFilterState.select = true)
  );
}
