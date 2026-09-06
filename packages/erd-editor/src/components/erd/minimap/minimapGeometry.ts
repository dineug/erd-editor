import { MINIMAP_SIZE } from '@/constants/layout';
import {
  getScrollRanges,
  type ScrollRanges,
} from '@/engine/modules/settings/atom.actions';
import { RootState } from '@/engine/state';
import { Point } from '@/internal-types';
import { unionRect } from '@/konva/scene/contentBounds';
import { type Rect } from '@/konva/scene/metrics';
import { getViewContentRect } from '@/konva/scene/viewFreeze';
import { getSceneOrigin, type SceneTransform } from '@/konva/scene/viewport';

/** The scene placement plus the screen looking at it, which is all a visible rect is read from. */
export type ViewTransform = SceneTransform & {
  viewportWidth: number;
  viewportHeight: number;
};

/**
 * Scene units kept clear around what the map holds, so a box at the edge of the
 * content never touches the edge of the thumbnail.
 */
export const MINIMAP_MAP_MARGIN = 100;

/**
 * The grid the map's edges snap outward to, in scene units. A table nudged a
 * few pixels then leaves the map where it is, where a map cut to the content
 * would rescale the thumbnail under every move.
 */
export const MINIMAP_MAP_STEP = 500;

/**
 * The thumbnail's shorter side never draws thinner than this, in pixels. Two
 * tables fifty thousand units apart would fold it into a hairline otherwise,
 * so the map is widened about its middle along that axis until it fits.
 */
export const MINIMAP_BOX_MIN_SIDE = 30;

/**
 * The smallest anything drawn on the thumbnail may be, in pixels: a table or
 * memo box, or the handle. At the ratio a far flung document folds into, a
 * box would draw sub-pixel and the map would show nothing of what it maps.
 */
export const MINIMAP_MARK_MIN = 3;

/** How the thumbnail lays the document out: the scene rect it maps and the box that draws it. */
export type MinimapLayout = {
  /** The scene rect the thumbnail is a map of, in scene units. */
  map: Rect;
  /** Thumbnail pixels per scene unit: the map's longer side folded into MINIMAP_SIZE. */
  ratio: number;
  /** The thumbnail's own box, the map at the ratio, so its longer side is MINIMAP_SIZE. */
  box: { width: number; height: number };
  /** Where the box sits inside the MINIMAP_SIZE square, centred along its shorter side. */
  offset: Point;
};

/** A zoom of zero would invert to nothing, and only a torn frame reports one. */
const safeZoom = (zoomLevel: number) => (zoomLevel > 0 ? zoomLevel : 1);

/** Negating a zero offset yields a signed zero, and the store compares with Object.is. */
const unsigned = (value: number) => value + 0;

/** The view as the store holds it, for every reader that maps the screen onto the thumbnail. */
export function getViewTransform(state: RootState): ViewTransform {
  const {
    settings: { originX, originY, zoomLevel },
    editor: { viewport },
  } = state;

  return {
    originX,
    originY,
    zoomLevel,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  };
}

/**
 * The scene the screen actually covers, read back through the very origin
 * getSceneOrigin places the scene layer at. One screen pixel buys one over the
 * zoom in scene units, so zooming out widens this with the origin standing still.
 */
export function getVisibleCanvasRect(view: ViewTransform): Rect {
  const zoomLevel = safeZoom(view.zoomLevel);
  const origin = getSceneOrigin({ ...view, zoomLevel });

  return {
    x: unsigned(-origin.x / zoomLevel),
    y: unsigned(-origin.y / zoomLevel),
    width: view.viewportWidth / zoomLevel,
    height: view.viewportHeight / zoomLevel,
  };
}

const inflate = (rect: Rect, margin: number): Rect => ({
  x: rect.x - margin,
  y: rect.y - margin,
  width: rect.width + margin * 2,
  height: rect.height + margin * 2,
});

/** The rect grown out to the grid lines on either side of it, never shrunk. */
const snapOutward = (rect: Rect, step: number): Rect => {
  const x = unsigned(Math.floor(rect.x / step) * step);
  const y = unsigned(Math.floor(rect.y / step) * step);

  return {
    x,
    y,
    width: Math.ceil((rect.x + rect.width) / step) * step - x,
    height: Math.ceil((rect.y + rect.height) / step) * step - y,
  };
};

/** The rect grown about its own middle until neither side is under the length. */
const growToLeast = (rect: Rect, length: number): Rect => {
  const width = Math.max(rect.width, length);
  const height = Math.max(rect.height, length);

  return {
    x: rect.x - (width - rect.width) / 2,
    y: rect.y - (height - rect.height) / 2,
    width,
    height,
  };
};

/**
 * The scene the screen can be scrolled over: what it shows at either end of
 * the travel, and everything between. The far end of the travel puts the near
 * edge of the content on the far edge of the screen, and the other way about.
 */
