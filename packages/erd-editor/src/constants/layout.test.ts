import { describe, expect, it } from 'vite-plus/test';

import {
  COLUMN_AUTO_INCREMENT_WIDTH,
  COLUMN_DELETE_WIDTH,
  COLUMN_HEIGHT,
  COLUMN_KEY_WIDTH,
  COLUMN_MIN_WIDTH,
  COLUMN_NOT_NULL_WIDTH,
  COLUMN_PADDING,
  COLUMN_UNIQUE_WIDTH,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
  DIFF_TREE_WIDTH,
  HEADER_ICON_HEIGHT,
  HEADER_ICON_MARGIN_BOTTOM,
  INPUT_HEIGHT,
  INPUT_MARGIN_RIGHT,
  MEMO_BORDER,
  MEMO_HEADER_HEIGHT,
  MEMO_MIN_HEIGHT,
  MEMO_MIN_WIDTH,
  MEMO_PADDING,
  MINIMAP_MARGIN,
  MINIMAP_SIZE,
  RELATIONSHIP_HIT_STROKE_WIDTH,
  RELATIONSHIP_STROKE_WIDTH,
  START_ADD,
  START_X,
  START_Y,
  TABLE_BORDER,
  TABLE_HEADER_BUTTON_MARGIN_LEFT,
  TABLE_HEADER_HEIGHT,
  TABLE_HEADER_ICON_MARGIN_BOTTOM,
  TABLE_HEADER_INPUT_HEIGHT,
  TABLE_HEADER_PADDING,
  TABLE_PADDING,
  TOOLBAR_HEIGHT,
} from '@/constants/layout';

