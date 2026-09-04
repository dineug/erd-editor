import { observable } from '@dineug/r-html';

/**
 * Whether a pointer is moving a selection right now. One pointer means one
 * drag, so the flag is module wide the way the drag stream it follows is.
 */
const state = observable({ active: false });

export function beginEntityDrag(): void {
  state.active = true;
}

export function endEntityDrag(): void {
  state.active = false;
}

/** Reads the flag through the observable, so a scene render tracks it. */
export function isEntityDragActive(): boolean {
  return state.active;
}
