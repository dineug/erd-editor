import { describe, expect, it } from 'vite-plus/test';

import { columnOffsets } from '@/model/columns';
import type { ColumnDef } from '@/model/types';
import {
  DEFAULT_OVERSCAN,
  DEFAULT_ROW_HEIGHT,
  frozenCount,
  frozenWidth,
  ROW_HEADER_MIN_WIDTH,
  rowAt,
  rowHeaderWidth,
  SCROLL_HEIGHT_CAP,
  scrollMapping,
  visibleRange,
} from '@/model/viewport';

/** Columns of the given widths, ids and labels being of no interest here. */
function offsetsOf(...widths: number[]): number[] {
  return columnOffsets(
    widths.map((width, index): ColumnDef => ({
      id: `${index}`,
      label: '',
      width,
    }))
  );
}

/** Thirty columns of 120 px, the demo page's grid. */
const THIRTY = offsetsOf(...Array.from({ length: 30 }, () => 120));

const MILLION = 1_000_000;

/** The demo's cell area at 1440 x 900: a 67 px row header and a 28 px column header off. */
const AREA = { width: 1373, height: 872 };

const NONE = { rows: 0, cols: 0 };

describe('rowAt', () => {
  it('finds the row whose band holds y, its top edge in and bottom edge out', () => {
    expect(rowAt(0, 28, 10)).toBe(0);
    expect(rowAt(27.9, 28, 10)).toBe(0);
    expect(rowAt(28, 28, 10)).toBe(1);
    expect(rowAt(279.9, 28, 10)).toBe(9);
  });

  it('answers -1 above the first row, past the last and with no rows', () => {
    expect(rowAt(-0.5, 28, 10)).toBe(-1);
    expect(rowAt(280, 28, 10)).toBe(-1);
    expect(rowAt(0, 28, 0)).toBe(-1);
    expect(rowAt(Number.NaN, 28, 10)).toBe(-1);
  });

  it('answers -1 for a row height that would divide by zero', () => {
    expect(rowAt(10, 0, 10)).toBe(-1);
    expect(rowAt(10, -28, 10)).toBe(-1);
  });

  it('stays exact near the bottom of a million rows, 28,000,000 px down', () => {
    expect(rowAt(27_999_972, 28, MILLION)).toBe(999_999);
    expect(rowAt(27_999_971.99, 28, MILLION)).toBe(999_998);
    expect(rowAt(27_999_999.99, 28, MILLION)).toBe(999_999);
    expect(rowAt(28_000_000, 28, MILLION)).toBe(-1);
  });
});

describe('frozenCount and frozenWidth', () => {
  const offsets = offsetsOf(100, 50, 200);

  it('measures the leading columns that stay put', () => {
    expect(frozenCount(offsets, 2)).toBe(2);
    expect(frozenWidth(offsets, 2)).toBe(150);
    expect(frozenWidth(offsets)).toBe(0);
  });

  it('holds a count past the columns, a negative one and a fraction to what exists', () => {
    expect(frozenCount(offsets, 9)).toBe(3);
    expect(frozenWidth(offsets, 9)).toBe(350);
    expect(frozenCount(offsets, -1)).toBe(0);
    expect(frozenCount(offsets, 1.7)).toBe(1);
    expect(frozenCount(offsets, Number.NaN)).toBe(0);
  });

  it('answers zero for a grid with no columns', () => {
    expect(frozenCount([0], 2)).toBe(0);
    expect(frozenWidth([0], 2)).toBe(0);
    expect(frozenWidth([], 2)).toBe(0);
  });
});

