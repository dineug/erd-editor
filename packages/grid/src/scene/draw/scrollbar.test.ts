import { describe, expect, it } from 'vite-plus/test';

import { columnOffsets } from '@/model/columns';
import {
  MIN_THUMB_LENGTH,
  scrollbars,
  THUMB_INSET,
} from '@/scene/draw/scrollbar';
import {
  computeLayout,
  type SceneLayout,
  SCROLLBAR_SIZE,
} from '@/scene/layout';

const offsets = (count: number) =>
  columnOffsets(
    Array.from({ length: count }, (_, index) => ({
      id: `c${index}`,
      label: '',
      width: 100,
    }))
  );

const layoutOf = (rowCount: number, columnCount: number, frozen = 0) =>
  computeLayout({
    width: 800,
    height: 600,
    rowCount,
    rowHeight: 28,
    offsets: offsets(columnCount),
    frozenColumns: frozen,
    digitWidth: 8,
  });

describe('scrollbars', () => {
  it('hides both for content that fits', () => {
    const { vertical, horizontal } = scrollbars(layoutOf(5, 3), 0, 0);

    expect(vertical.visible || horizontal.visible).toBe(false);
    expect(vertical.thumb).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('runs the vertical track down the whole right edge, the thumb along the rows', () => {
    const layout = layoutOf(1_000_000, 30);
    const { vertical } = scrollbars(layout, 0, 0);

    expect(vertical.visible).toBe(true);
    expect(vertical.track).toEqual({
      x: 800 - SCROLLBAR_SIZE,
      y: 0,
      width: SCROLLBAR_SIZE,
      height: 600,
    });
    expect(vertical.thumb).toEqual({
      x: 800 - SCROLLBAR_SIZE + THUMB_INSET,
      y: layout.body.y,
      width: SCROLLBAR_SIZE - THUMB_INSET * 2,
      height: MIN_THUMB_LENGTH,
    });
  });

  it('puts a thumb at the end of its travel at the last scroll offset', () => {
    const layout = layoutOf(1_000_000, 30, 2);
    const { vertical, horizontal } = scrollbars(
      layout,
      layout.maxScrollTop,
      layout.maxScrollLeft
    );
    const { body } = layout;

    expect(vertical.thumb.y + vertical.thumb.height).toBe(body.y + body.height);
    expect(horizontal.thumb.x + horizontal.thumb.width).toBeCloseTo(
      body.x + body.width
    );
  });

  it('sizes a thumb by the share of its content in view', () => {
    const layout = layoutOf(40, 12);
    const { vertical, horizontal } = scrollbars(layout, 0, 0);
    const { body } = layout;

    expect(vertical.thumb.height).toBeCloseTo(
      (body.height * body.height) / (40 * 28)
    );
    expect(horizontal.thumb.width).toBeCloseTo(
      (body.width * body.width) / 1200
    );
    expect(horizontal.track).toEqual({
      x: 0,
      y: 600 - SCROLLBAR_SIZE,
      width: 800 - SCROLLBAR_SIZE,
      height: SCROLLBAR_SIZE,
    });
  });

  it('runs a horizontal track the full width when no vertical one shows', () => {
    const { vertical, horizontal } = scrollbars(layoutOf(3, 30), 0, 0);

    expect(vertical.visible).toBe(false);
    expect(horizontal.track.width).toBe(800);
  });

  it('keeps a thumb at the start of a track with no range to travel', () => {
    const layout: SceneLayout = { ...layoutOf(1_000_000, 30), maxScrollTop: 0 };

    expect(scrollbars(layout, 500, 0).vertical.thumb.y).toBe(layout.body.y);
  });
});
