import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '@/constants/layout';
import { getActiveView, getSourceView } from '@/engine/modules/editor/view';
import { RootState } from '@/engine/state';
import { Memo, Point, Relationship, Settings, Table } from '@/internal-types';
import { getMemoRect, getTableRect, type Rect } from '@/konva/scene/metrics';
import { getRouteBBox } from '@/utils/draw-relationship';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

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
 * The placement a reader standing outside every scene means: the active
 * view's while one is open, else the document's. The zoom generators read
 * it, since the redirect sends what they dispatch there too.
 */
export function getActiveTransform(state: RootState): SceneTransform {
  return getActiveView(state) ?? state.settings;
}

/**
 * The placement a scene is drawn at: the document's own, or that of the view
 * of the scene's kind. A view scene whose view is not open falls back to the
 * document, so it draws something rather than nothing while one is opening.
 */
export function getSceneTransform(
  state: RootState,
  source: GeometrySource = 'document'
): SceneTransform {
  return getSourceView(state, source) ?? state.settings;
}

/**
 * The placement a zoom is solved against and lands in: the scene named, so a
 * view scene zooms the view it draws whichever is active; with no scene named,
 * the active view's else the document's, which is where the redirect sends the yield.
 */
export function getZoomTransform(
  state: RootState,
  source?: GeometrySource
): SceneTransform {
  return source ? getSceneTransform(state, source) : getActiveTransform(state);
}

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

/** The culling rect for the scene's current origin, zoom and the editor's viewport. */
export function getCullingRect(
  state: RootState,
  source: GeometrySource = 'document'
): CullingRect {
  const { originX, originY, zoomLevel } = getSceneTransform(state, source);
  const { viewport } = state.editor;

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
  table: Table,
  source: GeometrySource = 'document'
): boolean {
  return intersects(rect, getTableRect(state, table, source));
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
  strokeWidth?: number,
  source: GeometrySource = 'document'
): boolean {
  return intersects(rect, getRouteBBox(relationship, strokeWidth, source));
}
