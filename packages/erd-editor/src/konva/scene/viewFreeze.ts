import { observable } from '@dineug/r-html';

import { RootState } from '@/engine/state';
import { Point } from '@/internal-types';
import { getContentRect } from '@/konva/scene/contentBounds';
import { type Rect } from '@/konva/scene/metrics';

type FrozenView = {
  content: Rect | null;
  origin: Point;
};

/**
 * The view of each store a drag has taken hold of, by the id its editor state
 * mints once. Two stores on one page, a diff viewer's two panes say, each hold
 * their own, and a render that read one runs again when that one lets go.
 */
const state = observable({ frozen: {} as Record<string, FrozenView | null> });

const keyOf = (root: RootState) => root.editor.id;

const frozenOf = (root: RootState): FrozenView | null =>
  state.frozen[keyOf(root)] ?? null;

/**
 * Holds the content rect and the origin where they stand, so everything a drag
 * is watched against, the scroll ranges, both scrollbars and the minimap,
 * stands still together while it lasts and moves together on the drop.
 */
export function freezeView(root: RootState): void {
  const { originX, originY } = root.settings;

  state.frozen[keyOf(root)] = {
    content: getContentRect(root),
    origin: { x: originX, y: originY },
  };
}

export function thawView(root: RootState): void {
  Reflect.deleteProperty(state.frozen, keyOf(root));
}

export function isViewFrozen(root: RootState): boolean {
  return frozenOf(root) !== null;
}

/** The content rect a drag began with while one holds this store's view, else the live one. */
export function getViewContentRect(root: RootState): Rect | null {
  const frozen = frozenOf(root);

  return frozen ? frozen.content : getContentRect(root);
}

/**
 * The origin a drag began from while one holds this store's view, else null.
 * The scroll range keeps it inside its hull for the drag's duration, so the
 * thumb a drag scales against cannot shrink under the pointer as the origin closes in.
 */
export function getFrozenOrigin(root: RootState): Point | null {
  return frozenOf(root)?.origin ?? null;
}
