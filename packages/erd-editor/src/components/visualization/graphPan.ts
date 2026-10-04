import { noop } from 'es-toolkit';
import type { KonvaEventObject } from 'konva/lib/Node';

import { captureDrag } from '@/components/visualization/captureDrag';
import type { VisualizationState } from '@/components/visualization/visualizationView';
import { isMiddleButtonPress, isMultiTouch } from '@/utils/domEvent';
import type { DragMove } from '@/utils/globalEventObservable';
import { CURSOR_GRABBING, holdStageCursor } from '@/utils/stageCursor';

/**
 * Pans the graph view with the pointer, in stage px, from a press on the
 * background or a middle press anywhere. A pan is a drag too: a dot the pointer
 * crosses on the way would otherwise open its preview under a busy hand.
 *
 * @example
 * on:mousedown={(event) => captureGraphPan(event, state)}
 */
export function captureGraphPan(
  event: KonvaEventObject<Event>,
  state: VisualizationState
): void {
  if (isMultiTouch(event.evt)) return;

  let release = noop;

  // The middle button pans from a dot as well, so the press is the pan's
  // alone: the browser starts no autoscroll and pastes nothing for it.
  if (isMiddleButtonPress(event.evt)) {
    event.evt.preventDefault();
    const container = event.target.getStage()?.container();
    if (container) release = holdStageCursor(container, CURSOR_GRABBING);
  }

  const handleMove = ({ event: move, movementX, movementY }: DragMove) => {
    move.type === 'mousemove' && move.preventDefault();
    state.x += movementX;
    state.y += movementY;
  };

  state.drag = true;
  captureDrag(event, {
    next: handleMove,
    complete: () => {
      state.drag = false;
      release();
    },
  });
}
