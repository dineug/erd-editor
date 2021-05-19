import {
  Focus,
  FocusType,
  Draggable,
} from '@@types/engine/store/editor/filter.state';

export function isFocus(
  focus: Focus | null,
  focusType: FocusType,
  filterId: string | null = null
): boolean {
  if (!focus) return false;

  switch (focusType) {
    case 'operatorType':
      return focusType === focus.focusType;
  }

  return filterId === focus.filterId && focusType === focus.focusType;
}

export function isEdit(
  focus: Focus | null,
  focusType: FocusType,
  filterId: string | null = null
) {
  if (!focus) return false;

  switch (focusType) {
    case 'operatorType':
      return focusType === focus.focusType && focus.edit;
  }

  return (
    filterId === focus.filterId && focusType === focus.focusType && focus.edit
  );
}

export const isSelectFilter = (focus: Focus | null, filterId: string) =>
  focus?.selectFilterIds.includes(filterId);

export const isDraggableFilter = (
  draggable: Draggable | null,
  filterId: string
) => draggable?.filterIds.includes(filterId);
