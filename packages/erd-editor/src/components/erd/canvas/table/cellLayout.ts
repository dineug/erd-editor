import {
  FOCUS_BORDER_HEIGHT,
  getSceneFontMetrics,
  TABLE_INSET,
} from '@/components/erd/canvas/sceneTokens';
import {
  COLUMN_AUTO_INCREMENT_WIDTH,
  COLUMN_KEY_WIDTH,
  COLUMN_NOT_NULL_WIDTH,
  COLUMN_PADDING,
  COLUMN_UNIQUE_WIDTH,
  HEADER_ICON_HEIGHT,
  INPUT_HEIGHT,
  INPUT_MARGIN_RIGHT,
  TABLE_HEADER_ICON_MARGIN_BOTTOM,
  TABLE_HEADER_PADDING,
  VIEW_COLUMN_PADDING,
} from '@/constants/layout';
import { ColumnType, Show } from '@/constants/schema';
import { FocusType } from '@/engine/modules/editor/state';
import type { RootState } from '@/engine/state';
import type { Table } from '@/internal-types';
import type { Theme } from '@/themes/tokens';
import { bHas } from '@/utils/bit';
import { type ColumnWidth, tableRowHeight } from '@/utils/calcTable';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

/** The four widths a column row measures from its table; the rest are fixed. */
export type ColumnCellWidths = Pick<
  ColumnWidth,
  'comment' | 'dataType' | 'default' | 'name'
>;

/** One editable box on a table, positioned inside the table's own group. */
export type CellSlot = {
  focusType: FocusType;
  x: number;
  width: number;
};

export type ColumnCellSlot = CellSlot & {
  columnType: number;
};

/** Where the header cell row starts inside a table group. */
export const HEADER_CELLS_X = TABLE_INSET;

/**
 * How far down a table group the header cells start. The document keeps the
 * icon band above them; a view draws no icon there, so its cells begin at the
 * inset itself.
 */
export function getHeaderCellsY(source: GeometrySource = 'document'): number {
  return source === 'document'
    ? TABLE_INSET + HEADER_ICON_HEIGHT + TABLE_HEADER_ICON_MARGIN_BOTTOM
    : TABLE_INSET;
}

/**
 * The text line inside a header cell. One value for both sources: a view header
 * is exactly the padded name box the document header ends with, which is what
 * VIEW_TABLE_HEADER_HEIGHT says.
 */
export const HEADER_TEXT_Y = TABLE_HEADER_PADDING;

/** The text line inside a column cell, at the padding its own source lays rows out with. */
export function getColumnTextY(source: GeometrySource = 'document'): number {
  return source === 'document' ? COLUMN_PADDING : VIEW_COLUMN_PADDING;
}

/** Where the scene runs its focus rect inside a header cell. */
export const CELL_UNDERLINE_Y = INPUT_HEIGHT - FOCUS_BORDER_HEIGHT;

/**
 * The same rect inside a column cell, along the foot of the line box the row
 * leaves between its two paddings. The document row leaves the header's box, a
 * view row a shorter one.
 */
export function getColumnUnderlineY(
  source: GeometrySource = 'document'
): number {
  return (
    tableRowHeight(source) - getColumnTextY(source) * 2 - FOCUS_BORDER_HEIGHT
  );
}

/**
 * The paint that focus rect takes, header and column both: the input colour
 * while the cell is being edited, and greyed out with the rest of the focus
 * while the editor is not the one holding the keyboard.
 */
export function focusBorderFill(
  theme: Theme,
  edit: boolean,
  editorFocused: boolean | undefined
): string {
  if (edit) return theme.inputActive;
  if (editorFocused === false) return theme.placeholder;
  return theme.focus;
}

/** The line box a cell reserves above its underline, before it is put on a grid. */
const RAW_CELL_TEXT_HEIGHT = CELL_UNDERLINE_Y;

/**
 * The baseline one line of cell text is drawn on, down from the top of the
 * cell. Blink puts a painted baseline on the device grid before the zoom scales
 * it, so only a whole pixel survives both rasterisers unchanged.
 *
 * @example
 * const baseline = getCellTextBaseline();
 */
export function getCellTextBaseline(): number {
  const { ascent, descent } = getSceneFontMetrics();

  return Math.round(RAW_CELL_TEXT_HEIGHT / 2 + (ascent - descent) / 2);
}