describe('layout constants', () => {
  it('places the first created entity at the documented offset', () => {
    expect(START_X).toBe(200);
    expect(START_Y).toBe(100);
    expect(START_ADD).toBe(50);
  });

  it('derives the default canvas height from a 16:9 ratio', () => {
    expect(DEFAULT_WIDTH).toBe(1200);
    expect(DEFAULT_HEIGHT).toBe(675);
    expect(DEFAULT_WIDTH / DEFAULT_HEIGHT).toBeCloseTo(16 / 9, 10);
  });

  it('exposes the shared input metrics', () => {
    expect(INPUT_HEIGHT).toBe(20);
    expect(INPUT_MARGIN_RIGHT).toBe(8);
    expect(HEADER_ICON_HEIGHT).toBe(12);
    expect(HEADER_ICON_MARGIN_BOTTOM).toBe(4);
  });

  it('composes the table header height from icon row + padded input', () => {
    expect(TABLE_BORDER).toBe(1);
    expect(TABLE_PADDING).toBe(8);
    expect(TABLE_HEADER_PADDING).toBe(2);
    expect(TABLE_HEADER_ICON_MARGIN_BOTTOM).toBe(2);
    expect(TABLE_HEADER_BUTTON_MARGIN_LEFT).toBe(4);

    expect(TABLE_HEADER_INPUT_HEIGHT).toBe(24);
    expect(TABLE_HEADER_INPUT_HEIGHT).toBe(
      INPUT_HEIGHT + TABLE_HEADER_PADDING * 2
    );

    expect(TABLE_HEADER_HEIGHT).toBe(38);
    expect(TABLE_HEADER_HEIGHT).toBe(
      HEADER_ICON_HEIGHT +
        TABLE_HEADER_ICON_MARGIN_BOTTOM +
        TABLE_HEADER_INPUT_HEIGHT
    );
  });

  it('composes the column row height from the padded input', () => {
    expect(COLUMN_PADDING).toBe(2);
    expect(COLUMN_HEIGHT).toBe(24);
    expect(COLUMN_HEIGHT).toBe(INPUT_HEIGHT + COLUMN_PADDING * 2);
  });

  it('keeps the column option widths wide enough for their labels', () => {
    expect(COLUMN_DELETE_WIDTH).toBe(12);
    expect(COLUMN_KEY_WIDTH).toBe(12);
    expect(COLUMN_MIN_WIDTH).toBe(60);
    expect(COLUMN_NOT_NULL_WIDTH).toBe(35);
    expect(COLUMN_UNIQUE_WIDTH).toBe(22);
    expect(COLUMN_AUTO_INCREMENT_WIDTH).toBe(15);

    expect(COLUMN_NOT_NULL_WIDTH).toBeGreaterThan(COLUMN_UNIQUE_WIDTH);
    expect(COLUMN_UNIQUE_WIDTH).toBeGreaterThan(COLUMN_AUTO_INCREMENT_WIDTH);
  });

  it('composes the memo header height from the icon row only', () => {
    expect(MEMO_BORDER).toBe(1);
    expect(MEMO_PADDING).toBe(8);
    expect(MEMO_HEADER_HEIGHT).toBe(16);
    expect(MEMO_HEADER_HEIGHT).toBe(
      HEADER_ICON_HEIGHT + HEADER_ICON_MARGIN_BOTTOM
    );
  });

  it('offsets the memo minimum width by its header height', () => {
    expect(MEMO_MIN_WIDTH).toBe(116);
    expect(MEMO_MIN_WIDTH).toBe(100 + MEMO_HEADER_HEIGHT);
    expect(MEMO_MIN_HEIGHT).toBe(100);
    expect(MEMO_MIN_WIDTH).toBeGreaterThan(MEMO_MIN_HEIGHT);
  });

  it('exposes the chrome sizes used by the minimap, toolbar and diff tree', () => {
    expect(MINIMAP_SIZE).toBe(150);
    expect(MINIMAP_MARGIN).toBe(20);
    expect(TOOLBAR_HEIGHT).toBe(30);
    expect(DIFF_TREE_WIDTH).toBe(200);
  });

  it('draws the connector thinner than the band that catches the pointer', () => {
    expect(RELATIONSHIP_STROKE_WIDTH).toBe(2);
    expect(RELATIONSHIP_HIT_STROKE_WIDTH).toBe(8);
    // Hit-testing follows the painted stroke, so the band is the whole reason a
    // connector this thin is still reachable.
    expect(RELATIONSHIP_HIT_STROKE_WIDTH).toBeGreaterThan(
      RELATIONSHIP_STROKE_WIDTH
    );
  });

  it('exports only finite positive numbers', () => {
    const values = [
      START_X,
      START_Y,
      START_ADD,
      DEFAULT_WIDTH,
      DEFAULT_HEIGHT,
      INPUT_HEIGHT,
      INPUT_MARGIN_RIGHT,
      HEADER_ICON_HEIGHT,
      HEADER_ICON_MARGIN_BOTTOM,
      TABLE_BORDER,
      TABLE_PADDING,
      TABLE_HEADER_PADDING,
      TABLE_HEADER_ICON_MARGIN_BOTTOM,
      TABLE_HEADER_INPUT_HEIGHT,
      TABLE_HEADER_HEIGHT,
      TABLE_HEADER_BUTTON_MARGIN_LEFT,
      COLUMN_DELETE_WIDTH,
      COLUMN_KEY_WIDTH,
      COLUMN_MIN_WIDTH,
      COLUMN_NOT_NULL_WIDTH,
      COLUMN_UNIQUE_WIDTH,
      COLUMN_AUTO_INCREMENT_WIDTH,
      COLUMN_PADDING,
      COLUMN_HEIGHT,
      MEMO_BORDER,
      MEMO_PADDING,
      MEMO_HEADER_HEIGHT,
      MEMO_MIN_WIDTH,
      MEMO_MIN_HEIGHT,
      MINIMAP_SIZE,
      MINIMAP_MARGIN,
      TOOLBAR_HEIGHT,
      DIFF_TREE_WIDTH,
      RELATIONSHIP_STROKE_WIDTH,
      RELATIONSHIP_HIT_STROKE_WIDTH,
    ];

    for (const value of values) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });
});
