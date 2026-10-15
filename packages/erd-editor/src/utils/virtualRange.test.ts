import { describe, expect, it } from 'vite-plus/test';

import { offsetToShow, VIRTUAL_OVERSCAN, visibleRange } from './virtualRange';

describe('visibleRange', () => {
  it('takes the rows in view and the overscan either side, inside the rows there are', () => {
    expect(visibleRange(500, 0, 220, 22)).toEqual({ first: 0, last: 17 });
    expect(visibleRange(500, 2200, 220, 22)).toEqual({
      first: 100 - VIRTUAL_OVERSCAN,
      last: 109 + VIRTUAL_OVERSCAN,
    });
    expect(visibleRange(5, 0, 220, 22)).toEqual({ first: 0, last: 4 });
    expect(visibleRange(0, 0, 220, 22)).toEqual({ first: 0, last: -1 });
  });

  it('draws no row past the end when the offset stands beyond the rows', () => {
    const { first, last } = visibleRange(5, 2200, 220, 22);

    expect(last).toBeLessThan(first);
  });
});

describe('offsetToShow', () => {
  it('keeps the offset while the row shows, or moves the nearest edge to it', () => {
    expect(offsetToShow(3, 0, 220, 22)).toBe(0);
    expect(offsetToShow(20, 0, 220, 22)).toBe(21 * 22 - 220);
    expect(offsetToShow(2, 220, 220, 22)).toBe(44);
    expect(offsetToShow(0, 0, 10, 22)).toBe(12);
  });
});
