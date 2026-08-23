export const START_X = 200;
export const START_Y = 100;
export const START_ADD = 50;

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
 * How thick a relationship connector is drawn.
 *
 * Down from 3: the thick line ate the gap between neighbouring tables and made a
 * busy diagram read as a mass of strokes rather than as connections. A whole
 * number rather than 1.5, so the stroke lands on pixel boundaries instead of
 * being spread across two rows at partial alpha on a 1x display.
 */
export const RELATIONSHIP_STROKE_WIDTH = 2;

/**
 * The width of the invisible band that catches the pointer for a connector.
 *
 * Hit-testing an SVG path follows its painted stroke, so halving the stroke
 * would otherwise halve the target the user has to hit to hover a relationship
 * or open its context menu. `NUDGE_GAP` is 10, so a band this wide stays clear
 * of the neighbouring corridor except where the router had to fall back to a
 * narrower gap.
 */
export const RELATIONSHIP_HIT_STROKE_WIDTH = 8;