/**
 * The box one line of cell text is centred in. The scene hands konva this
 * height with verticalAlign middle and the editor gives its input the same one,
 * which is what puts the two baselines on one whole pixel instead of two.
 *
 * @example
 * const height = getCellTextHeight();
 */
export function getCellTextHeight(): number {
  const { ascent, descent } = getSceneFontMetrics();

  return (getCellTextBaseline() - (ascent - descent) / 2) * 2;
}

/** Where a column row's cells start, past the key badge. */
export const COLUMN_CELLS_X =
  TABLE_INSET + COLUMN_KEY_WIDTH + INPUT_MARGIN_RIGHT;

/** The comment width a table draws at, clamped by the setting when it is set. */
export function getWidthComment(state: RootState, table: Table): number {
  const { maxWidthComment } = state.settings;

  return maxWidthComment === -1 || maxWidthComment >= table.ui.widthComment
    ? table.ui.widthComment
    : maxWidthComment;
}

/**
 * The name and comment boxes across a table header. One list feeds both the
 * scene that draws them and the overlay that edits them, so an editor can never
 * sit anywhere but on the text it replaces. A view draws the name alone.
 */
export function getHeaderCellSlots(
  state: RootState,
  table: Table,
  source: GeometrySource = 'document'
): CellSlot[] {
  const slots: CellSlot[] = [
    { focusType: FocusType.tableName, x: 0, width: table.ui.widthName },
  ];

  if (source === 'document' && bHas(state.settings.show, Show.tableComment)) {
    slots.push({
      focusType: FocusType.tableComment,
      x: table.ui.widthName + INPUT_MARGIN_RIGHT,
      width: getWidthComment(state, table),
    });
  }

  return slots;
}

const COLUMN_SLOTS: Array<{
  columnType: number;
  focusType: FocusType;
  show: number | null;
  width: (widths: ColumnCellWidths) => number;
}> = [
  {
    columnType: ColumnType.columnName,
    focusType: FocusType.columnName,
    show: null,
    width: widths => widths.name,
  },
  {
    columnType: ColumnType.columnDefault,
    focusType: FocusType.columnDefault,
    show: Show.columnDefault,
    width: widths => widths.default,
  },
  {
    columnType: ColumnType.columnComment,
    focusType: FocusType.columnComment,
    show: Show.columnComment,
    width: widths => widths.comment,
  },
  {
    columnType: ColumnType.columnDataType,
    focusType: FocusType.columnDataType,
    show: Show.columnDataType,
    width: widths => widths.dataType,
  },
  {
    columnType: ColumnType.columnNotNull,
    focusType: FocusType.columnNotNull,
    show: Show.columnNotNull,
    width: () => COLUMN_NOT_NULL_WIDTH,
  },
  {
    columnType: ColumnType.columnUnique,
    focusType: FocusType.columnUnique,
    show: Show.columnUnique,
    width: () => COLUMN_UNIQUE_WIDTH,
  },
  {
    columnType: ColumnType.columnAutoIncrement,
    focusType: FocusType.columnAutoIncrement,
    show: Show.columnAutoIncrement,
    width: () => COLUMN_AUTO_INCREMENT_WIDTH,
  },
];

/** The cells a view draws in every row, whatever the settings show or order. */
const VIEW_COLUMN_ORDER: number[] = [
  ColumnType.columnName,
  ColumnType.columnDataType,
];

/**
 * The cells of one column row, in the order the settings put them and at the x
 * each lands on once the ones before it have taken their width. A view lays
 * out the name and the type and reads neither the show bits nor the order.
 */
export function getColumnCellSlots(
  state: RootState,
  widths: ColumnCellWidths,
  source: GeometrySource = 'document'
): ColumnCellSlot[] {
  const { settings } = state;
  const slots: ColumnCellSlot[] = [];
  let cursor = COLUMN_CELLS_X;
  const order =
    source === 'document' ? settings.columnOrder : VIEW_COLUMN_ORDER;

  for (const columnType of order) {
    const definition = COLUMN_SLOTS.find(
      slot => slot.columnType === columnType
    );
    if (!definition) continue;
    if (
      source === 'document' &&
      definition.show !== null &&
      !bHas(settings.show, definition.show)
    ) {
      continue;
    }

    const width = definition.width(widths);
    slots.push({
      columnType,
      focusType: definition.focusType,
      x: cursor,
      width,
    });
    cursor += width + INPUT_MARGIN_RIGHT;
  }

  return slots;
}
