import { MINIMAP_SIZE } from '@/constants/layout';
import { Point } from '@/internal-types';
import { getSceneOrigin, type SceneTransform } from '@/konva/scene/viewport';

/** The canvas box the minimap draws, plus the screen that is looking at it. */
export type MinimapTransform = SceneTransform & {
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
};

export type MinimapRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** A zoom of zero would invert to nothing, and only a torn frame reports one. */
const safeZoom = (zoomLevel: number) => (zoomLevel > 0 ? zoomLevel : 1);

/** Negating a zero offset yields a signed zero, and the store compares with Object.is. */
const unsigned = (value: number) => value + 0;

/**
 * The whole canvas box scaled into the minimap square, with no zoom term. Fixed
 * on purpose: the thumbnail stays a map of the document at one size, and the
 * zoom shows up in the rectangle drawn over it instead.
 */
export function getMinimapRatio(width: number): number {
  return MINIMAP_SIZE / width;
}

/**
 * The canvas the screen actually covers, read back through the very origin
 * getSceneOrigin places the scene layer at. One screen pixel buys one over the
 * zoom in canvas units, so zooming out widens this with the origin standing still.
 */
export function getVisibleCanvasRect(transform: MinimapTransform): MinimapRect {
  const zoomLevel = safeZoom(transform.zoomLevel);
  const origin = getSceneOrigin({ ...transform, zoomLevel });

  return {
    x: unsigned(-origin.x / zoomLevel),
    y: unsigned(-origin.y / zoomLevel),
    width: transform.viewportWidth / zoomLevel,
    height: transform.viewportHeight / zoomLevel,
  };
}

/** That same rectangle in the minimap's own pixels, which is where it is drawn. */
export function getMinimapViewportRect(
  transform: MinimapTransform
): MinimapRect {
  const ratio = getMinimapRatio(transform.width);
  const rect = getVisibleCanvasRect(transform);

  return {
    x: unsigned(rect.x * ratio),
    y: unsigned(rect.y * ratio),
    width: rect.width * ratio,
    height: rect.height * ratio,
  };
}

/** The thumbnail's own box: the canvas box at the minimap ratio, 150 wide. */
export function getMinimapBoxSize(
  width: number,
  height: number
): { width: number; height: number } {
  const ratio = getMinimapRatio(width);

  return { width: width * ratio, height: height * ratio };
}

/**
 * The rectangle as drawn, trimmed to the thumbnail box. Zooming out far enough
 * makes the screen reach past the canvas on every side, and this box is a
 * pointer target, so what leaves the map is dropped instead of laid over it.
 */
export function getMinimapHandleRect(transform: MinimapTransform): MinimapRect {
  const rect = getMinimapViewportRect(transform);
  const box = getMinimapBoxSize(transform.width, transform.height);
  const x = Math.min(Math.max(rect.x, 0), box.width);
  const y = Math.min(Math.max(rect.y, 0), box.height);

  return {
    x,
    y,
    width: Math.max(Math.min(rect.x + rect.width, box.width) - x, 0),
    height: Math.max(Math.min(rect.y + rect.height, box.height) - y, 0),
  };
}

/**
 * A canvas distance as the origin travel that covers it. The origin is measured
 * in screen pixels and moves the view the opposite way, so it carries both the
 * zoom and the sign that a minimap coordinate does not.
 */
export function toScrollDistance(distance: number, zoomLevel: number): number {
  return unsigned(-distance * safeZoom(zoomLevel));
}

/** Minimap travel as the origin travel that keeps the rectangle under the pointer. */
export function toScrollMovement(
  movement: number,
  ratio: number,
  zoomLevel: number
): number {
  return toScrollDistance(movement / ratio, zoomLevel);
}

/**
 * The origin that puts a canvas point in the middle of the screen. Stated as a
 * step away from where the origin stands now, so it is read once through
 * getVisibleCanvasRect rather than restated inverted here.
 */
export function getScrollToCenter(
  transform: MinimapTransform,
  center: Point
): Point {
  const { zoomLevel, originX, originY } = transform;
  const rect = getVisibleCanvasRect(transform);

  return {
    x:
      originX + toScrollDistance(center.x - rect.width / 2 - rect.x, zoomLevel),
    y:
      originY +
      toScrollDistance(center.y - rect.height / 2 - rect.y, zoomLevel),
  };
}
