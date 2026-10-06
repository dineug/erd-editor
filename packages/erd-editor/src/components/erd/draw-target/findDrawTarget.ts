import { query } from '@dineug/erd-editor-schema';

import type { RootState } from '@/engine/state';
import type { Point } from '@/internal-types';
import { getMemoRect, getTableRect, type Rect } from '@/konva/scene/metrics';
import {
  getCullingRect,
  getSceneTransform,
  isMemoVisible,
  isTableVisible,
  toScenePoint,
} from '@/konva/scene/viewport';

/**
 * How far the pointer travels from the press that started a draw, in screen
 * pixels whatever the zoom, before the table the draw starts from offers the
 * buttons too: a press there sooner draws a self reference as it always has.
 */
export const SELF_REFERENCE_TRAVEL = 24;

export const hasTravelled = (from: Point, to: Point) =>
  Math.hypot(to.x - from.x, to.y - from.y) >= SELF_REFERENCE_TRAVEL;

/** Edges included, so a point on a border belongs to the box it bounds. */
export const containsPoint = (rect: Rect, { x, y }: Point) =>
  x >= rect.x &&
  x <= rect.x + rect.width &&
  y >= rect.y &&
  y <= rect.y + rect.height;

type Stacked = { ui: { zIndex: number } };

/** The canvas paints its tables in this order, a stable sort over the document's list. */
const byZIndex = (a: Stacked, b: Stacked) => a.ui.zIndex - b.ui.zIndex;

export type DrawTargetQuery = {
  /** The pointer in screen pixels from the top left of the canvas root. */
  pointer: Point;
  startTableId: string;
  selfArmed: boolean;
  /** The table the buttons stand beside now. */
  current: string | null;
  /** The buttons and the gutter beside them, in screen pixels, over which the current table stays. */
  keep: readonly Rect[];
};

/**
 * The table a press under the pointer would draw to, by arithmetic, since konva
 * raises no hover at a low zoom or over the buttons: top first, the reverse of
 * the canvas's paint order, and none under a memo, which takes the press.
 */
export function findDrawTarget(
  state: RootState,
  { pointer, startTableId, selfArmed, current, keep }: DrawTargetQuery
): string | null {
  const { doc, collections } = state;

  if (
    current &&
    doc.tableIds.includes(current) &&
    keep.some(rect => containsPoint(rect, pointer))
  ) {
    return current;
  }

  const scene = toScenePoint(getSceneTransform(state, 'document'), pointer);
  const culling = getCullingRect(state, 'document');

  const onMemo = query(collections)
    .collection('memoEntities')
    .selectByIds(doc.memoIds)
    .some(
      memo =>
        isMemoVisible(culling, memo) && containsPoint(getMemoRect(memo), scene)
    );
  if (onMemo) return null;

  const top = query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds)
    .filter(table => isTableVisible(culling, state, table))
    .sort(byZIndex)
    .reverse()
    .find(table => containsPoint(getTableRect(state, table), scene));

  if (!top) return null;
  if (top.id === startTableId && !selfArmed) return null;

  return top.id;
}
