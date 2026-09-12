import { clamp } from 'es-toolkit';
import { round } from 'es-toolkit/compat';

import { CANVAS_ZOOM_MIN } from '@/constants/schema';
import type { Viewport } from '@/engine/modules/editor/state';
import type { Rect } from '@/konva/scene/metrics';

/**
 * Scene units left around the content when a fit takes it in, so a table at
 * the edge of what is fitted is not flush against the edge of the screen.
 */
export const FIT_PADDING = 200;

/** The closest the placement preview opens at: the whole document is what it is for. */
export const PREVIEW_ZOOM_MAX = 0.7;

/**
 * The zoom a fit opens at: the content with its padding fitted into the screen
 * on both axes, rounded to the two places a zoom is kept to, and held between
 * the floor every zoom has and a ceiling, the preview's unless a view names its own.
 */
export function previewZoomLevel(
  content: Rect,
  viewport: Viewport,
  maxZoom = PREVIEW_ZOOM_MAX
): number {
  const fit = Math.min(
    viewport.width / (content.width + FIT_PADDING),
    viewport.height / (content.height + FIT_PADDING)
  );

  return clamp(round(fit, 2), CANVAS_ZOOM_MIN, maxZoom);
}
