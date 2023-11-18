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
} from '@/constants/layout';
import { Show } from '@/constants/schema';
import { EngineContext } from '@/engine/context';
import { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { query } from '@/utils/collection/query';
import { textInRange } from '@/utils/validation';

export function calcTableWidths(
  table: Table,
  { settings: { show }, collections }: RootState
): ColumnWidth {
  let width = table.ui.widthName + INPUT_MARGIN_RIGHT;
  if (bHas(show, Show.tableComment)) {
    width += table.ui.widthComment + INPUT_MARGIN_RIGHT;
  }

  const defaultWidthColumns = calcDefaultWidthColumns(show);
  if (width < defaultWidthColumns) {
    width = defaultWidthColumns;
  }

  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  const maxWidthColumn = calcMaxWidthColumn(columns, show);
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

type ColumnWidth = {
  width: number;
  name: number;
  comment: number;
  dataType: number;
  default: number;
  notNull: number;
  autoIncrement: number;
  unique: number;
};

function calcMaxWidthColumn(columns: Column[], show: number): ColumnWidth {
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
      columnWidth.comment = column.ui.widthComment;
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

export function calcTableHeight(table: Table): number {
  return (
    TABLE_BORDER +
    TABLE_PADDING +
    TABLE_HEADER_HEIGHT +
    table.columnIds.length * COLUMN_HEIGHT +
    TABLE_PADDING +
    TABLE_BORDER
  );
}

export function recalculateTableWidth(
  { doc: { tableIds }, collections }: RootState,
  { toWidth }: EngineContext
) {
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds);

  for (const table of tables) {
    table.ui.widthName = textInRange(toWidth(table.name));
    table.ui.widthComment = textInRange(toWidth(table.comment));

    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(table.columnIds);

    for (const column of columns) {
      column.ui.widthName = textInRange(toWidth(column.name));
      column.ui.widthDataType = textInRange(toWidth(column.dataType));
      column.ui.widthDefault = textInRange(toWidth(column.default));
      column.ui.widthComment = textInRange(toWidth(column.comment));
    }
  }
}
