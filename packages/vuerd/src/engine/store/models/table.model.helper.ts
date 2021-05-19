import { ColumnWidth, Column } from '@@types/engine/store/table.state';
import { Show, ShowKey } from '@@types/engine/store/canvas.state';
import {
  SIZE_MIN_WIDTH,
  SIZE_COLUMN_OPTION_NN,
  SIZE_COLUMN_OPTION_AI,
  SIZE_COLUMN_OPTION_UQ,
  SIZE_COLUMN_MARGIN_RIGHT,
} from '@/core/layout';

type ColumnWidthKey =
  | 'width'
  | 'name'
  | 'comment'
  | 'dataType'
  | 'default'
  | 'notNull'
  | 'autoIncrement'
  | 'unique';

export function getMaxWidthColumn(columns: Column[], show: Show) {
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

  columns.forEach(column => {
    columnWidth.name < column.ui.widthName &&
      (columnWidth.name = column.ui.widthName);

    show.columnComment &&
      columnWidth.comment < column.ui.widthComment &&
      (columnWidth.comment = column.ui.widthComment);

    show.columnDataType &&
      columnWidth.dataType < column.ui.widthDataType &&
      (columnWidth.dataType = column.ui.widthDataType);

    show.columnDefault &&
      columnWidth.default < column.ui.widthDefault &&
      (columnWidth.default = column.ui.widthDefault);
  });

  show.columnNotNull && (columnWidth.notNull = SIZE_COLUMN_OPTION_NN);
  show.columnUnique && (columnWidth.unique = SIZE_COLUMN_OPTION_UQ);
  show.columnAutoIncrement &&
    (columnWidth.autoIncrement = SIZE_COLUMN_OPTION_AI);

  Object.keys(columnWidth)
    .filter(key => key !== 'width')
    .forEach(key => {
      const k = key as ColumnWidthKey;
      if (!columnWidth[k]) return;

      columnWidth.width += columnWidth[k] + SIZE_COLUMN_MARGIN_RIGHT;
    });

  return columnWidth;
}

const defaultWidthColumnMap: Array<{ key: ShowKey; width: number }> = [
  {
    key: 'columnComment',
    width: SIZE_MIN_WIDTH,
  },
  {
    key: 'columnDataType',
    width: SIZE_MIN_WIDTH,
  },
  {
    key: 'columnDefault',
    width: SIZE_MIN_WIDTH,
  },
  {
    key: 'columnNotNull',
    width: SIZE_COLUMN_OPTION_NN,
  },
  {
    key: 'columnAutoIncrement',
    width: SIZE_COLUMN_OPTION_AI,
  },
  {
    key: 'columnUnique',
    width: SIZE_COLUMN_OPTION_UQ,
  },
];

export function getDefaultWidthColumn(show: Show): number {
  let width = SIZE_MIN_WIDTH + SIZE_COLUMN_MARGIN_RIGHT;

  defaultWidthColumnMap.forEach(
    data => show[data.key] && (width += data.width + SIZE_COLUMN_MARGIN_RIGHT)
  );

  return width;
}
