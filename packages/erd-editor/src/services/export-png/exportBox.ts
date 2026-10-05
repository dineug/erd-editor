import { query } from '@dineug/erd-editor-schema';

import { Show } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { getContentRect, unionRect } from '@/konva/scene/contentBounds';
import type { Rect } from '@/konva/scene/metrics';
import { bHas } from '@/utils/bit';
import { getRouteBBox } from '@/utils/draw-relationship';

import { CANVAS_AREA_MAX, CANVAS_SIDE_MAX, fitPixelRatio } from './pixelRatio';

type Size = Pick<Rect, 'width' | 'height'>;

/**
 * The breathing room around the drawn document, in scene units, and nothing
 * more: a connector measured against a retired sort epoch is already inflated
 * by getRouteBBox itself, and the union below holds that box before this is added.
 */
export const EXPORT_MARGIN = 80;

function inflate({ x, y, width, height }: Rect, padding: number): Rect {
  return {
    x: x - padding,
    y: y - padding,
    width: width + padding * 2,
    height: height + padding * 2,
  };
}

/**
 * Everything the image has to hold: every table and memo, every connector the
 * document is set to show, and the margin around the lot. An empty document is
 * the margin on its own, which is a box a canvas can still hold.
 *
 * @example
 * const box = getExportRect(store.state);
 */
export function getExportRect(state: RootState): Rect {
  const {
    settings: { show },
    doc: { relationshipIds },
    collections,
  } = state;

  let box = getContentRect(state);

  if (bHas(show, Show.relationship)) {
    const relationships = query(collections)
      .collection('relationshipEntities')
      .selectByIds(relationshipIds);

    for (const relationship of relationships) {
      const route = getRouteBBox(relationship);
      box = box ? unionRect(box, route) : route;
    }
  }

  return inflate(box ?? { x: 0, y: 0, width: 0, height: 0 }, EXPORT_MARGIN);
}

/**
 * What the box is drawn at: the zoom the image was asked for, cut to whatever a
 * canvas can hold. A document is unbounded now, so this is what keeps the Stage
 * itself inside the ceiling that fitPixelRatio keeps the raster inside.
 *
 * @example
 * const scale = getExportScale(getExportRect(store.state), settings.zoomLevel);
 */
export function getExportScale(
  { width, height }: Rect,
  zoomLevel: number = 1
): number {
  const zoom = zoomLevel > 0 ? zoomLevel : 1;
  const side = Math.max(width, height);
  const area = width * height;
  if (side <= 0 || area <= 0) return zoom;

  // The ceilings bound the Stage, which is the box at this very scale, so they
  // are read off the box itself and the zoom is only what is asked for.
  return Math.min(
    zoom,
    CANVAS_SIDE_MAX / side,
    Math.sqrt(CANVAS_AREA_MAX / area)
  );
}

/** The raster an export comes out at, and the one it was asked for. */
export type ExportSize = {
  width: number;
  height: number;
  /** The box times the zoom times the scale, which a canvas ceiling may cut. */
  askedWidth: number;
  askedHeight: number;
  /** Whether a ceiling cut the raster below what was asked for. */
  reduced: boolean;
};

/**
 * The Stage a box drawn at the scale takes, a pixel each way at least: a canvas
 * truncates a side under one to none, from which no image can be drawn, and a
 * document far longer than it is thick is cut that thin by a preview's side.
 *
 * @example
 * const { width, height } = getStageSize(box, scale);
 */
export function getStageSize(box: Size, scale: number): Size {
  return {
    width: Math.max(box.width * scale, 1),
    height: Math.max(box.height * scale, 1),
  };
}

/**
 * The pixels a png of the box comes out at, worked out the way the render
 * works them out: the Stage fitted to the ceilings first, then its raster at
 * the scale. A dialog reads it to say what a file will hold before it exists.
 *
 * @example
 * const { width, height, reduced } = getExportSize(box, zoomLevel, 2);
 */
export function getExportSize(
  box: Size,
  zoomLevel: number,
  pixelRatio: number
): ExportSize {
  const zoom = zoomLevel > 0 ? zoomLevel : 1;
  const scale = getExportScale({ x: 0, y: 0, ...box }, zoom);
  const stage = getStageSize(box, scale);
  const ratio = fitPixelRatio(pixelRatio, stage.width, stage.height);

  // A canvas truncates the side it is given, which is what the file holds.
  return {
    width: Math.floor(stage.width * ratio),
    height: Math.floor(stage.height * ratio),
    askedWidth: Math.floor(box.width * zoom * pixelRatio),
    askedHeight: Math.floor(box.height * zoom * pixelRatio),
    reduced: scale * ratio < zoom * pixelRatio,
  };
}
