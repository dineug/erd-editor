import { noop } from 'es-toolkit';

import { isMiddleButtonPress, preventMiddleLift } from '@/utils/domEvent';
import { drag$, type DragMove } from '@/utils/globalEventObservable';
import { forwardMoveStartEvent } from '@/utils/internalEvents';
import { CURSOR_GRABBING, holdStageCursor } from '@/utils/stageCursor';

/**
 * Takes a middle press anywhere in a stage container as a pan, heard in the
 * capture phase before konva or the scene root, and prevents its lift wherever
 * it lands: nothing selects, drags or clicks, and nothing autoscrolls or pastes.
 *
 * @example
 * addUnsubscribe(listenMiddleButtonPan(container, handleMove, handlePress));
 */
export function listenMiddleButtonPan(
  container: HTMLElement,
  onMove: (move: DragMove) => void,
  onPress: () => void = noop
): () => void {
  const handleMousedown = (event: MouseEvent) => {
    if (!isMiddleButtonPress(event)) return;

    event.preventDefault();
    event.stopPropagation();
    onPress();

    // The window never hears a press stopped here, so the move stream is handed
    // it to measure the first step from, or that step would jump by the
    // distance back to wherever the last press was.
    container.dispatchEvent(forwardMoveStartEvent({ originEvent: event }));

    const pan = drag$.subscribe(onMove);
    pan.add(preventMiddleLift());

    // Konva opens its double click window on any lift it hears, so a main click
    // on the same node right after would read as a double one: a lift over the
    // scene ends the pan here and goes no further.
    const handleMouseup = (lift: MouseEvent) => {
      if (!isMiddleButtonPress(lift)) return;

      lift.stopPropagation();
      pan.unsubscribe();
    };

    container.addEventListener('mouseup', handleMouseup, true);
    pan.add(holdStageCursor(container, CURSOR_GRABBING));
    pan.add(() => {
      container.removeEventListener('mouseup', handleMouseup, true);
    });
  };

  container.addEventListener('mousedown', handleMousedown, true);

  return () => {
    container.removeEventListener('mousedown', handleMousedown, true);
  };
}
