export const START_X = 200;
export const START_Y = 100;
export const START_ADD = 50;

export const DUPLICATE_MIN_MOVE = 4;

/**
 * How far, in screen px, a press on a cell that also takes a click travels
 * before it carries its entity, so a double click that wobbles still edits.
 */
export const CLICK_DRAG_MIN_MOVE = 4;

const RATIO_WIDTH = 16;
const RATIO_HEIGHT = 9;
export const DEFAULT_WIDTH = 1200;
export const DEFAULT_HEIGHT = (DEFAULT_WIDTH / RATIO_WIDTH) * RATIO_HEIGHT;

/** The px a table cell's text is drawn at, which the scene and the view header scale read. */
export const CELL_FONT_SIZE = 12;

export const INPUT_HEIGHT = 20;
export const INPUT_MARGIN_RIGHT = 8;

/** The height of one row in the data type autocomplete list. */
export const DATA_TYPE_HINT_ROW_HEIGHT = 20;

/** How many of those rows the list shows before it scrolls the rest. */
export const DATA_TYPE_HINT_MAX_ROWS = 10;

export const HEADER_ICON_HEIGHT = 12;
export const HEADER_ICON_MARGIN_BOTTOM = 4;

export const TABLE_BORDER = 1;
export const TABLE_PADDING = 8;
export const TABLE_HEADER_PADDING = 2;
export const TABLE_HEADER_INPUT_HEIGHT =
  INPUT_HEIGHT + TABLE_HEADER_PADDING * 2;

/** The room a table's header band keeps above and below its input line. */
export const TABLE_HEADER_BAND_PADDING = 2;

/**
 * What a table's header adds under the card's top padding. The band starts at
 * the top border instead, over that padding: one input line and its own room,
 * a little taller than a row, holding the add column and remove buttons too.
 */
export const TABLE_HEADER_HEIGHT =
  TABLE_HEADER_INPUT_HEIGHT + TABLE_HEADER_BAND_PADDING * 2 - TABLE_PADDING;
export const TABLE_HEADER_BUTTON_MARGIN_LEFT = 4;

/** How wide the colour a table wears along its left edge is drawn. */
export const TABLE_COLOR_WIDTH = 4;

/** The strip the two header buttons take along the right end of the header line. */
export const TABLE_HEADER_BUTTONS_WIDTH =
  HEADER_ICON_HEIGHT * 2 + TABLE_HEADER_BUTTON_MARGIN_LEFT;

export const COLUMN_DELETE_WIDTH = 12;
export const COLUMN_KEY_WIDTH = 12;

/** The table icon before the name, at the key badge's size so the two stand in one column. */
export const TABLE_HEADER_ICON_SIZE = COLUMN_KEY_WIDTH;

/** The gap after that icon, the one a key badge keeps, which lines the name up with the column names. */
export const TABLE_HEADER_ICON_GAP = INPUT_MARGIN_RIGHT;
export const COLUMN_MIN_WIDTH = 60;
export const COLUMN_NOT_NULL_WIDTH = 35;
export const COLUMN_UNIQUE_WIDTH = 22;
export const COLUMN_AUTO_INCREMENT_WIDTH = 15;
export const COLUMN_PADDING = 2;
export const COLUMN_HEIGHT = INPUT_HEIGHT + COLUMN_PADDING * 2;

/** The table icon a view card draws beside its name, at the reference's 1rem. */
export const VIEW_TABLE_HEADER_ICON_SIZE = 16;

/** The gap between that icon and the name, the reference's one unit of spacing. */
export const VIEW_TABLE_HEADER_ICON_GAP = 4;

/** The size a view card draws its header name at, over the size its rows take. */
export const VIEW_TABLE_HEADER_FONT_SIZE = 14;

/**
 * How much wider a string is at that size than at the one it was measured with.
 * A face advances a glyph in proportion to its size, so a measured width scales
 * rather than having to be measured a second time.
 */
export const VIEW_TABLE_HEADER_FONT_SCALE =
  VIEW_TABLE_HEADER_FONT_SIZE / CELL_FONT_SIZE;

/**
 * How much wider again the header name is at the medium weight a view draws it
 * in, over the regular every ui width was measured with. A host with no medium
 * of its own synthesises one wider still, so the slot carries the room for both.
 */
export const VIEW_TABLE_HEADER_WEIGHT_SCALE = 1.04;

/** The header a view card draws: the icon line with the card's own padding under it. */
export const VIEW_TABLE_HEADER_HEIGHT =
  VIEW_TABLE_HEADER_ICON_SIZE + TABLE_PADDING;

/** The key badge a view row draws, at the size the reference gives a row icon. */
export const VIEW_COLUMN_ICON_SIZE = 16;

/** The gap between that badge and the name, the reference's one and a half units. */
export const VIEW_COLUMN_ICON_GAP = 6;

/** The gap above and below the content of a view row, the reference's two units. */
export const VIEW_COLUMN_PADDING = 8;

/**
 * The row a view card draws, written down as that icon line inside that padding
 * rather than derived from INPUT_HEIGHT: a view row is a line of read only
 * text, not the editable input box the document row is sized around.
 */
export const VIEW_COLUMN_HEIGHT =
  VIEW_COLUMN_ICON_SIZE + VIEW_COLUMN_PADDING * 2;

/** The width a view card is never drawn under, which is the reference's node minimum. */
export const VIEW_TABLE_MIN_WIDTH = 172;

/** The size of a button in a view card's header. */
export const VIEW_TABLE_HEADER_BUTTON_SIZE = 12;

/** The strip the two of them take along the right edge of that header. */
export const VIEW_TABLE_HEADER_BUTTONS_WIDTH =
  VIEW_TABLE_HEADER_BUTTON_SIZE * 2 + TABLE_HEADER_BUTTON_MARGIN_LEFT;

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
 * The same connector inside a view, at the reference's hairline. A particle
 * riding a lit one is 2.4 units across, so a heavier line swallows it: what a
 * reader sees moving is the bulge the particle makes over the stroke, not a colour of its own.
 */
export const VIEW_RELATIONSHIP_STROKE_WIDTH = 1;

/**
 * The invisible band that catches the pointer for a connector, because
 * hit-testing follows the painted stroke. Narrower than NUDGE_GAP, so it stays
 * clear of the neighbouring corridor at the router's usual separation.
 */
export const RELATIONSHIP_HIT_STROKE_WIDTH = 8;
