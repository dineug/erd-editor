import { query } from '@dineug/erd-editor-schema';

import {
  COLUMN_AUTO_INCREMENT_WIDTH,
  COLUMN_DELETE_WIDTH,
  COLUMN_HEIGHT,
  COLUMN_KEY_WIDTH,
  COLUMN_MIN_WIDTH,
  COLUMN_NOT_NULL_WIDTH,
  COLUMN_UNIQUE_WIDTH,
  INPUT_MARGIN_RIGHT,
  TABLE_BORDER,
  TABLE_HEADER_HEIGHT,
  TABLE_PADDING,
  VIEW_COLUMN_HEIGHT,
  VIEW_TABLE_HEADER_HEIGHT,
} from '@/constants/layout';
import { Show } from '@/constants/schema';
import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { textInRange } from '@/utils/validation';

/**
 * Bumped whenever anything calcTableWidths reads outside a table's own widths
 * can have changed. A consumer caching a computed size keys on this rather than
 * re-reading every column.
 */
let widthGeneration = 0;

export function getWidthGeneration() {
  return widthGeneration;
}

/**
 * Invalidates every cached table size. Called from recalculateTableWidth,
 * which rewrites widths without dispatching an action, and from the
 * relationship-sort hook for any action that is not a pure move.
 */
export function invalidateTableWidths() {
  widthGeneration++;
}

export function calcTableWidths(
  table: Table,
  { settings: { show, maxWidthComment }, collections }: RootState
): ColumnWidth {
  let width = table.ui.widthName + INPUT_MARGIN_RIGHT;
  if (bHas(show, Show.tableComment)) {
    const widthComment =
      maxWidthComment === -1
        ? table.ui.widthComment
        : maxWidthComment < table.ui.widthComment
          ? maxWidthComment
          : table.ui.widthComment;
    width += widthComment + INPUT_MARGIN_RIGHT;
  }

  const defaultWidthColumns = calcDefaultWidthColumns(show);
  if (width < defaultWidthColumns) {
    width = defaultWidthColumns;
  }

  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  const maxWidthColumn = calcMaxWidthColumn(columns, show, maxWidthComment);
  if (width < maxWidthColumn.width) {
    width = maxWidthColumn.width;
  }

  return {
    ...maxWidthColumn,
    width: TABLE_BORDER + TABLE_PADDING + width + TABLE_PADDING + TABLE_BORDER,
  };
}

const DEFAULT_WIDTH_COLUMNS: Array<{
  key: number;
  width: number;
}> = [
  {
    key: Show.columnComment,
    width: COLUMN_MIN_WIDTH,
  },
  {
    key: Show.columnDataType,
    width: COLUMN_MIN_WIDTH,
  },
  {
    key: Show.columnDefault,
    width: COLUMN_MIN_WIDTH,
  },
  {
    key: Show.columnNotNull,
    width: COLUMN_NOT_NULL_WIDTH,
  },
  {
    key: Show.columnAutoIncrement,
    width: COLUMN_AUTO_INCREMENT_WIDTH,
  },
  {
    key: Show.columnUnique,
    width: COLUMN_UNIQUE_WIDTH,
  },
];

function calcDefaultWidthColumns(show: number) {
  return DEFAULT_WIDTH_COLUMNS.reduce(
    (acc, { key, width }) =>
      bHas(show, key) ? acc + width + INPUT_MARGIN_RIGHT : acc,
    COLUMN_KEY_WIDTH +
      INPUT_MARGIN_RIGHT +
      COLUMN_MIN_WIDTH +
      INPUT_MARGIN_RIGHT +
      COLUMN_DELETE_WIDTH
  );
}

export type ColumnWidth = {
  width: number;
  name: number;
  comment: number;
  dataType: number;
  default: number;
  notNull: number;
  autoIncrement: number;
  unique: number;
};

