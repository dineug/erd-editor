import { describe, expect, it } from 'vite-plus/test';

import { CANVAS_SIZE_MAX, CANVAS_SIZE_MIN } from '@/constants/schema';
import {
  CANVAS_SIDE_MAX,
  fitPixelRatio,
} from '@/services/export-png/pixelRatio';

const rasterSide = (pixelRatio: number, side: number) =>
  Math.floor(side * pixelRatio);

describe('fitPixelRatio', () => {
  it('leaves a box a canvas can hold at the ratio it was asked for', () => {
    expect(fitPixelRatio(1, CANVAS_SIDE_MAX, CANVAS_SIDE_MAX)).toBe(1);
    expect(fitPixelRatio(1, CANVAS_SIZE_MIN, CANVAS_SIZE_MIN)).toBe(1);
    expect(fitPixelRatio(1, 8000, 8000)).toBe(1);
  });

  it('shrinks the ratio so the longest side lands on the canvas ceiling', () => {
    expect(fitPixelRatio(1, CANVAS_SIZE_MAX, CANVAS_SIZE_MAX)).toBe(
      CANVAS_SIDE_MAX / CANVAS_SIZE_MAX
    );
    expect(rasterSide(fitPixelRatio(1, 20_000, 20_000), 20_000)).toBe(
      CANVAS_SIDE_MAX
    );
  });

  it('measures the longest side, not the one that happens to be width', () => {
    const wide = fitPixelRatio(1, CANVAS_SIZE_MAX, CANVAS_SIZE_MIN);
    const tall = fitPixelRatio(1, CANVAS_SIZE_MIN, CANVAS_SIZE_MAX);

    expect(wide).toBe(tall);
    expect(rasterSide(tall, CANVAS_SIZE_MAX)).toBe(CANVAS_SIDE_MAX);
    expect(rasterSide(tall, CANVAS_SIZE_MIN)).toBe(1638);
  });

  it('never raises a ratio a caller asked to lower', () => {
    expect(fitPixelRatio(0.5, CANVAS_SIZE_MIN, CANVAS_SIZE_MIN)).toBe(0.5);
    expect(fitPixelRatio(2, CANVAS_SIZE_MAX, CANVAS_SIZE_MAX)).toBeLessThan(1);
  });

  it('keeps every box the schema allows inside the canvas ceiling', () => {
    for (let side = CANVAS_SIZE_MIN; side <= CANVAS_SIZE_MAX; side += 137) {
      expect(
        rasterSide(fitPixelRatio(1, side, side), side)
      ).toBeLessThanOrEqual(CANVAS_SIDE_MAX);
    }

    expect(
      rasterSide(
        fitPixelRatio(1, CANVAS_SIZE_MAX, CANVAS_SIZE_MAX),
        CANVAS_SIZE_MAX
      )
    ).toBeLessThanOrEqual(CANVAS_SIDE_MAX);
  });

  it('hands back the ratio when there is no box to measure', () => {
    expect(fitPixelRatio(1, 0, 0)).toBe(1);
  });
});
