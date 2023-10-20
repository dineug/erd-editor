import { SchemaV3Constants } from '@dineug/erd-editor-schema';

import {
  COLUMN_AUTO_INCREMENT_WIDTH,
  COLUMN_DELETE_WIDTH,
  COLUMN_HEIGHT,
  COLUMN_KEY_WIDTH,
  COLUMN_MIN_WIDTH,
  COLUMN_NOT_NULL_WIDTH,
  COLUMN_UNIQUE_WIDTH,
  TABLE_HEADER_HEIGHT,
  TABLE_PADDING,
} from '@/constants/layout';
import { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import { query } from '@/utils/collection/query';

function isShow(show: number, value: number): boolean {
  return (show & value) === value;
}

export function calcTableWidths(
  table: Table,
  { settings: { show }, collections }: RootState
): ColumnWidth {
  let width = table.ui.widthName;
  if (isShow(show, SchemaV3Constants.Show.tableComment)) {
    width += table.ui.widthComment;
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
    width,
  };
}

const DEFAULT_WIDTH_COLUMNS: Array<{
  key: number;
  width: number;
}> = [
  {
    key: SchemaV3Constants.Show.columnComment,
    width: COLUMN_MIN_WIDTH,
  },
  {
    key: SchemaV3Constants.Show.columnDataType,
    width: COLUMN_MIN_WIDTH,
  },
  {
    key: SchemaV3Constants.Show.columnDefault,
    width: COLUMN_MIN_WIDTH,
  },
  {
    key: SchemaV3Constants.Show.columnNotNull,
    width: COLUMN_NOT_NULL_WIDTH,
  },
  {
    key: SchemaV3Constants.Show.columnAutoIncrement,
    width: COLUMN_AUTO_INCREMENT_WIDTH,
  },
  {
    key: SchemaV3Constants.Show.columnUnique,
    width: COLUMN_UNIQUE_WIDTH,
  },
];

function calcDefaultWidthColumns(show: number) {
  return DEFAULT_WIDTH_COLUMNS.reduce(
    (acc, { key, width }) => (isShow(show, key) ? acc + width : acc),
    COLUMN_MIN_WIDTH + COLUMN_KEY_WIDTH + COLUMN_DELETE_WIDTH
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
      isShow(show, SchemaV3Constants.Show.columnComment) &&
      columnWidth.comment < column.ui.widthComment
    ) {
      columnWidth.comment = column.ui.widthComment;
    }

    if (
      isShow(show, SchemaV3Constants.Show.columnDataType) &&
      columnWidth.dataType < column.ui.widthDataType
    ) {
      columnWidth.dataType = column.ui.widthDataType;
    }

    if (
      isShow(show, SchemaV3Constants.Show.columnDefault) &&
      columnWidth.default < column.ui.widthDefault
    ) {
      columnWidth.default = column.ui.widthDefault;
    }
  }

  if (show & SchemaV3Constants.Show.columnNotNull) {
    columnWidth.notNull = COLUMN_NOT_NULL_WIDTH;
  }

  if (show & SchemaV3Constants.Show.columnAutoIncrement) {
    columnWidth.autoIncrement = COLUMN_AUTO_INCREMENT_WIDTH;
  }

  if (show & SchemaV3Constants.Show.columnUnique) {
    columnWidth.unique = COLUMN_UNIQUE_WIDTH;
  }

  columnWidth.width = Object.entries(columnWidth).reduce(
    (acc, [key, width]) => (key === 'width' ? acc : acc + width),
    COLUMN_KEY_WIDTH + COLUMN_DELETE_WIDTH
  );

  return columnWidth;
}

export function calcTableHeight(table: Table) {
  return (
    TABLE_HEADER_HEIGHT +
    table.columnIds.length * COLUMN_HEIGHT +
    TABLE_PADDING * 2
  );
}
