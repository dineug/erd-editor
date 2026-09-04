import { describe, expect, it } from 'vite-plus/test';

import { CANVAS_SIZE_MAX, CANVAS_SIZE_MIN } from '@/constants/schema';
import {
  CANVAS_AREA_MAX,
  CANVAS_SIDE_MAX,
  fitPixelRatio,
} from '@/services/export-png/pixelRatio';

const rasterSide = (pixelRatio: number, side: number) =>
  Math.floor(side * pixelRatio);

/** The side the ceiling lands on when a square box is the one being fitted. */
const SQUARE_SIDE_MAX = Math.sqrt(CANVAS_AREA_MAX);

describe('fitPixelRatio', () => {
  it('leaves a box a canvas can hold at the ratio it was asked for', () => {
    expect(fitPixelRatio(1, CANVAS_SIZE_MIN, CANVAS_SIZE_MIN)).toBe(1);
    expect(fitPixelRatio(1, 8000, 8000)).toBe(1);
    expect(fitPixelRatio(1, SQUARE_SIDE_MAX, SQUARE_SIDE_MAX)).toBe(1);
  });

  it('keeps a box whose area fits, however long its longest side is', () => {
    expect(fitPixelRatio(1, CANVAS_SIZE_MIN, CANVAS_SIZE_MAX)).toBe(1);
    expect(fitPixelRatio(1, CANVAS_SIZE_MAX, CANVAS_SIZE_MIN)).toBe(1);
    expect(fitPixelRatio(1, 8000, CANVAS_SIZE_MAX)).toBe(1);
  });

  it('shrinks the ratio so the raster area lands on the ceiling', () => {
    const ratio = fitPixelRatio(1, CANVAS_SIZE_MAX, CANVAS_SIZE_MAX);

    expect(ratio).toBeLessThan(1);
    expect(rasterSide(ratio, CANVAS_SIZE_MAX)).toBe(SQUARE_SIDE_MAX);
  });

  it('fits a square box at the very ratio the side rule it replaced gave', () => {
    for (let side = CANVAS_SIZE_MIN; side <= CANVAS_SIZE_MAX; side += 137) {
      expect(fitPixelRatio(1, side, side)).toBe(
        Math.min(1, SQUARE_SIDE_MAX / side)
      );
    }
  });

  it('caps one side even where the area alone would allow more', () => {
    const ratio = fitPixelRatio(4, CANVAS_SIZE_MAX, 1);

    expect(rasterSide(ratio, CANVAS_SIZE_MAX)).toBe(CANVAS_SIDE_MAX);
  });

  it('never raises a ratio a caller asked to lower', () => {
    expect(fitPixelRatio(0.5, CANVAS_SIZE_MIN, CANVAS_SIZE_MIN)).toBe(0.5);
    expect(fitPixelRatio(2, CANVAS_SIZE_MAX, CANVAS_SIZE_MAX)).toBeLessThan(1);
  });

  it('keeps every box the schema allows inside both ceilings', () => {
    for (let width = CANVAS_SIZE_MIN; width <= CANVAS_SIZE_MAX; width += 137) {
      for (
        let height = CANVAS_SIZE_MIN;
        height <= CANVAS_SIZE_MAX;
        height += 1373
      ) {
        const ratio = fitPixelRatio(1, width, height);
        const w = rasterSide(ratio, width);
        const h = rasterSide(ratio, height);

        expect(Math.max(w, h)).toBeLessThanOrEqual(CANVAS_SIDE_MAX);
        expect(w * h).toBeLessThanOrEqual(CANVAS_AREA_MAX);
      }
    }
  });

  it('hands back the ratio when there is no box to measure', () => {
    expect(fitPixelRatio(1, 0, 0)).toBe(1);
    expect(fitPixelRatio(1, CANVAS_SIZE_MIN, 0)).toBe(1);
  });
});
