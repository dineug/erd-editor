import { observable } from '@dineug/r-html';

import { RootState } from '@/engine/state';
import { Point } from '@/internal-types';
import { getSceneContentRect } from '@/konva/scene/contentBounds';
import { type Rect } from '@/konva/scene/metrics';
import { getSceneTransform } from '@/konva/scene/viewport';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

type FrozenView = {
  content: Rect | null;
  origin: Point;
};

/**
 * The view of each scene a drag has taken hold of, by the id its editor state
 * mints once and the source the scene draws from: two stores on one page hold
 * their own, and so do the document and a view overlay open over it.
 */
const state = observable({ frozen: {} as Record<string, FrozenView | null> });

/** One scene among every store on the page: its editor's id and the source it draws from. */
export const sceneKeyOf = (root: RootState, source: GeometrySource) =>
  `${root.editor.id}:${source}`;

const frozenOf = (root: RootState, source: GeometrySource): FrozenView | null =>
  state.frozen[sceneKeyOf(root, source)] ?? null;

/**
 * Holds the content rect and the origin where they stand, so everything a drag
 * is watched against, the scroll ranges, both scrollbars and the minimap,
 * stands still together while it lasts and moves together on the drop.
 */
export function freezeView(
  root: RootState,
  source: GeometrySource = 'document'
): void {
  const { originX, originY } = getSceneTransform(root, source);

  state.frozen[sceneKeyOf(root, source)] = {
    content: getSceneContentRect(root, source),
    origin: { x: originX, y: originY },
  };
}

export function thawView(
  root: RootState,
  source: GeometrySource = 'document'
): void {
  Reflect.deleteProperty(state.frozen, sceneKeyOf(root, source));
}

export function isViewFrozen(
  root: RootState,
  source: GeometrySource = 'document'
): boolean {
  return frozenOf(root, source) !== null;
}

/** The content rect a drag began with while one holds this scene's view, else the live one. */
export function getViewContentRect(
  root: RootState,
  source: GeometrySource = 'document'
): Rect | null {
  const frozen = frozenOf(root, source);

  return frozen ? frozen.content : getSceneContentRect(root, source);
}

/**
 * The origin a drag began from while one holds this scene's view, else null.
 * The scroll range keeps it inside its hull for the drag's duration, so the
 * thumb a drag scales against cannot shrink under the pointer as the origin closes in.
 */
export function getFrozenOrigin(
  root: RootState,
  source: GeometrySource = 'document'
): Point | null {
  return frozenOf(root, source)?.origin ?? null;
}
