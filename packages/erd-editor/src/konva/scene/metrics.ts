import {
  COLUMN_HEIGHT,
  TABLE_BORDER,
  TABLE_HEADER_HEIGHT,
  TABLE_PADDING,
} from '@/constants/layout';
import { RootState } from '@/engine/state';
import { Memo, Table } from '@/internal-types';
import { calcMemoHeight, calcMemoWidth } from '@/utils/calcMemo';
import { calcTableWidths, type ColumnWidth } from '@/utils/calcTable';
import { tableToObjectPoint } from '@/utils/draw-relationship/calc';

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** The border and padding a table's own size is built out of, on one side. */
const TABLE_INSET = TABLE_BORDER + TABLE_PADDING;

/**
 * The box a table occupies in schema coordinates. The size is the one the
 * relationship sort measures anchors against, so a scene node and the connectors
 * reaching it cannot disagree about where an edge is.
 */
export function getTableRect(state: RootState, table: Table): Rect {
  const { width, height } = tableToObjectPoint(state, table);
  const { x, y } = table.ui;

  return { x, y, width, height };
}

/**
 * The cell widths a table's rows are laid out against. The total here and the
 * width in getTableRect are the same sum reached by two routes, the box through
 * the sort's cache and this fresh, which is the split the DOM scene drew with.
 */
export function getTableWidths(state: RootState, table: Table): ColumnWidth {
  return calcTableWidths(table, state);
}

/**
 * One column row, taken apart from the same sum calcTableHeight adds up: the
 * rows start below the header inside the table's inset, and each is one
 * COLUMN_HEIGHT tall.
 */
export function getColumnRect(
  state: RootState,
  table: Table,
  index: number
): Rect {
  const { x, y, width } = getTableRect(state, table);

  return {
    x: x + TABLE_INSET,
    y: y + TABLE_INSET + TABLE_HEADER_HEIGHT + index * COLUMN_HEIGHT,
    width: width - TABLE_INSET * 2,
    height: COLUMN_HEIGHT,
  };
}

/** The box a memo occupies, sash and header included. */
export function getMemoRect(memo: Memo): Rect {
  const { x, y } = memo.ui;

  return { x, y, width: calcMemoWidth(memo), height: calcMemoHeight(memo) };
}
