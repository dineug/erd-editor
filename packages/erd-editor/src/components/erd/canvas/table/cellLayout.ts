import {
  FOCUS_BORDER_HEIGHT,
  getSceneFontMetrics,
  SCENE_CODE_FONT_FAMILY,
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
import { ColumnType } from '@/constants/schema';
import { FocusType } from '@/engine/modules/editor/state';
import {
  ColumnTypeShown,
  getTableFocusTypes,
  getViewColumnTypes,
  sceneNameSettings,
  toNameViewFocusType,
} from '@/engine/modules/editor/utils/nameView';
import type { RootState } from '@/engine/state';
import type { Table } from '@/internal-types';
import type { Theme } from '@/themes/tokens';
import {
  type ColumnWidth,
  headerCellWidth,
  tableRowHeight,
  viewHeaderNameWidth,
} from '@/utils/calcTable';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

/** The six widths a column row measures from its table; the rest are fixed. */
export type ColumnCellWidths = Pick<
  ColumnWidth,
  'comment' | 'dataType' | 'default' | 'domain' | 'logicalName' | 'name'
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

/**
 * Where a document row's alternate key mark starts: one margin past the last
 * of the cells given, whatever order the settings put them in. The mark is
 * derived, so it is no cell of that order and nothing focuses, edits or moves it.
 */
export function getAlternateKeyMarkX(slots: ColumnCellSlot[]): number {
  const last = slots[slots.length - 1];

  return last ? last.x + last.width + INPUT_MARGIN_RIGHT : getColumnCellsX();
}

/**
 * The box the mark's code face line is centred in, so it stands on the text
 * face's baseline, the one the cell before it is drawn on, and not on its own.
 */
export function getAlternateKeyMarkHeight(): number {
  const { ascent, descent } = getSceneFontMetrics(SCENE_CODE_FONT_FAMILY);

  return (getCellTextBaseline() - (ascent - descent) / 2) * 2;
}

/** The comment width a table draws at, clamped by the setting when it is set. */
export function getWidthComment(state: RootState, table: Table): number {
  return headerCellWidth(state, table, FocusType.tableComment);
}

/**
 * The name and comment boxes past a header's table icon. One list feeds the
 * scene that draws them and the overlay that edits them, so an editor never
 * sits anywhere but on the text it replaces. A view draws the names alone.
 */
export function getHeaderCellSlots(
  state: RootState,
  table: Table,
  source: GeometrySource = 'document'
): CellSlot[] {
  const view = source !== 'document';
  // The name view picks the name cells, the logical name in the name's place
  // or before it, and each cell starts past the ones before it and a margin.
  const slots: CellSlot[] = [];
  let cursor = view ? VIEW_TABLE_HEADER_NAME_X : TABLE_HEADER_NAME_X;

  for (const focusType of getTableFocusTypes(
    sceneNameSettings(state.settings, source)
  )) {
    const measured = headerCellWidth(state, table, focusType);
    const width = view ? viewHeaderNameWidth(measured) : measured;
    slots.push({ focusType, x: cursor, width });
    cursor += width + INPUT_MARGIN_RIGHT;
  }

  return slots;
}

/**
 * Where each column type's cell goes in a row. The focus is the physical
 * view's, which the name view turns into its own; the document lays the cell
 * out only while the visible predicate holds.
 */
const COLUMN_SLOTS: Array<{
  columnType: number;
  focusType: FocusType;
  visible: (settings: RootState['settings']) => boolean;
  width: (widths: ColumnCellWidths) => number;
}> = [
  {
    columnType: ColumnType.columnLogicalName,
    focusType: FocusType.columnLogicalName,
    visible: ColumnTypeShown[ColumnType.columnLogicalName],
    width: widths => widths.logicalName,
  },
  {
    columnType: ColumnType.columnName,
    focusType: FocusType.columnName,
    visible: ColumnTypeShown[ColumnType.columnName],
    width: widths => widths.name,
  },
  {
    columnType: ColumnType.columnDefault,
    focusType: FocusType.columnDefault,
    visible: ColumnTypeShown[ColumnType.columnDefault],
    width: widths => widths.default,
  },
  {
    columnType: ColumnType.columnComment,
    focusType: FocusType.columnComment,
    visible: ColumnTypeShown[ColumnType.columnComment],
    width: widths => widths.comment,
  },
  {
    columnType: ColumnType.columnDataType,
    focusType: FocusType.columnDataType,
    visible: ColumnTypeShown[ColumnType.columnDataType],
    width: widths => widths.dataType,
  },
  {
    columnType: ColumnType.columnDomain,
    focusType: FocusType.columnDomain,
    visible: ColumnTypeShown[ColumnType.columnDomain],
    width: widths => widths.domain,
  },
  {
    columnType: ColumnType.columnNotNull,
    focusType: FocusType.columnNotNull,
    visible: ColumnTypeShown[ColumnType.columnNotNull],
    width: () => COLUMN_NOT_NULL_WIDTH,
  },
  {
    columnType: ColumnType.columnUnique,
    focusType: FocusType.columnUnique,
    visible: ColumnTypeShown[ColumnType.columnUnique],
    width: () => COLUMN_UNIQUE_WIDTH,
  },
  {
    columnType: ColumnType.columnAutoIncrement,
    focusType: FocusType.columnAutoIncrement,
    visible: ColumnTypeShown[ColumnType.columnAutoIncrement],
    width: () => COLUMN_AUTO_INCREMENT_WIDTH,
  },
];

/**
 * The cells of one column row, in the order the settings put them and at the x
 * each lands on once the ones before it have taken their width. A view lays
 * out the cells its name view names and reads neither the show bits nor the order.
 */
export function getColumnCellSlots(
  state: RootState,
  widths: ColumnCellWidths,
  source: GeometrySource = 'document'
): ColumnCellSlot[] {
  const { settings } = state;
  const inDocument = source === 'document';
  const shown = sceneNameSettings(settings, source);
  const slots: ColumnCellSlot[] = [];
  let cursor = getColumnCellsX(source);
  const order = inDocument
    ? settings.columnOrder
    : getViewColumnTypes(settings);

  for (const columnType of order) {
    const definition = COLUMN_SLOTS.find(
      slot => slot.columnType === columnType
    );
    if (!definition) continue;
    if (inDocument && !definition.visible(settings)) continue;

    const width = definition.width(widths);
    slots.push({
      columnType,
      focusType: toNameViewFocusType(shown, definition.focusType),
      x: cursor,
      width,
    });
    cursor += width + INPUT_MARGIN_RIGHT;
  }

  return slots;
}
