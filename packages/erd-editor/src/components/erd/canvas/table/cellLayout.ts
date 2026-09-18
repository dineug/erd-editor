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
  INPUT_HEIGHT,
  INPUT_MARGIN_RIGHT,
  TABLE_BORDER,
  TABLE_HEADER_BAND_PADDING,
  TABLE_HEADER_NAME_X,
  TABLE_HEADER_PADDING,
  VIEW_COLUMN_ICON_GAP,
  VIEW_COLUMN_ICON_SIZE,
  VIEW_COLUMN_PADDING,
  VIEW_TABLE_HEADER_ICON_SIZE,
  VIEW_TABLE_HEADER_NAME_X,
} from '@/constants/layout';
import { ColumnType, Show } from '@/constants/schema';
import { FocusType } from '@/engine/modules/editor/state';
import type { RootState } from '@/engine/state';
import type { Table } from '@/internal-types';
import type { Theme } from '@/themes/tokens';
import { bHas } from '@/utils/bit';
import {
  type ColumnWidth,
  tableRowHeight,
  viewHeaderNameWidth,
} from '@/utils/calcTable';
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
 * How far down a table group the header cells start. The document band starts
 * at the top border, over the card's top padding, and keeps its own room over
 * the line; a view sets its icon line inside that padding instead.
 */
export function getHeaderCellsY(source: GeometrySource = 'document'): number {
  return source === 'document'
    ? TABLE_BORDER + TABLE_HEADER_BAND_PADDING
    : TABLE_INSET;
}

/**
 * The text line inside a header cell. The document pads its input box; a view
 * starts its line at the top of the icon band, which the card's own padding has
 * already put where the band wants it.
 */
export function getHeaderTextY(source: GeometrySource = 'document'): number {
  return source === 'document' ? TABLE_HEADER_PADDING : 0;
}

/**
 * The box that line is centred in. The document uses the box its editor opens
 * an input in; a view centres on the icon beside the name instead, so the two
 * share one middle.
 */
export function getHeaderTextHeight(
  source: GeometrySource = 'document'
): number {
  return source === 'document'
    ? getCellTextHeight()
    : VIEW_TABLE_HEADER_ICON_SIZE;
}

/** The text line inside a column cell, at the padding its own source lays rows out with. */
export function getColumnTextY(source: GeometrySource = 'document'): number {
  return source === 'document' ? COLUMN_PADDING : VIEW_COLUMN_PADDING;
}

/**
 * The box that line is centred in, the same split: the editor's input box in
 * the document, and the row's own icon band in a view, which is what leaves the
 * text on the badge's middle.
 */
export function getColumnTextHeight(
  source: GeometrySource = 'document',
  fontFamily?: string
): number {
  return source === 'document'
    ? getCellTextHeight(fontFamily)
    : VIEW_COLUMN_ICON_SIZE;
}

/** Where the scene runs its focus rect inside a header cell. */
export const CELL_UNDERLINE_Y = INPUT_HEIGHT - FOCUS_BORDER_HEIGHT;

/**
 * The same rect inside a column cell, along the foot of the line box the row
 * leaves between its two paddings. The document draws it alone, so the row it
 * is measured against is the document's.
 */
export function getColumnUnderlineY(): number {
  return (
    tableRowHeight('document') -
    getColumnTextY('document') * 2 -
    FOCUS_BORDER_HEIGHT
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
 * cell, in the face named or the scene's own. Blink puts a painted baseline on
 * the device grid before the zoom scales it, so only a whole pixel survives both rasterisers.
 *
 * @example
 * const baseline = getCellTextBaseline();
 */
export function getCellTextBaseline(fontFamily?: string): number {
  const { ascent, descent } = getSceneFontMetrics(fontFamily);

  return Math.round(RAW_CELL_TEXT_HEIGHT / 2 + (ascent - descent) / 2);
}

/**
 * The box one line of cell text is centred in, in the face named or the
 * scene's own. The scene hands konva this height with verticalAlign middle and
 * the editor gives its input the same one, which puts the two baselines on one whole pixel.
 *
 * @example
 * const height = getCellTextHeight();
 */
export function getCellTextHeight(fontFamily?: string): number {
  const { ascent, descent } = getSceneFontMetrics(fontFamily);

  return (getCellTextBaseline(fontFamily) - (ascent - descent) / 2) * 2;
}

/** Where a column row's cells start, past the key badge its own source sizes. */
export function getColumnCellsX(source: GeometrySource = 'document'): number {
  return source === 'document'
    ? TABLE_INSET + COLUMN_KEY_WIDTH + INPUT_MARGIN_RIGHT
    : TABLE_INSET + VIEW_COLUMN_ICON_SIZE + VIEW_COLUMN_ICON_GAP;
}

/** The comment width a table draws at, clamped by the setting when it is set. */
export function getWidthComment(state: RootState, table: Table): number {
  const { maxWidthComment } = state.settings;

  return maxWidthComment === -1 || maxWidthComment >= table.ui.widthComment
    ? table.ui.widthComment
    : maxWidthComment;
}

/**
 * The name and comment boxes past a header's table icon. One list feeds the
 * scene that draws them and the overlay that edits them, so an editor never
 * sits anywhere but on the text it replaces. A view draws the name alone.
 */
export function getHeaderCellSlots(
  state: RootState,
  table: Table,
  source: GeometrySource = 'document'
): CellSlot[] {
  const view = source !== 'document';
  const nameX = view ? VIEW_TABLE_HEADER_NAME_X : TABLE_HEADER_NAME_X;
  const slots: CellSlot[] = [
    {
      focusType: FocusType.tableName,
      x: nameX,
      width: view
        ? viewHeaderNameWidth(table.ui.widthName)
        : table.ui.widthName,
    },
  ];

  if (!view && bHas(state.settings.show, Show.tableComment)) {
    slots.push({
      focusType: FocusType.tableComment,
      x: nameX + table.ui.widthName + INPUT_MARGIN_RIGHT,
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
  let cursor = getColumnCellsX(source);
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
