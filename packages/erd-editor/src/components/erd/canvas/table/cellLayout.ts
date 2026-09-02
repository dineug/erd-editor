import {
  FOCUS_BORDER_HEIGHT,
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
} from '@/constants/layout';
import { ColumnType, Show } from '@/constants/schema';
import { FocusType } from '@/engine/modules/editor/state';
import type { RootState } from '@/engine/state';
import type { Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import type { ColumnWidth } from '@/utils/calcTable';

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
export const HEADER_CELLS_Y =
  TABLE_INSET + HEADER_ICON_HEIGHT + TABLE_HEADER_ICON_MARGIN_BOTTOM;

/** The text line inside a header cell and inside a column cell. */
export const HEADER_TEXT_Y = TABLE_HEADER_PADDING;
export const COLUMN_TEXT_Y = COLUMN_PADDING;

/**
 * The box one line of cell text is laid out in. The scene hands konva this
 * height with verticalAlign middle and the editor gives its input the same one,
 * which is what puts the two baselines in one place instead of two.
 */
export const CELL_TEXT_HEIGHT = INPUT_HEIGHT;

/** Where the scene runs its focus rect inside that box, header and column both. */
export const CELL_UNDERLINE_Y = CELL_TEXT_HEIGHT - FOCUS_BORDER_HEIGHT;

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
 * sit anywhere but on the text it replaces.
 */
export function getHeaderCellSlots(state: RootState, table: Table): CellSlot[] {
  const slots: CellSlot[] = [
    { focusType: FocusType.tableName, x: 0, width: table.ui.widthName },
  ];

  if (bHas(state.settings.show, Show.tableComment)) {
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

/**
 * The cells of one column row, in the order the settings put them and at the x
 * each lands on once the ones before it have taken their width.
 */
export function getColumnCellSlots(
  state: RootState,
  widths: ColumnCellWidths
): ColumnCellSlot[] {
  const { settings } = state;
  const slots: ColumnCellSlot[] = [];
  let cursor = COLUMN_CELLS_X;

  for (const columnType of settings.columnOrder) {
    const definition = COLUMN_SLOTS.find(
      slot => slot.columnType === columnType
    );
    if (!definition) continue;
    if (definition.show !== null && !bHas(settings.show, definition.show)) {
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