function calcMaxWidthColumn(
  columns: Column[],
  show: number,
  maxWidthComment: number
): ColumnWidth {
  const columnWidth: ColumnWidth = {
    width: 0,
    name: 0,
    comment: 0,
    dataType: 0,
    default: 0,
    notNull: 0,
    autoIncrement: 0,
    unique: 0,
  };

  for (const column of columns) {
    if (columnWidth.name < column.ui.widthName) {
      columnWidth.name = column.ui.widthName;
    }

    if (
      bHas(show, Show.columnComment) &&
      columnWidth.comment < column.ui.widthComment
    ) {
      const widthComment =
        maxWidthComment === -1
          ? column.ui.widthComment
          : maxWidthComment < column.ui.widthComment
            ? maxWidthComment
            : column.ui.widthComment;
      columnWidth.comment = widthComment;
    }

    if (
      bHas(show, Show.columnDataType) &&
      columnWidth.dataType < column.ui.widthDataType
    ) {
      columnWidth.dataType = column.ui.widthDataType;
    }

    if (
      bHas(show, Show.columnDefault) &&
      columnWidth.default < column.ui.widthDefault
    ) {
      columnWidth.default = column.ui.widthDefault;
    }
  }

  if (bHas(show, Show.columnNotNull)) {
    columnWidth.notNull = COLUMN_NOT_NULL_WIDTH;
  }

  if (bHas(show, Show.columnAutoIncrement)) {
    columnWidth.autoIncrement = COLUMN_AUTO_INCREMENT_WIDTH;
  }

  if (bHas(show, Show.columnUnique)) {
    columnWidth.unique = COLUMN_UNIQUE_WIDTH;
  }

  columnWidth.width = Object.entries(columnWidth).reduce(
    (acc, [key, width]) => {
      if (key === 'width' || width === 0) {
        return acc;
      }

      return acc + width + INPUT_MARGIN_RIGHT;
    },
    COLUMN_KEY_WIDTH + INPUT_MARGIN_RIGHT + COLUMN_DELETE_WIDTH
  );

  return columnWidth;
}

/**
 * The width a view draws a table at: the header name, or the key badge with
 * the widest name and type among the rows given, whichever is wider. The rows
 * are the caller's to name, and the show bits and the column order are the document's, read by no view.
 */
export function calcViewTableWidths(
  table: Table,
  state: RootState,
  columnIds: string[]
): ColumnWidth {
  const columnWidth: ColumnWidth = {
    width: 0,
    name: 0,
    comment: 0,
    dataType: 0,
    default: 0,
    notNull: 0,
    autoIncrement: 0,
    unique: 0,
  };
  const columns = query(state.collections)
    .collection('tableColumnEntities')
    .selectByIds(columnIds);

  // The type is counted whether or not it is drawn, so lighting a table
  // never changes its width.
  for (const column of columns) {
    columnWidth.name = Math.max(columnWidth.name, column.ui.widthName);
    columnWidth.dataType = Math.max(
      columnWidth.dataType,
      column.ui.widthDataType
    );
  }

  const rowWidth = columns.length
    ? COLUMN_KEY_WIDTH +
      INPUT_MARGIN_RIGHT +
      columnWidth.name +
      INPUT_MARGIN_RIGHT +
      columnWidth.dataType +
      INPUT_MARGIN_RIGHT
    : 0;
  const headerWidth = table.ui.widthName + INPUT_MARGIN_RIGHT;
  columnWidth.width =
    TABLE_BORDER +
    TABLE_PADDING +
    Math.max(headerWidth, rowWidth) +
    TABLE_PADDING +
    TABLE_BORDER;

  return columnWidth;
}

/**
 * The header band a source draws above its rows. A view has no icon band over
 * the name, so its card is that much shorter than the same table in the
 * document.
 */
export function tableHeaderHeight(source: GeometrySource = 'document'): number {
  return source === 'document' ? TABLE_HEADER_HEIGHT : VIEW_TABLE_HEADER_HEIGHT;
}

/**
 * The height of one row a source draws. The document row is sized around the
 * input box an editor opens in it and the view row around a line of read only
 * text, so the two are independent numbers.
 */
export function tableRowHeight(source: GeometrySource = 'document'): number {
  return source === 'document' ? COLUMN_HEIGHT : VIEW_COLUMN_HEIGHT;
}

/** The box height for the rows given, every row of the table unless a view shows fewer. */
export function calcTableHeight(
  table: Table,
  rowCount: number = table.columnIds.length,
  source: GeometrySource = 'document'
): number {
  return (
    TABLE_BORDER +
    TABLE_PADDING +
    tableHeaderHeight(source) +
    rowCount * tableRowHeight(source) +
    TABLE_PADDING +
    TABLE_BORDER
  );
}

export function recalculateTableWidth(
  { doc: { tableIds }, collections }: RootState,
  { toWidth }: EngineContext
) {
  // Rewrites every ui.width* without dispatching an action, so a size cache
  // has no other way to learn it went stale.
  invalidateTableWidths();

  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds);
  const columnCollection = query(collections).collection('tableColumnEntities');

  for (const table of tables) {
    table.ui.widthName = textInRange(toWidth(table.name));
    table.ui.widthComment = textInRange(toWidth(table.comment));

    const columns = columnCollection.selectByIds(table.columnIds);

    for (const column of columns) {
      column.ui.widthName = textInRange(toWidth(column.name));
      column.ui.widthDataType = textInRange(toWidth(column.dataType));
      column.ui.widthDefault = textInRange(toWidth(column.default));
      column.ui.widthComment = textInRange(toWidth(column.comment));
    }
  }
}
