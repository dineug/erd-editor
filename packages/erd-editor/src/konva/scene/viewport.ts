import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '@/constants/layout';
import { RootState } from '@/engine/state';
import { Memo, Point, Relationship, Settings, Table } from '@/internal-types';
import { getMemoRect, getTableRect, type Rect } from '@/konva/scene/metrics';
import { getRouteBBox } from '@/utils/draw-relationship';

export type CullingRect = Rect;

/** The origin and the zoom every scene layer is placed with. */
export type SceneTransform = Pick<
  Settings,
  'originX' | 'originY' | 'zoomLevel'
>;

export type CullingRectOptions = SceneTransform & {
  viewportWidth: number;
  viewportHeight: number;
};

/**
 * Where a scene layer sits on the stage, so screen equals scene times the zoom
 * plus this. The document stores it directly: settings.originX and originY are
 * the screen point scene (0, 0) lands on, and nothing else enters.
 */
export function getSceneOrigin({ originX, originY }: SceneTransform): Point {
  return { x: originX, y: originY };
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
 * The origin that puts a scene point under a point on the stage, the placement
 * solved for its own offset. A jump to a table names where the table should
 * land and asks this for the view that lands it there.
 */
export function getOriginToPlace(
  zoomLevel: number,
  scene: Point,
  screen: Point
): Point {
  return {
    x: screen.x - scene.x * zoomLevel,
    y: screen.y - scene.y * zoomLevel,
  };
}

/**
 * What is on screen with a screen's worth of margin on every side, read back
 * through the very origin getSceneOrigin places the layer at. The margin is
 * measured in viewport pixels, never in the document, which is not the screen.
 */
export function createCullingRect(options: CullingRectOptions): CullingRect {
  const { viewportWidth, viewportHeight } = options;
  const zoomLevel = safeZoom(options.zoomLevel);
  const origin = getSceneOrigin({ ...options, zoomLevel });

  // A frame the host has not measured yet reports no viewport at all. The
  // default editor size stands in for it so the rect stays finite and keeps a
  // screen's worth of scene, where an empty one would blank it until a resize.
  const screenWidth =
    (viewportWidth > 0 ? viewportWidth : DEFAULT_WIDTH) / zoomLevel;
  const screenHeight =
    (viewportHeight > 0 ? viewportHeight : DEFAULT_HEIGHT) / zoomLevel;

  return {
    x: -origin.x / zoomLevel - screenWidth,
    y: -origin.y / zoomLevel - screenHeight,
    width: screenWidth * 3,
    height: screenHeight * 3,
  };
}

/** The culling rect for the editor's current origin, zoom and viewport. */
export function getCullingRect(state: RootState): CullingRect {
  const {
    settings: { originX, originY, zoomLevel },
    editor: { viewport },
  } = state;

  return createCullingRect({
    originX,
    originY,
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