describe('visibleRange', () => {
  const size = { ...AREA, rowCount: MILLION };

  it('draws two rows and one column past each edge by default', () => {
    expect(DEFAULT_OVERSCAN).toEqual({ rows: 2, cols: 1 });
    expect(Object.isFrozen(DEFAULT_OVERSCAN)).toBe(true);
    expect(DEFAULT_ROW_HEIGHT).toBe(28);

    expect(visibleRange(0, 0, size, 28, THIRTY, NONE)).toEqual({
      rowStart: 0,
      rowEnd: 31,
      colStart: 0,
      colEnd: 11,
      frozenEnd: -1,
    });
    expect(visibleRange(2800.5, 600, size, 28, THIRTY)).toEqual({
      rowStart: 98,
      rowEnd: 133,
      colStart: 4,
      colEnd: 17,
      frozenEnd: -1,
    });
  });

  it('keeps what it draws between the cells in view and two rows and columns more a side', () => {
    for (const [top, left] of [
      [0, 0],
      [13, 7],
      [123_456.7, 1001],
      [27_999_128, 2227],
    ]) {
      const visible = visibleRange(top, left, size, 28, THIRTY, NONE);
      const drawn = visibleRange(top, left, size, 28, THIRTY);
      const rows = visible.rowEnd - visible.rowStart + 1;
      const cols = visible.colEnd - visible.colStart + 1;
      const cells =
        (drawn.rowEnd - drawn.rowStart + 1) *
        (drawn.colEnd - drawn.colStart + 1);

      expect(cells).toBeGreaterThanOrEqual(rows * cols);
      expect(cells).toBeLessThanOrEqual((rows + 4) * (cols + 2));
      expect(rows).toBeLessThanOrEqual(Math.ceil(AREA.height / 28) + 1);
    }
  });

  it('leaves out a row whose top lands on the bottom edge of the view', () => {
    const range = visibleRange(
      280,
      0,
      { width: 100, height: 280, rowCount: 100 },
      28,
      THIRTY,
      NONE
    );

    expect(range.rowStart).toBe(10);
    expect(range.rowEnd).toBe(19);
    expect(range.colEnd).toBe(0);
  });

  it('reads an elastic scroll above the top as the top', () => {
    expect(visibleRange(-40, -30, size, 28, THIRTY)).toEqual(
      visibleRange(0, 0, size, 28, THIRTY)
    );
  });

  it('holds the rows to the last one and draws none past the content', () => {
    const near = visibleRange(27_999_900, 0, size, 28, THIRTY);
    expect(near.rowEnd).toBe(MILLION - 1);
    expect(near.rowStart).toBe(999_994);

    const past = visibleRange(30_000_000, 0, size, 28, THIRTY);
    expect(past.rowEnd).toBe(MILLION - 1);
    expect(past.rowStart).toBe(MILLION);
  });

  it('draws no rows for a grid with none, a view with no height or no row height', () => {
    for (const range of [
      visibleRange(0, 0, { ...AREA, rowCount: 0 }, 28, THIRTY),
      visibleRange(0, 0, { width: 1373, height: 0, rowCount: 10 }, 28, THIRTY),
      visibleRange(0, 0, size, 0, THIRTY),
    ]) {
      expect(range.rowStart).toBe(0);
      expect(range.rowEnd).toBe(-1);
      expect(range.colEnd).toBe(12);
    }
  });

  it('draws no columns for a grid with none, rows still', () => {
    expect(visibleRange(0, 0, size, 28, offsetsOf())).toEqual({
      rowStart: 0,
      rowEnd: 33,
      colStart: 0,
      colEnd: -1,
      frozenEnd: -1,
    });
    expect(visibleRange(0, 0, size, 28, [])).toMatchObject({
      colStart: 0,
      colEnd: -1,
      frozenEnd: -1,
    });
  });

  it('reaches the last column at the last scrollLeft', () => {
    const range = visibleRange(
      0,
      THIRTY[30] - AREA.width,
      size,
      28,
      THIRTY,
      NONE
    );

    expect(range.colEnd).toBe(29);
    expect(range.colStart).toBe(18);
    expect(visibleRange(0, 10_000, size, 28, THIRTY).colEnd).toBe(-1);
  });

  describe('with frozen columns', () => {
    const offsets = offsetsOf(...Array.from({ length: 10 }, () => 100));
    const frozen = { width: 500, height: 280, rowCount: 100, frozenColumns: 2 };

    it('keeps the frozen columns and starts the scrolling ones after them', () => {
      expect(visibleRange(0, 0, frozen, 28, offsets)).toMatchObject({
        frozenEnd: 1,
        colStart: 2,
        colEnd: 5,
      });
    });

    it('scrolls only what follows the frozen columns, by scrollLeft', () => {
      expect(visibleRange(0, 250, frozen, 28, offsets, NONE)).toMatchObject({
        frozenEnd: 1,
        colStart: 4,
        colEnd: 7,
      });
      expect(visibleRange(0, 250, frozen, 28, offsets)).toMatchObject({
        frozenEnd: 1,
        colStart: 3,
        colEnd: 8,
      });
    });

    it('never reaches under the frozen columns with the overscan', () => {
      expect(visibleRange(0, 50, frozen, 28, offsets).colStart).toBe(2);
    });

    it('reaches the last column at the last scrollLeft, the frozen ones still in view', () => {
      const range = visibleRange(
        0,
        offsets[10] - 500,
        frozen,
        28,
        offsets,
        NONE
      );

      expect(range).toMatchObject({ frozenEnd: 1, colStart: 7, colEnd: 9 });
    });

    it('freezes every column when the count reaches them all, and scrolls none', () => {
      for (const frozenColumns of [10, 15]) {
        expect(
          visibleRange(
            0,
            0,
            { ...frozen, width: 2000, frozenColumns },
            28,
            offsets
          )
        ).toMatchObject({ frozenEnd: 9, colStart: 10, colEnd: 9 });
      }
    });

    it('draws only the frozen columns in view when they are wider than it', () => {
      const narrow = { ...frozen, width: 250, frozenColumns: 4 };

      expect(visibleRange(0, 0, narrow, 28, offsets)).toMatchObject({
        frozenEnd: 2,
        colStart: 4,
        colEnd: 3,
      });
      expect(
        visibleRange(0, 0, { ...narrow, width: 400 }, 28, offsets)
      ).toMatchObject({ frozenEnd: 3, colStart: 4, colEnd: 3 });
    });

    it('draws no frozen column in a view with no width', () => {
      expect(
        visibleRange(0, 0, { ...frozen, width: 0 }, 28, offsets)
      ).toMatchObject({ frozenEnd: -1, colStart: 2, colEnd: 1 });
    });
  });
});

