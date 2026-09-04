import { RootState } from '@/engine/state';
import { Memo, Point, Relationship, Settings, Table } from '@/internal-types';
import { getMemoRect, getTableRect, type Rect } from '@/konva/scene/metrics';
import { getZoomViewport } from '@/utils/dragSelect';
import { getRouteBBox } from '@/utils/draw-relationship';

export type CullingRect = Rect;

/** The scroll, the zoom and the canvas box every scene layer is placed with. */
export type SceneTransform = Pick<
  Settings,
  'width' | 'height' | 'scrollLeft' | 'scrollTop' | 'zoomLevel'
>;

export type CullingRectOptions = SceneTransform & {
  viewportWidth: number;
  viewportHeight: number;
};

/**
 * Where a scene layer sits on the stage, so screen equals scene times the zoom
 * plus this. The css transform it replaces scaled about the middle of the canvas
 * box, so half the shrink travels with the scroll instead of riding on the scale.
 */
export function getSceneOrigin({
  width,
  height,
  scrollLeft,
  scrollTop,
  zoomLevel,
}: SceneTransform): Point {
  const zoomViewport = getZoomViewport(width, height, zoomLevel);

  return { x: scrollLeft + zoomViewport.x, y: scrollTop + zoomViewport.y };
}

/** A zoom of zero would invert to nothing, and only a torn frame reports one. */
const safeZoom = (zoomLevel: number) => (zoomLevel > 0 ? zoomLevel : 1);

/** Where a scene point lands on the stage, the placement above read forwards. */
export function toScreenPoint(transform: SceneTransform, point: Point): Point {
  const origin = getSceneOrigin(transform);

  return {
    x: origin.x + point.x * transform.zoomLevel,
    y: origin.y + point.y * transform.zoomLevel,
  };
}

/** The scene point under a point on the stage, that same placement inverted. */
export function toScenePoint(transform: SceneTransform, point: Point): Point {
  const zoomLevel = safeZoom(transform.zoomLevel);
  const origin = getSceneOrigin({ ...transform, zoomLevel });

  return {
    x: (point.x - origin.x) / zoomLevel,
    y: (point.y - origin.y) / zoomLevel,
  };
}

/**
 * What is on screen with a screen's worth of margin on every side, read back
 * through the very origin getSceneOrigin places the layer at. The margin is
 * measured in viewport pixels, never in the canvas box, which is not the screen.
 */
export function createCullingRect(options: CullingRectOptions): CullingRect {
  const { width, height, viewportWidth, viewportHeight } = options;
  const zoomLevel = safeZoom(options.zoomLevel);
  const origin = getSceneOrigin({ ...options, zoomLevel });

  // A frame the host has not measured yet reports no viewport at all. The
  // canvas box stands in for it so the rect stays finite and keeps the whole
  // document, where an empty one would blank the scene until the next resize.
  const screenWidth =
    (viewportWidth > 0 ? viewportWidth : width * zoomLevel) / zoomLevel;
  const screenHeight =
    (viewportHeight > 0 ? viewportHeight : height * zoomLevel) / zoomLevel;

  return {
    x: -origin.x / zoomLevel - screenWidth,
    y: -origin.y / zoomLevel - screenHeight,
    width: screenWidth * 3,
    height: screenHeight * 3,
  };
}

/** The culling rect for the editor's current scroll, zoom, canvas and viewport. */
export function getCullingRect(state: RootState): CullingRect {
  const {
    settings: { width, height, scrollLeft, scrollTop, zoomLevel },
    editor: { viewport },
  } = state;

  return createCullingRect({
    width,
    height,
    scrollLeft,
    scrollTop,
    zoomLevel,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  });
}

/** Inclusive overlap: a box touching the rect along an edge is still drawn. */
export function intersects(rect: Rect, other: Rect): boolean {
  return !(
    other.x > rect.x + rect.width ||
    other.x + other.width < rect.x ||
    other.y > rect.y + rect.height ||
    other.y + other.height < rect.y
  );
}

export function isTableVisible(
  rect: CullingRect,
  state: RootState,
  table: Table
): boolean {
  return intersects(rect, getTableRect(state, table));
}

export function isMemoVisible(rect: CullingRect, memo: Memo): boolean {
  return intersects(rect, getMemoRect(memo));
}

/**
 * A connector is kept for its whole reach, not for its routed polyline: the
 * route holds neither the anchors nor the cardinality decorations, and either
 * can be on screen with every routed point off it.
 */
export function isRelationshipVisible(
  rect: CullingRect,
  relationship: Relationship,
  strokeWidth?: number
): boolean {
  return intersects(rect, getRouteBBox(relationship, strokeWidth));
}
