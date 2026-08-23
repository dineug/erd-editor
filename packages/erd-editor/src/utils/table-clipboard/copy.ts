import { query } from '@dineug/erd-editor-schema';
import { arrayHas } from '@dineug/shared';

import { ColumnOption, ColumnType } from '@/constants/schema';
import { SelectType } from '@/engine/modules/editor/state';
import { RootState } from '@/engine/state';
import { Column, Memo, Settings, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import {
  Cell,
  CellType,
  CLIPBOARD_HTML_ATTR,
  CLIPBOARD_HTML_TRUNCATED_ATTR,
  ClipboardColumn,
  ClipboardMemo,
  ClipboardPayload,
  ClipboardTable,
  createPayload,
  getShowColumnOrder,
  HTML_PAYLOAD_MAX_BYTES,
  PayloadKind,
  Row,
} from '@/utils/table-clipboard';

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

export function entitiesCopyToPayload({
  editor: { selectedMap },
  collections,
}: RootState): ClipboardPayload | null {
  const tableIds: string[] = [];
  const memoIds: string[] = [];

  for (const [id, selectType] of Object.entries(selectedMap)) {
    if (selectType === SelectType.table) {
      tableIds.push(id);
    } else if (selectType === SelectType.memo) {
      memoIds.push(id);
    }
  }

  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds);
  const memos = query(collections)
    .collection('memoEntities')
    .selectByIds(memoIds);

  if (tables.length === 0 && memos.length === 0) return null;

  const columns = tables.flatMap(table =>
    query(collections)
      .collection('tableColumnEntities')
      .selectByIds(table.columnIds)
  );

  return createPayload({
    kind: PayloadKind.tables,
    tables: tables.map(toClipboardTable),
    columns: columns.map(toClipboardColumn),
    memos: memos.map(toClipboardMemo),
  });
}

export function columnsCopyToPayload({
  editor: { focusTable },
  collections,
}: RootState): ClipboardPayload | null {
  if (
    !focusTable ||
    focusTable.edit ||
    focusTable.selectColumnIds.length === 0
  ) {
    return null;
  }

  const table = query(collections)
    .collection('tableEntities')
    .selectById(focusTable.tableId);
  const hasColumnIds = arrayHas(focusTable.selectColumnIds);
  const columns = table
    ? query(collections)
        .collection('tableColumnEntities')
        .selectByIds(table.columnIds)
        .filter(column => hasColumnIds(column.id))
    : [];

  return createPayload({
    kind: PayloadKind.columns,
    columns: columns.map(toClipboardColumn),
  });
}

export function entitiesToTsv(
  payload: ClipboardPayload,
  settings: Settings
): string {
  return payload.tables.length === 0
    ? payload.memos.map(({ value }) => value).join('\n\n')
    : toEntityRows(payload, settings)
        .map(row => row.map(([, value]) => value).join('\t'))
        .join('\n');
}

export function entitiesToHtmlTable(
  payload: ClipboardPayload,
  settings: Settings
): string {
  const rows = toEntityRows(payload, settings);

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

export function payloadToHtml(
  payload: ClipboardPayload,
  tableHtml: string
): string {
  const json = escapeHtmlAttribute(JSON.stringify(payload));

  return byteLength(json) > HTML_PAYLOAD_MAX_BYTES
    ? `<span ${CLIPBOARD_HTML_TRUNCATED_ATTR}="1">${tableHtml}</span>`
    : `<span ${CLIPBOARD_HTML_ATTR}="${json}">${tableHtml}</span>`;
}

function toClipboardTable(table: Table): ClipboardTable {
  return {
    sourceId: table.id,
    name: table.name,
    comment: table.comment,
    columnIds: [...table.columnIds],
    ui: {
      x: table.ui.x,
      y: table.ui.y,
      zIndex: table.ui.zIndex,
      widthName: table.ui.widthName,
      widthComment: table.ui.widthComment,
      color: table.ui.color,
    },
  };
}

function toClipboardColumn(column: Column): ClipboardColumn {
  return {
    sourceId: column.id,
    tableId: column.tableId,
    name: column.name,
    comment: column.comment,
    dataType: column.dataType,
    default: column.default,
    options: column.options,
    ui: {
      keys: column.ui.keys,
      widthName: column.ui.widthName,
      widthComment: column.ui.widthComment,
      widthDataType: column.ui.widthDataType,
      widthDefault: column.ui.widthDefault,
    },
  };
}

function toClipboardMemo(memo: Memo): ClipboardMemo {
  return {
    sourceId: memo.id,
    value: memo.value,
    ui: {
      x: memo.ui.x,
      y: memo.ui.y,
      width: memo.ui.width,
      height: memo.ui.height,
      zIndex: memo.ui.zIndex,
      color: memo.ui.color,
    },
  };
}

function toEntityRows(
  payload: ClipboardPayload,
  { show, columnOrder }: Settings
): Row[] {
  const showColumnOrder = getShowColumnOrder(show, columnOrder);
  const columnMap = new Map(
    payload.columns.map(column => [column.sourceId, column])
  );

  return payload.tables.flatMap(table =>
    table.columnIds
      .map(columnId => columnMap.get(columnId))
      .filter((column): column is ClipboardColumn => Boolean(column))
      .map(column =>
        showColumnOrder.map(columnType => toEntityCell(column, columnType))
      )
  );
}

function toEntityCell(column: ClipboardColumn, columnType: number): Cell {
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
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&<>"']/g, char => HTML_ESCAPE_MAP[char]);
}

const textEncoder = new TextEncoder();

function byteLength(value: string): number {
  return textEncoder.encode(value).length;
}
