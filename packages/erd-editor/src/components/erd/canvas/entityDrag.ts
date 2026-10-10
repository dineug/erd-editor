import { observable } from '@dineug/r-html';

import type { HeldTableGroupBoxes } from '@/engine/modules/table-group/generator.actions';
import { RootState } from '@/engine/state';
import { freezeView, sceneKeyOf, thawView } from '@/konva/scene/viewFreeze';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { getTableGroupRects, isTableGroupShown } from '@/utils/tableGroup';

/**
 * Which scenes a pointer is moving a selection in, and which of those drags travelled the click
 * distance, by the id their editor state mints once and the source they draw from, so a drag in
 * one editor on a page, or in a view over the document, is not read by another's scene.
 */
const state = observable({
  active: {} as Record<string, boolean>,
  travelled: {} as Record<string, boolean>,
});

/**
 * The group boxes each drag began with, by scene. Read only while the flag
 * stands, which is raised after them and taken down before them, so the flag
 * is what a render tracks.
 */
const heldBoxes = new Map<string, HeldTableGroupBoxes>();

/**
 * Raises the flag, holds the scene's view as it stands until endEntityDrag,
 * and, in the document while groups show, the box each group shows.
 */
export function beginEntityDrag(
  root: RootState,
  source: GeometrySource = 'document'
): void {
  const key = sceneKeyOf(root, source);

  heldBoxes.set(
    key,
    source === 'document' && isTableGroupShown(root)
      ? getTableGroupRects(root)
      : new Map()
  );
  state.active[key] = true;
  freezeView(root, source);
}

export function endEntityDrag(
  root: RootState,
  source: GeometrySource = 'document'
): void {
  const key = sceneKeyOf(root, source);

  Reflect.deleteProperty(state.active, key);
  Reflect.deleteProperty(state.travelled, key);
  heldBoxes.delete(key);
  thawView(root, source);
}

/** Reads the flag through the observable, so a scene render tracks it. */
export function isEntityDragActive(
  root: RootState,
  source: GeometrySource = 'document'
): boolean {
  return state.active[sceneKeyOf(root, source)] === true;
}

/**
 * Marks the drag as past the click distance from its press, after which its
 * drop is judged and a drop target shown: a tremor short of it changes no group.
 */
export function markEntityDragTravelled(
  root: RootState,
  source: GeometrySource = 'document'
): void {
  const key = sceneKeyOf(root, source);
  if (state.active[key]) state.travelled[key] = true;
}

/** Whether the drag the scene holds has travelled the click distance, tracked as the flag is. */
export function hasEntityDragTravelled(
  root: RootState,
  source: GeometrySource = 'document'
): boolean {
  return state.travelled[sceneKeyOf(root, source)] === true;
}

/**
 * The box each group showed as the scene's drag began, or null while no drag
 * holds it: what a group the drag leaves standing is drawn and judged in.
 */
export function getHeldTableGroupBoxes(
  root: RootState,
  source: GeometrySource = 'document'
): HeldTableGroupBoxes | null {
  // The flag first, so a render asking before a drag tracks its start.
  const active = isEntityDragActive(root, source);
  const held = heldBoxes.get(sceneKeyOf(root, source));
  return active && held ? held : null;
}
