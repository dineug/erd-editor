export const START_X = 200;
export const START_Y = 100;
export const START_ADD = 50;

export const DUPLICATE_MIN_MOVE = 4;

const RATIO_WIDTH = 16;
const RATIO_HEIGHT = 9;
export const DEFAULT_WIDTH = 1200;
export const DEFAULT_HEIGHT = (DEFAULT_WIDTH / RATIO_WIDTH) * RATIO_HEIGHT;

export const INPUT_HEIGHT = 20;
export const INPUT_MARGIN_RIGHT = 8;

export const HEADER_ICON_HEIGHT = 12;
export const HEADER_ICON_MARGIN_BOTTOM = 4;

export const TABLE_BORDER = 1;
export const TABLE_PADDING = 8;
export const TABLE_HEADER_PADDING = 2;
export const TABLE_HEADER_ICON_MARGIN_BOTTOM = 2;
export const TABLE_HEADER_INPUT_HEIGHT =
  INPUT_HEIGHT + TABLE_HEADER_PADDING * 2;
export const TABLE_HEADER_HEIGHT =
  HEADER_ICON_HEIGHT +
  TABLE_HEADER_ICON_MARGIN_BOTTOM +
  TABLE_HEADER_INPUT_HEIGHT;
export const TABLE_HEADER_BUTTON_MARGIN_LEFT = 4;

export const COLUMN_DELETE_WIDTH = 12;
export const COLUMN_KEY_WIDTH = 12;
export const COLUMN_MIN_WIDTH = 60;
export const COLUMN_NOT_NULL_WIDTH = 35;
export const COLUMN_UNIQUE_WIDTH = 22;
export const COLUMN_AUTO_INCREMENT_WIDTH = 15;
export const COLUMN_PADDING = 2;
export const COLUMN_HEIGHT = INPUT_HEIGHT + COLUMN_PADDING * 2;

export const MEMO_BORDER = 1;
export const MEMO_PADDING = 8;
export const MEMO_HEADER_HEIGHT =
  HEADER_ICON_HEIGHT + HEADER_ICON_MARGIN_BOTTOM;

export const MEMO_MIN_WIDTH = 100 + MEMO_HEADER_HEIGHT;
export const MEMO_MIN_HEIGHT = 100;

export const MINIMAP_SIZE = 150;
export const MINIMAP_MARGIN = 20;

export const TOOLBAR_HEIGHT = 30;

export const DIFF_TREE_WIDTH = 200;

/**
 * How thick a relationship connector is drawn. A whole number rather than a
 * fraction, so the stroke lands on pixel boundaries instead of spreading across
 * two rows at partial alpha on a 1x display.
 */
export const RELATIONSHIP_STROKE_WIDTH = 2;

/**
 * The invisible band that catches the pointer for a connector, because
 * hit-testing follows the painted stroke. Narrower than NUDGE_GAP, so it stays
 * clear of the neighbouring corridor at the router's usual separation.
 */
export const RELATIONSHIP_HIT_STROKE_WIDTH = 8;