export function getReachRect(
  view: ViewTransform,
  { left, top }: ScrollRanges
): Rect {
  const at = (originX: number, originY: number) =>
    getVisibleCanvasRect({ ...view, originX, originY });

  return unionRect(at(left.max, top.max), at(left.min, top.min));
}

/**
 * The map is everything the screen can be scrolled over, with the margin
 * around it, snapped to the grid, then widened along its shorter side where
 * that would draw under MINIMAP_BOX_MIN_SIDE. A drag holds its content still.
 */
export function getMinimapLayout(state: RootState): MinimapLayout {
  const view = getViewTransform(state);
  // The travel holds the origin where it stands and, while a drag holds the
  // view, the one it began from: a handle drag is cut to it and leaves the map
  // still, and a wheel mid drag grows the map to keep the handle rather than cut it.
  const reach = getReachRect(view, getScrollRanges(state));
  const content = getViewContentRect(state);
  const hull = content ? unionRect(content, reach) : reach;
  const snapped = snapOutward(
    inflate(hull, MINIMAP_MAP_MARGIN),
    MINIMAP_MAP_STEP
  );
  // The longer side sets the ratio, and the shorter one is widened at that
  // ratio, then snapped again, so every edge stays on the grid.
  const ratio = MINIMAP_SIZE / Math.max(snapped.width, snapped.height);
  const map = snapOutward(
    growToLeast(snapped, MINIMAP_BOX_MIN_SIDE / ratio),
    MINIMAP_MAP_STEP
  );
  const box = { width: map.width * ratio, height: map.height * ratio };

  return {
    map,
    ratio,
    box,
    offset: {
      x: (MINIMAP_SIZE - box.width) / 2,
      y: (MINIMAP_SIZE - box.height) / 2,
    },
  };
}

/** A scene point in the thumbnail's own pixels; scene zero lands where the layer is placed. */
export function toMinimapPoint(
  { map, ratio }: MinimapLayout,
  point: Point
): Point {
  return {
    x: unsigned((point.x - map.x) * ratio),
    y: unsigned((point.y - map.y) * ratio),
  };
}

/** The scene point under a thumbnail pixel, the mapping above inverted. */
export function fromMinimapPoint(
  { map, ratio }: MinimapLayout,
  point: Point
): Point {
  return {
    x: map.x + point.x / ratio,
    y: map.y + point.y / ratio,
  };
}

/** The screen's own footprint in thumbnail pixels, the visible rect mapped and untrimmed. */
export function getMinimapViewportRect(
  layout: MinimapLayout,
  view: ViewTransform
): Rect {
  const visible = getVisibleCanvasRect(view);
  const corner = toMinimapPoint(layout, visible);

  return {
    x: corner.x,
    y: corner.y,
    width: visible.width * layout.ratio,
    height: visible.height * layout.ratio,
  };
}

/**
 * A scene rect as the thumbnail draws it: the rect itself, or one grown about
 * its middle to MINIMAP_MARK_MIN pixels at the map's ratio where it would draw
 * smaller. In scene units, since the layer it lands on carries the ratio.
 */
export function getMinimapMarkRect(ratio: number, rect: Rect): Rect {
  return growToLeast(rect, MINIMAP_MARK_MIN / ratio);
}

/**
 * The rectangle as drawn, no smaller than a mark and trimmed to the thumbnail
 * box. A map laid out for the view holds its screen whole; the trim is for one
 * drawn against another view's map, since a pointer target must not hang over the canvas.
 */
export function getMinimapHandleRect(
  layout: MinimapLayout,
  view: ViewTransform
): Rect {
  const rect = growToLeast(
    getMinimapViewportRect(layout, view),
    MINIMAP_MARK_MIN
  );
  const { box } = layout;
  const x = Math.min(Math.max(rect.x, 0), box.width);
  const y = Math.min(Math.max(rect.y, 0), box.height);
  const right = Math.min(rect.x + rect.width, box.width);
  const bottom = Math.min(rect.y + rect.height, box.height);

  // Untouched edges hand the rectangle back as it is, so a box that fits is
  // drawn at its own size rather than at that size recomputed from its edges.
  if (
    x === rect.x &&
    y === rect.y &&
    right === rect.x + rect.width &&
    bottom === rect.y + rect.height
  ) {
    return rect;
  }

  return {
    x,
    y,
    width: Math.max(right - x, 0),
    height: Math.max(bottom - y, 0),
  };
}

/**
 * A scene distance as the origin travel that covers it. The origin is measured
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
 * The origin that puts a scene point in the middle of the screen. Stated as a
 * step away from where the origin stands now, so it is read once through
 * getVisibleCanvasRect rather than restated inverted here.
 */
export function getScrollToCenter(view: ViewTransform, center: Point): Point {
  const { zoomLevel, originX, originY } = view;
  const rect = getVisibleCanvasRect(view);

  return {
    x:
      originX + toScrollDistance(center.x - rect.width / 2 - rect.x, zoomLevel),
    y:
      originY +
      toScrollDistance(center.y - rect.height / 2 - rect.y, zoomLevel),
  };
}
