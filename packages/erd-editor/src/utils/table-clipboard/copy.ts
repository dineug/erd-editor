import { query } from '@dineug/erd-editor-schema';
import { arrayHas } from '@dineug/shared';

import { ColumnOption, ColumnType } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { bHas } from '@/utils/bit';
import { CellType, getShowColumnOrder, Row } from '@/utils/table-clipboard';

export function tableCopyToText(state: RootState): string {
  return getTableData(state)
    .map(row => row.map(([, value]) => value).join('\t'))
    .join('\n');
}

export function tableCopyToHtml(state: RootState): string {
  const rows = getTableData(state);
  return rows.length === 0
    ? ''
    : `<table><tbody>${rows
        .map(
          row =>
            `<tr>${row
              .map(([type, value]) => `<td data-type="${type}">${value}</td>`)
              .join('')}</tr>`
        )
        .join('')}</tbody></table>`;
}

function getTableData({
  editor: { focusTable },
  settings: { show, columnOrder },
  collections,
}: RootState): Row[] {
  const rows: Row[] = [];
  if (
    !focusTable ||
    focusTable.edit ||
    focusTable.selectColumnIds.length === 0
  ) {
    return rows;
  }

  const table = query(collections)
    .collection('tableEntities')
    .selectById(focusTable.tableId);
  if (!table) return rows;

  const hasColumnIds = arrayHas(focusTable.selectColumnIds);
  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .filter(column => hasColumnIds(column.id));

  const showColumnOrder = getShowColumnOrder(show, columnOrder);

  return columns.map(column =>
    showColumnOrder.map(columnType => {
      switch (columnType) {
        case ColumnType.columnName:
          return [CellType.columnName, column.name];
        case ColumnType.columnDataType:
          return [CellType.columnDataType, column.dataType];
        case ColumnType.columnDefault:
          return [CellType.columnDefault, column.default];
        case ColumnType.columnComment:
          return [CellType.columnComment, column.comment];
        case ColumnType.columnAutoIncrement:
          return [
            CellType.columnAutoIncrement,
            bHas(column.options, ColumnOption.autoIncrement) ? 'TRUE' : 'FALSE',
          ];
        case ColumnType.columnUnique:
          return [
            CellType.columnUnique,
            bHas(column.options, ColumnOption.unique) ? 'TRUE' : 'FALSE',
          ];
        case ColumnType.columnNotNull:
          return [
            CellType.columnNotNull,
            bHas(column.options, ColumnOption.notNull) ? 'NOT NULL' : 'NULL',
          ];
        default:
          return ['', ''];
      }
    })
  );
}
