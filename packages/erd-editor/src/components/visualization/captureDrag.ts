import type { KonvaEventObject } from 'konva/lib/Node';
import type { Subscription } from 'rxjs';

import { drag$, type DragMove } from '@/utils/globalEventObservable';

export type CapturedDragObserver = {
  next: (move: DragMove) => void;
  complete: () => void;
};

/**
 * Follows a drag pressed on a konva shape, holding the pointer on that shape
 * until the lift. Konva tests a move against the hit graph the last draw left,
 * so a pointer faster than a draw would otherwise leave the shape it holds.
 */
export function captureDrag(
  event: KonvaEventObject<Event>,
  { next, complete }: CapturedDragObserver
): Subscription {
  const { target, pointerId } = event;
  target.setPointerCapture(pointerId);

  return drag$.subscribe({
    next,
    complete: () => {
      // Konva lets go only on a lift over its own stage, and every stage on
      // the page shares what it holds, so a lift anywhere else is released here.
      target.hasPointerCapture(pointerId) && target.releaseCapture(pointerId);
      complete();
    },
  });
}
