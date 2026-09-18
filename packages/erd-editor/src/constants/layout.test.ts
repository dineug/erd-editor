import { describe, expect, it } from 'vite-plus/test';

import {
  CELL_FONT_SIZE,
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
  TABLE_HEADER_BAND_PADDING,
  TABLE_HEADER_BUTTON_MARGIN_LEFT,
  TABLE_HEADER_BUTTONS_WIDTH,
  TABLE_HEADER_HEIGHT,
  TABLE_HEADER_ICON_GAP,
  TABLE_HEADER_ICON_SIZE,
  TABLE_HEADER_INPUT_HEIGHT,
  TABLE_HEADER_PADDING,
  TABLE_PADDING,
  TOOLBAR_HEIGHT,
  VIEW_COLUMN_HEIGHT,
  VIEW_COLUMN_ICON_GAP,
  VIEW_COLUMN_ICON_SIZE,
  VIEW_COLUMN_PADDING,
  VIEW_TABLE_HEADER_BUTTON_SIZE,
  VIEW_TABLE_HEADER_FONT_SCALE,
  VIEW_TABLE_HEADER_FONT_SIZE,
  VIEW_TABLE_HEADER_HEIGHT,
  VIEW_TABLE_HEADER_ICON_GAP,
  VIEW_TABLE_HEADER_ICON_SIZE,
  VIEW_TABLE_HEADER_WEIGHT_SCALE,
  VIEW_TABLE_MIN_WIDTH,
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

  it('composes the table header from one padded input line and its band room', () => {
    expect(TABLE_BORDER).toBe(1);
    expect(TABLE_PADDING).toBe(8);
    expect(TABLE_HEADER_PADDING).toBe(2);
    expect(TABLE_HEADER_BUTTON_MARGIN_LEFT).toBe(4);

    expect(TABLE_HEADER_INPUT_HEIGHT).toBe(24);
    expect(TABLE_HEADER_INPUT_HEIGHT).toBe(
      INPUT_HEIGHT + TABLE_HEADER_PADDING * 2
    );

    expect(TABLE_HEADER_BAND_PADDING).toBe(2);
    expect(TABLE_HEADER_HEIGHT).toBe(20);
    expect(TABLE_HEADER_HEIGHT).toBe(
      TABLE_HEADER_INPUT_HEIGHT + TABLE_HEADER_BAND_PADDING * 2 - TABLE_PADDING
    );
    // The band starts at the top border, over the card's top padding: the line
    // and its room, 28 from the border down, a little taller than a row.
    expect(TABLE_PADDING + TABLE_HEADER_HEIGHT).toBe(28);
    expect(TABLE_PADDING + TABLE_HEADER_HEIGHT).toBeGreaterThan(COLUMN_HEIGHT);
  });

  it('sets the header icon in the key column and reserves the header buttons their strip', () => {
    expect(TABLE_HEADER_ICON_SIZE).toBe(COLUMN_KEY_WIDTH);
    expect(TABLE_HEADER_ICON_GAP).toBe(INPUT_MARGIN_RIGHT);
    expect(TABLE_HEADER_BUTTONS_WIDTH).toBe(28);
    expect(TABLE_HEADER_BUTTONS_WIDTH).toBe(
      HEADER_ICON_HEIGHT * 2 + TABLE_HEADER_BUTTON_MARGIN_LEFT
    );
  });

  it('composes the column row height from the padded input', () => {
    expect(COLUMN_PADDING).toBe(2);
    expect(COLUMN_HEIGHT).toBe(24);
    expect(COLUMN_HEIGHT).toBe(INPUT_HEIGHT + COLUMN_PADDING * 2);
  });

  it('builds the view header from its icon line and the card padding', () => {
    expect(VIEW_TABLE_HEADER_ICON_SIZE).toBe(16);
    expect(VIEW_TABLE_HEADER_ICON_GAP).toBe(4);
    expect(VIEW_TABLE_HEADER_HEIGHT).toBe(24);
    expect(VIEW_TABLE_HEADER_HEIGHT).toBe(
      VIEW_TABLE_HEADER_ICON_SIZE + TABLE_PADDING
    );
    // The card's own top padding is the band's other half, so the icon line
    // sits centred in the 32 the header takes from the top border down.
    expect(TABLE_PADDING + VIEW_TABLE_HEADER_HEIGHT).toBe(
      TABLE_PADDING * 2 + VIEW_TABLE_HEADER_ICON_SIZE
    );
    // A view pads its icon line inside a taller band than the document's line.
    expect(TABLE_PADDING + VIEW_TABLE_HEADER_HEIGHT).toBeGreaterThan(
      TABLE_PADDING + TABLE_HEADER_HEIGHT
    );
  });

  it('draws the view header name larger than the rows under it', () => {
    expect(CELL_FONT_SIZE).toBe(12);
    expect(VIEW_TABLE_HEADER_FONT_SIZE).toBe(14);
    expect(VIEW_TABLE_HEADER_FONT_SIZE).toBeGreaterThan(CELL_FONT_SIZE);
    expect(VIEW_TABLE_HEADER_FONT_SCALE).toBe(14 / 12);
  });

  /**
   * The name is drawn heavier as well as larger, and a medium face is wider
   * than the regular it was measured at, so a slot scaled by the size alone
   * would clip a long name the card was sized to hold.
   */
  it('leaves room for the weight the header name is drawn at too', () => {
    expect(VIEW_TABLE_HEADER_WEIGHT_SCALE).toBeGreaterThan(1);
    expect(VIEW_TABLE_HEADER_WEIGHT_SCALE).toBeLessThan(1.1);
  });

  it('sizes a view row from its icon line rather than the input height', () => {
    expect(VIEW_COLUMN_ICON_SIZE).toBe(16);
    expect(VIEW_COLUMN_ICON_GAP).toBe(6);
    expect(VIEW_COLUMN_HEIGHT).toBe(32);
    expect(VIEW_COLUMN_PADDING).toBe(8);
    expect(VIEW_COLUMN_HEIGHT).toBe(
      VIEW_COLUMN_ICON_SIZE + VIEW_COLUMN_PADDING * 2
    );
    // The document row is an input box plus its padding; the view row is not,
    // so the two sums differ and the view number stands on its own.
    expect(VIEW_COLUMN_HEIGHT).not.toBe(INPUT_HEIGHT + VIEW_COLUMN_PADDING * 2);
    expect(VIEW_COLUMN_HEIGHT).toBeGreaterThan(COLUMN_HEIGHT);
    expect(VIEW_TABLE_HEADER_BUTTON_SIZE).toBe(12);
  });

  it('never draws a view card under the minimum width', () => {
    expect(VIEW_TABLE_MIN_WIDTH).toBe(172);
    expect(VIEW_TABLE_MIN_WIDTH).toBeGreaterThan(
      (TABLE_BORDER + TABLE_PADDING) * 2 +
        VIEW_COLUMN_ICON_SIZE +
        VIEW_COLUMN_ICON_GAP +
        COLUMN_MIN_WIDTH
    );
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
      TABLE_HEADER_INPUT_HEIGHT,
      TABLE_HEADER_BAND_PADDING,
      TABLE_HEADER_HEIGHT,
      TABLE_HEADER_BUTTON_MARGIN_LEFT,
      TABLE_HEADER_BUTTONS_WIDTH,
      TABLE_HEADER_ICON_SIZE,
      TABLE_HEADER_ICON_GAP,
      COLUMN_DELETE_WIDTH,
      COLUMN_KEY_WIDTH,
      COLUMN_MIN_WIDTH,
      COLUMN_NOT_NULL_WIDTH,
      COLUMN_UNIQUE_WIDTH,
      COLUMN_AUTO_INCREMENT_WIDTH,
      COLUMN_PADDING,
      COLUMN_HEIGHT,
      CELL_FONT_SIZE,
      VIEW_TABLE_HEADER_HEIGHT,
      VIEW_TABLE_HEADER_ICON_SIZE,
      VIEW_TABLE_HEADER_ICON_GAP,
      VIEW_TABLE_HEADER_FONT_SIZE,
      VIEW_TABLE_HEADER_FONT_SCALE,
      VIEW_TABLE_HEADER_WEIGHT_SCALE,
      VIEW_TABLE_HEADER_BUTTON_SIZE,
      VIEW_TABLE_MIN_WIDTH,
      VIEW_COLUMN_HEIGHT,
      VIEW_COLUMN_ICON_SIZE,
      VIEW_COLUMN_ICON_GAP,
      VIEW_COLUMN_PADDING,
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