describe('scrollMapping', () => {
  const VIEW = AREA.height;

  it('maps one to one up to the cap of 8,000,000 px', () => {
    expect(SCROLL_HEIGHT_CAP).toBe(8_000_000);

    const mapping = scrollMapping(100_000 * 28);

    expect(mapping.ratio).toBe(1);
    expect(mapping.domHeight(VIEW)).toBe(2_800_000);
    expect(mapping.toContent(1234.5, VIEW)).toBe(1234.5);
    expect(mapping.toDom(1234.5, VIEW)).toBe(1234.5);
    expect(mapping.toContent(2_800_000 - VIEW, VIEW)).toBe(2_800_000 - VIEW);
    expect(scrollMapping(SCROLL_HEIGHT_CAP).ratio).toBe(1);
  });

  it('scales a million rows of 28 px by 3.5, a 100 px wheel notch to 12.5 rows', () => {
    const mapping = scrollMapping(MILLION * 28);

    expect(mapping.ratio).toBe(3.5);
    expect(mapping.toContent(100, VIEW) / 28).toBe(12.5);
    expect(mapping.toDom(350, VIEW)).toBe(100);
  });

  it('keeps the spacer within a viewport of the cap, far under the layout limit', () => {
    const mapping = scrollMapping(MILLION * 28);
    expect(mapping.domHeight(VIEW)).toBeCloseTo(
      SCROLL_HEIGHT_CAP + VIEW * (1 - 1 / 3.5),
      6
    );

    const huge = scrollMapping(1e10);
    expect(huge.domHeight(VIEW)).toBeLessThan(SCROLL_HEIGHT_CAP + VIEW);
    expect(huge.domHeight(VIEW)).toBeGreaterThan(SCROLL_HEIGHT_CAP);
  });

  it('shows the last row whole at the last DOM scrollTop', () => {
    const contentHeight = MILLION * 28;
    const mapping = scrollMapping(contentHeight);
    const domMax = mapping.domHeight(VIEW) - VIEW;
    const top = mapping.toContent(domMax, VIEW);

    expect(top).toBe(contentHeight - VIEW);

    const size = { ...AREA, rowCount: MILLION };
    const range = visibleRange(top, 0, size, 28, THIRTY, NONE);
    expect(range.rowEnd).toBe(MILLION - 1);
    expect((range.rowEnd + 1) * 28 - top).toBe(VIEW);
  });

  it('snaps the last DOM pixel to the end, however the browser rounds the scroll height', () => {
    const contentHeight = MILLION * 28;
    const mapping = scrollMapping(contentHeight);
    const domMax = mapping.domHeight(VIEW) - VIEW;

    expect(mapping.toContent(domMax - 0.5, VIEW)).toBe(contentHeight - VIEW);
    expect(mapping.toContent(domMax - 0.9, VIEW)).toBe(contentHeight - VIEW);
    expect(mapping.toContent(domMax - 1.5, VIEW)).toBeCloseTo(
      (domMax - 1.5) * 3.5,
      6
    );
    expect(mapping.toContent(domMax + 40, VIEW)).toBe(contentHeight - VIEW);
  });

  it('reads an elastic scroll above the top as the top', () => {
    expect(scrollMapping(MILLION * 28).toContent(-25, VIEW)).toBe(0);
    expect(scrollMapping(2800).toContent(-25, VIEW)).toBe(0);
    expect(scrollMapping(MILLION * 28).toDom(-25, VIEW)).toBe(0);
  });

  it('inverts itself away from the last DOM pixel, 28,000,000 px down too', () => {
    const mapping = scrollMapping(MILLION * 28);

    for (const contentTop of [0, 28, 1_000_001.5, 14_000_000, 27_990_000]) {
      const domTop = mapping.toDom(contentTop, VIEW);

      expect(domTop).toBeCloseTo(contentTop / 3.5, 6);
      expect(mapping.toContent(domTop, VIEW)).toBeCloseTo(contentTop, 6);
    }

    expect(mapping.toDom(30_000_000, VIEW)).toBeCloseTo(
      (MILLION * 28 - VIEW) / 3.5,
      6
    );
  });

  it('moves no row when the viewport resizes', () => {
    const mapping = scrollMapping(MILLION * 28);

    expect(mapping.toContent(4_000_000, 400)).toBe(
      mapping.toContent(4_000_000, VIEW)
    );
  });

  it('scrolls nothing when the content is shorter than the viewport', () => {
    const mapping = scrollMapping(5 * 28);

    expect(mapping.domHeight(VIEW)).toBe(140);
    expect(mapping.toContent(60, VIEW)).toBe(0);
    expect(mapping.toDom(60, VIEW)).toBe(0);
  });

  it('takes a cap it is given and an empty grid', () => {
    const mapping = scrollMapping(10_000, 1000);

    expect(mapping.ratio).toBe(10);
    expect(mapping.toContent(50, 100)).toBe(500);
    expect(mapping.domHeight(100)).toBe(1090);
    expect(mapping.toContent(990, 100)).toBe(9900);

    const empty = scrollMapping(0);
    expect(empty.ratio).toBe(1);
    expect(empty.domHeight(VIEW)).toBe(0);
    expect(scrollMapping(-10).domHeight(VIEW)).toBe(0);
  });
});

describe('rowHeaderWidth', () => {
  it('never draws narrower than 40 px', () => {
    expect(ROW_HEADER_MIN_WIDTH).toBe(40);
    expect(rowHeaderWidth(0, 7)).toBe(40);
    expect(rowHeaderWidth(9, 7)).toBe(40);
    expect(rowHeaderWidth(99, 7)).toBe(40);
  });

  it('fits the digits of the last row number, rows counting from 1', () => {
    expect(rowHeaderWidth(9_999, 8)).toBe(48);
    expect(rowHeaderWidth(10_000, 8)).toBe(56);
    expect(rowHeaderWidth(MILLION, 8)).toBe(72);
  });

  it('rounds up to a whole pixel', () => {
    expect(rowHeaderWidth(MILLION, 7.2)).toBe(67);
    expect(rowHeaderWidth(MILLION, 7.2, 4)).toBe(55);
  });
});
