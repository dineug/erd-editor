import { take } from 'rxjs';

import type { Point } from '@/internal-types';
import { isMouseEvent, isMultiTouch } from '@/utils/domEvent';
import { moveEnd$ } from '@/utils/globalEventObservable';
import { isMod } from '@/utils/keyboard-shortcut';

/** How far a press may travel before its release reads as a drag rather than a click, in screen pixels. */
export const CLICK_SLOP = 4;

/** Where a pointer event landed: the mouse, or the touch it began with or lifted. */
export function pointOf(evt: Event): Point | null {
  if (isMouseEvent(evt)) {
    return { x: evt.clientX, y: evt.clientY };
  }

  const { touches, changedTouches } = evt as TouchEvent;
  const touch = touches?.[0] ?? changedTouches?.[0];

  return touch ? { x: touch.clientX, y: touch.clientY } : null;
}

/**
 * The end of a gesture that is a lift, as against a native drag, a cancelled
 * pointer or a blurred window. A touch lifts once its last finger does, since
 * a finger still down means a pinch, whose lift is no click.
 */
const isLift = (evt: Event) =>
  evt.type === 'mouseup' ||
  (evt.type === 'touchend' && !(evt as TouchEvent).touches?.length);

/** Whether a release landed near enough to the press to read as a click rather than a drag. */
export function isClick(from: Point, to: Point): boolean {
  return (
    Math.abs(to.x - from.x) <= CLICK_SLOP &&
    Math.abs(to.y - from.y) <= CLICK_SLOP
  );
}

/** A press with the main button and no modifier, the only one a view reads as a click. */
export function isPlainPress(evt: MouseEvent | TouchEvent): boolean {
  return !isMod(evt) && (!isMouseEvent(evt) || evt.button === 0);
}

/**
 * Calls back once the press given is released as a click. The release is read
 * off the window rather than off the node pressed, since the scene rebuilds
 * that node before the lift, and a press with no point to measure reads as nothing.
 *
 * @example
 * onClickRelease(event.evt, () => setViewPinnedTable(store.state, id, kind));
 */
export function onClickRelease(evt: Event, done: () => void): void {
  const from = pointOf(evt);
  if (!from || isMultiTouch(evt)) return;

  moveEnd$.pipe(take(1)).subscribe(end => {
    const to = isLift(end) ? pointOf(end) : null;
    if (to && isClick(from, to)) done();
  });
}
