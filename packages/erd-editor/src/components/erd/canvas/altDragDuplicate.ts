import type { AppContext } from '@/components/appContext';
import { SelectType } from '@/engine/modules/editor/state';
import { selectMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { selectTableAction$ } from '@/engine/modules/table/generator.actions';
import { isMouseEvent } from '@/utils/domEvent';
import { duplicateDragStartAction } from '@/utils/emitter';

export function tryStartAltDragDuplicate(
  app: AppContext,
  event: MouseEvent | TouchEvent,
  entityId: string,
  selectType: SelectType
): boolean {
  if (!isMouseEvent(event) || !event.altKey || event.button !== 0) {
    return false;
  }

  const { store, emitter } = app;

  if (!store.state.editor.selectedMap[entityId]) {
    store.dispatchSync(
      selectType === SelectType.memo
        ? selectMemoAction$(entityId, false)
        : selectTableAction$(entityId, false)
    );
  }

  event.preventDefault();
  emitter.emit(duplicateDragStartAction());

  return true;
}
