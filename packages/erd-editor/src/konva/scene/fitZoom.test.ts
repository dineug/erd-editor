import { round } from 'es-toolkit/compat';
import { describe, expect, it } from 'vite-plus/test';

import { CANVAS_ZOOM_MAX, CANVAS_ZOOM_MIN } from '@/constants/schema';
import {
  FIT_PADDING,
  PREVIEW_ZOOM_MAX,
  previewZoomLevel,
} from '@/konva/scene/fitZoom';
import type { Rect } from '@/konva/scene/metrics';

describe('previewZoomLevel', () => {
  const viewport = { width: 1200, height: 675 };
  const rect = (width: number, height: number): Rect => ({
    x: 0,
    y: 0,
    width,
    height,
  });

  /** The fit before it is rounded or held, written out longhand. */
  const rawFit = ({ width, height }: Rect) =>
    Math.min(
      viewport.width / (width + FIT_PADDING),
      viewport.height / (height + FIT_PADDING)
    );

  it('opens no closer than the ceiling on content the screen dwarfs', () => {
    const content = rect(200, 100);

    expect(rawFit(content)).toBeGreaterThan(PREVIEW_ZOOM_MAX);
    expect(previewZoomLevel(content, viewport)).toBe(PREVIEW_ZOOM_MAX);
  });

  it('opens up to the ceiling a view names instead, and no closer than that', () => {
    const content = rect(200, 100);

    expect(rawFit(content)).toBeGreaterThan(CANVAS_ZOOM_MAX);
    expect(previewZoomLevel(content, viewport, CANVAS_ZOOM_MAX)).toBe(
      CANVAS_ZOOM_MAX
    );
    expect(previewZoomLevel(content, viewport, 1)).toBe(1);
  });

  it('opens no farther than the floor every zoom has on content the screen cannot hold', () => {
    const content = rect(20_000, 20_000);

    expect(rawFit(content)).toBeLessThan(CANVAS_ZOOM_MIN);
    expect(previewZoomLevel(content, viewport)).toBe(CANVAS_ZOOM_MIN);
  });

  it('is the fit itself, rounded to two places, in between', () => {
    for (const content of [
      rect(2_000, 1_500),
      rect(700, 1_800),
      rect(3_333, 300),
    ]) {
      const zoomLevel = previewZoomLevel(content, viewport);
      const fit = rawFit(content);

      expect(fit).toBeGreaterThan(CANVAS_ZOOM_MIN);
      expect(fit).toBeLessThan(PREVIEW_ZOOM_MAX);
      expect(zoomLevel).toBe(round(zoomLevel, 2));
      expect(Math.abs(zoomLevel - fit)).toBeLessThanOrEqual(0.005);
    }
  });

  it('fits the tighter axis, so the whole content is on screen either way', () => {
    const wide = rect(4_000, 100);
    const tall = rect(100, 4_000);

    expect(previewZoomLevel(wide, viewport)).toBe(
      round(viewport.width / (wide.width + FIT_PADDING), 2)
    );
    expect(previewZoomLevel(tall, viewport)).toBe(
      round(viewport.height / (tall.height + FIT_PADDING), 2)
    );
  });
});
