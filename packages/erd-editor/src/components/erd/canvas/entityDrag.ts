import { observable } from '@dineug/r-html';

import { RootState } from '@/engine/state';
import { freezeView, sceneKeyOf, thawView } from '@/konva/scene/viewFreeze';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

/**
 * Which scenes a pointer is moving a selection in right now, by the id their
 * editor state mints once and the source they draw from, so a drag in one
 * editor on a page, or in a view over the document, is not read by another's scene.
 */
const state = observable({ active: {} as Record<string, boolean> });

/** Raises the flag and holds the scene's view as it stands until endEntityDrag. */
export function beginEntityDrag(
  root: RootState,
  source: GeometrySource = 'document'
): void {
  state.active[sceneKeyOf(root, source)] = true;
  freezeView(root, source);
}

export function endEntityDrag(
  root: RootState,
  source: GeometrySource = 'document'
): void {
  Reflect.deleteProperty(state.active, sceneKeyOf(root, source));
  thawView(root, source);
}

/** Reads the flag through the observable, so a scene render tracks it. */
export function isEntityDragActive(
  root: RootState,
  source: GeometrySource = 'document'
): boolean {
  return state.active[sceneKeyOf(root, source)] === true;
}
