import { describe, expect, it } from 'vite-plus/test';

import {
  getGutterRect,
  getVisibleSpan,
  GUTTER_REACH,
  PILL_MARGIN,
  placePill,
  type PlacePillInput,
} from '@/components/erd/draw-target/placePill';

const pill = { width: 36, height: 64 };
const viewport = { width: 1000, height: 600 };

const input = (overrides: Partial<PlacePillInput> = {}): PlacePillInput => ({
  card: { x: 300, y: 100, width: 200, height: 160 },
  viewport,
  covered: 0,
  obstacles: [],
  pill,
  ...overrides,
});

describe('placePill', () => {
  it('stands left of the table, a margin off its edge, level with its top', () => {
    expect(placePill(input())).toEqual({
      x: 300 - PILL_MARGIN - pill.width,
      y: 100,
      side: 'left',
    });
  });

  it('flips right when the left edge of the canvas leaves no room', () => {
    const card = { x: 20, y: 100, width: 200, height: 160 };

    expect(placePill(input({ card }))).toEqual({
      x: 220 + PILL_MARGIN,
      y: 100,
      side: 'right',
    });
  });

  it('keeps clear of Find and Replace, flipping right when the panel leaves no room', () => {
    const card = { x: 400, y: 100, width: 200, height: 160 };

    expect(placePill(input({ card, covered: 412 }))).toEqual({
      x: 600 + PILL_MARGIN,
      y: 100,
      side: 'right',
    });
    expect(placePill(input({ card, covered: 300 })).side).toBe('left');
  });

  it('stands over the left edge of the table when neither side has room', () => {
    const card = { x: 20, y: 100, width: 960, height: 160 };

    expect(placePill(input({ card }))).toEqual({
      x: PILL_MARGIN,
      y: 100,
      side: 'left',
    });
    expect(placePill(input({ card, covered: 412 })).x).toBe(PILL_MARGIN + 412);
  });

  it('sticks to the top of a table taller than the canvas, so it stays in view', () => {
    const card = { x: 300, y: -900, width: 200, height: 3000 };

    expect(placePill(input({ card })).y).toBe(PILL_MARGIN);
  });

  it('stays inside the canvas beside a table whose top is near its bottom edge', () => {
    const card = { x: 300, y: 580, width: 200, height: 160 };

    expect(placePill(input({ card })).y).toBe(
      viewport.height - PILL_MARGIN - pill.height
    );
  });

  it('moves below the minimap within the table it stands beside', () => {
    const card = { x: 300, y: 100, width: 200, height: 400 };
    const minimap = { x: 200, y: 80, width: 100, height: 60 };

    expect(placePill(input({ card, obstacles: [minimap] }))).toEqual({
      x: 256,
      y: 140,
      side: 'left',
    });
  });

  it('moves above an obstacle that leaves no room below it', () => {
    const card = { x: 300, y: 100, width: 200, height: 400 };
    const toolbar = { x: 200, y: 140, width: 100, height: 400 };

    expect(placePill(input({ card, obstacles: [toolbar] }))).toEqual({
      x: 256,
      y: 76,
      side: 'left',
    });
  });

  it('moves only as far as keeps the middle of the buttons beside the table', () => {
    const card = { x: 300, y: 100, width: 200, height: 60 };
    const minimap = { x: 200, y: 80, width: 100, height: 60 };

    expect(placePill(input({ card, obstacles: [minimap] }))).toEqual({
      x: 508,
      y: 100,
      side: 'right',
    });
  });

  it('moves no further than the bottom edge of the canvas', () => {
    const card = { x: 300, y: 400, width: 200, height: 400 };
    const minimap = { x: 200, y: 420, width: 100, height: 140 };

    expect(placePill(input({ card, obstacles: [minimap] }))).toEqual({
      x: 508,
      y: 400,
      side: 'right',
    });
  });

  it('tries the other side, then stays where neither clears the chrome', () => {
    const card = { x: 300, y: 100, width: 200, height: 160 };
    const left = { x: 250, y: 0, width: 50, height: 600 };
    const right = { x: 500, y: 0, width: 60, height: 600 };

    expect(placePill(input({ card, obstacles: [left] }))).toEqual({
      x: 508,
      y: 100,
      side: 'right',
    });
    expect(placePill(input({ card, obstacles: [left, right] }))).toEqual({
      x: 256,
      y: 100,
      side: 'left',
    });
  });

  it('reads an obstacle that only touches the buttons as clear of them', () => {
    const card = { x: 300, y: 100, width: 200, height: 160 };
    const touching = { x: 200, y: 164, width: 100, height: 40 };

    expect(placePill(input({ card, obstacles: [touching] })).y).toBe(100);
  });
});

describe('getVisibleSpan', () => {
  it('is the part of the table the canvas shows, a margin in from its edges', () => {
    expect(
      getVisibleSpan({ x: 0, y: -50, width: 10, height: 900 }, viewport)
    ).toEqual({ top: PILL_MARGIN, bottom: viewport.height - PILL_MARGIN });
    expect(
      getVisibleSpan({ x: 0, y: 40, width: 10, height: 100 }, viewport)
    ).toEqual({ top: 40, bottom: 140 });
  });
});

describe('getGutterRect', () => {
  it('runs from a little past the buttons to the left edge of the table', () => {
    const card = { x: 300, y: 100, width: 200, height: 40 };
    const placement = { x: 256, y: 100, side: 'left' as const };

    expect(getGutterRect({ card, viewport, placement, pill })).toEqual({
      x: 256 - GUTTER_REACH,
      y: 100,
      width: 300 - 256 + GUTTER_REACH,
      height: pill.height,
    });
  });

  it('runs from the right edge of the table past buttons standing right of it', () => {
    const card = { x: 20, y: 100, width: 200, height: 300 };
    const placement = { x: 228, y: 100, side: 'right' as const };

    expect(getGutterRect({ card, viewport, placement, pill })).toEqual({
      x: 220,
      y: 100,
      width: 228 + pill.width + GUTTER_REACH - 220,
      height: 300,
    });
  });

  it('spans the buttons and the shown part of the table together', () => {
    const card = { x: 300, y: 0, width: 200, height: 40 };
    const placement = { x: 256, y: PILL_MARGIN, side: 'left' as const };

    expect(getGutterRect({ card, viewport, placement, pill })).toMatchObject({
      y: PILL_MARGIN,
      height: pill.height,
    });
  });

  it('has none where the buttons stand over the table', () => {
    const card = { x: 4, y: 100, width: 990, height: 40 };
    const placement = { x: PILL_MARGIN, y: 100, side: 'left' as const };

    expect(getGutterRect({ card, viewport, placement, pill })).toBeNull();
  });
});
