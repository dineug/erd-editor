import { observable } from '@dineug/r-html';

import { RootState } from '@/engine/state';
import { freezeView, thawView } from '@/konva/scene/viewFreeze';

/**
 * Which stores a pointer is moving a selection in right now, by the id their
 * editor state mints once, so a drag in one editor on a page is not read as a
 * drag by the scene of another.
 */
const state = observable({ active: {} as Record<string, boolean> });

/** Raises the flag and holds the view as it stands until endEntityDrag. */
export function beginEntityDrag(root: RootState): void {
  state.active[root.editor.id] = true;
  freezeView(root);
}

export function endEntityDrag(root: RootState): void {
  Reflect.deleteProperty(state.active, root.editor.id);
  thawView(root);
}

/** Reads the flag through the observable, so a scene render tracks it. */
export function isEntityDragActive(root: RootState): boolean {
  return state.active[root.editor.id] === true;
}
