import { ColumnWidth, Column } from '@@types/engine/store/table.state';
import { Show } from '@@types/engine/store/canvas.state';
import {
  SIZE_MIN_WIDTH,
  SIZE_COLUMN_OPTION_NN,
  SIZE_COLUMN_OPTION_AI,
  SIZE_COLUMN_OPTION_QU,
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
    if (columnWidth.name < column.ui.widthName) {
      columnWidth.name = column.ui.widthName;
    }
    if (show.columnComment && columnWidth.comment < column.ui.widthComment) {
      columnWidth.comment = column.ui.widthComment;
    }
    if (show.columnDataType && columnWidth.dataType < column.ui.widthDataType) {
      columnWidth.dataType = column.ui.widthDataType;
    }
    if (show.columnDefault && columnWidth.default < column.ui.widthDefault) {
      columnWidth.default = column.ui.widthDefault;
    }
  });
  if (show.columnNotNull) {
    columnWidth.notNull = SIZE_COLUMN_OPTION_NN;
  }
  if (show.columnAutoIncrement) {
    columnWidth.autoIncrement = SIZE_COLUMN_OPTION_AI;
  }
  if (show.columnUnique) {
    columnWidth.unique = SIZE_COLUMN_OPTION_QU;
  }
  Object.keys(columnWidth)
    .filter(key => key !== 'width')
    .forEach(key => {
      const k = key as ColumnWidthKey;
      if (columnWidth[k] !== 0) {
        columnWidth.width += columnWidth[k] + SIZE_COLUMN_MARGIN_RIGHT;
      }
    });
  return columnWidth;
}

export function getDefaultWidthColumn(show: Show): number {
  let width = SIZE_MIN_WIDTH + SIZE_COLUMN_MARGIN_RIGHT;
  if (show.columnComment) {
    width += SIZE_MIN_WIDTH + SIZE_COLUMN_MARGIN_RIGHT;
  }
  if (show.columnDataType) {
    width += SIZE_MIN_WIDTH + SIZE_COLUMN_MARGIN_RIGHT;
  }
  if (show.columnDefault) {
    width += SIZE_MIN_WIDTH + SIZE_COLUMN_MARGIN_RIGHT;
  }
  if (show.columnNotNull) {
    width += SIZE_COLUMN_OPTION_NN + SIZE_COLUMN_MARGIN_RIGHT;
  }
  if (show.columnAutoIncrement) {
    width += SIZE_COLUMN_OPTION_AI + SIZE_COLUMN_MARGIN_RIGHT;
  }
  if (show.columnUnique) {
    width += SIZE_COLUMN_OPTION_QU + SIZE_COLUMN_MARGIN_RIGHT;
  }
  return width;
}
