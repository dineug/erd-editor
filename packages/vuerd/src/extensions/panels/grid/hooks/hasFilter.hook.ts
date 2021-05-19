import { FocusType } from '@@types/engine/store/editor/filter.state';
import { useContext } from '@/extensions/panels/grid/hooks/context.hook';
import {
  isFocus,
  isEdit,
  isSelectFilter,
  isDraggableFilter,
} from '@/engine/store/helper/editor/filter.helper';

export function useHasFilter(ctx: HTMLElement) {
  const contextRef = useContext(ctx);

  const getFocus = () =>
    contextRef.value.api.store.editorState.filterState.focus;

  const hasFocusState = (focusType: FocusType, filterId?: string) =>
    isFocus(getFocus(), focusType, filterId);

  const hasEdit = (focusType: FocusType, filterId?: string) =>
    isEdit(getFocus(), focusType, filterId);

  const hasSelectFilter = (filterId: string) =>
    isSelectFilter(getFocus(), filterId);

  const hasDraggableFilter = (filterId: string) => {
    const draggable =
      contextRef.value.api.store.editorState.filterState.draggable;
    return isDraggableFilter(draggable, filterId);
  };

  return {
    hasFocusState,
    hasEdit,
    hasSelectFilter,
    hasDraggableFilter,
  };
}
