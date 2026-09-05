import { ColumnOption, ColumnType } from '@/constants/schema';
import { RootState } from '@/engine/state';
import { Column } from '@/internal-types';
import { arrayHas } from '@/utils/arrayHas';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import {
  Cell,
  CellType,
  getShowColumnOrder,
  hasCellType,
  Row,
} from '@/utils/table-clipboard';
import {
  CLIPBOARD_HTML_ATTR,
  CLIPBOARD_HTML_TRUNCATED_ATTR,
  CLIPBOARD_MIME,
  ClipboardPayload,
  parsePayload,
  ParseResult,
} from '@/utils/table-clipboard/payload';

const hasTruthy = arrayHas(['true', '1', 'yes', 'y']);
const hasNotNullTruthy = arrayHas(['true', '1', 'yes', 'y', 'not null']);

export function tablePasteFromTextToColumns(
  { settings: { show, columnOrder } }: RootState,
  text: string
): Column[] {
  const rows = text.split('\n').map(row => row.split('\t'));
  const showColumnOrder = getShowColumnOrder(show, columnOrder);

  return rows.map(row => {
    const column = createColumn();

    showColumnOrder.forEach((columnType, index) => {
      const value = row[index];
      if (!value) return;

      const newValue = value.trim();
      assignColumn(column, newValue, columnType);
    });

    return column;
  });
}

export function tablePasteFromHtmlToColumns(
  { settings: { show, columnOrder } }: RootState,
  html: string
): Column[] {
  const showColumnOrder = getShowColumnOrder(show, columnOrder);
  const template = document.createElement('template');
  template.innerHTML = html;

  const fragment = template.content;
  const rows: Row[] = Array.from(fragment.querySelectorAll('tr')).map(row =>
    Array.from(row.querySelectorAll<HTMLElement>('td,th')).map<Cell>(cell => [
      (cell.dataset?.type as CellType) ?? '',
      cell.textContent ?? '',
    ])
  );

  return rows.map(row => {
    const column = createColumn();

    showColumnOrder.forEach((columnType, index) => {
      const cell = row[index];
      if (!cell) return;

      const [type, value] = cell;
      const newValue = value.trim();
      assignColumn(column, newValue, columnType, type);
    });

    row
      .filter(([type]) => hasCellType(type))
      .forEach(([type, value]) => {
        const newValue = value.trim();
        assignColumn(column, newValue, 0, type);
      });

    return column;
  });
}

// unsupported must stop the caller's ladder (#408): the rung below parses our
// own <table>, so it always succeeds and appends columns to selected tables.
export function readClipboardPayload(dataTransfer: DataTransfer): ParseResult {
  const json = dataTransfer.getData(CLIPBOARD_MIME);
  if (json) {
    const result = parsePayload(json);
    if (result.status !== 'foreign') return result;
  }

  const html = dataTransfer.getData('text/html');
  if (!html) return { status: 'foreign' };

  const template = document.createElement('template');
  template.innerHTML = html;
  const fragment = template.content;

  const hidden = fragment
    .querySelector(`[${CLIPBOARD_HTML_ATTR}]`)
    ?.getAttribute(CLIPBOARD_HTML_ATTR);
  if (hidden) {
    const result = parsePayload(hidden);
    if (result.status !== 'foreign') return result;
  }

  if (fragment.querySelector(`[${CLIPBOARD_HTML_TRUNCATED_ATTR}]`)) {
    return { status: 'unsupported', version: Number.NaN };
  }

  return { status: 'foreign' };
}

export function payloadToColumns({ columns }: ClipboardPayload): Column[] {
  return columns.map(({ sourceId, tableId, ui, ...rest }) =>
    createColumn({ ...rest, ui: { ...ui, keys: 0 } })
  );
}

function assignColumn(
  column: Column,
  value: string,
  columnType: number,
  cellType: CellType | '' = ''
) {
  if (hasCellType(cellType)) {
    switch (cellType) {
      case CellType.columnName:
        column.name = value;
        break;
      case CellType.columnDataType:
        column.dataType = value;
        break;
      case CellType.columnDefault:
        column.default = value;
        break;
      case CellType.columnComment:
        column.comment = value;
        break;
      case CellType.columnAutoIncrement:
        if (isTruthy(value)) {
          column.options |= ColumnOption.autoIncrement;
        }
        break;
      case CellType.columnUnique:
        if (isTruthy(value)) {
          column.options |= ColumnOption.unique;
        }
        break;
      case CellType.columnNotNull:
        if (hasNotNullTruthy(value.trim().toLowerCase())) {
          column.options |= ColumnOption.notNull;
        }
        break;
    }
    return;
  }

  switch (columnType) {
    case ColumnType.columnName:
      column.name = value;
      break;
    case ColumnType.columnDataType:
      column.dataType = value;
      break;
    case ColumnType.columnDefault:
      column.default = value;
      break;
    case ColumnType.columnComment:
      column.comment = value;
      break;
    case ColumnType.columnAutoIncrement:
      if (isTruthy(value)) {
        column.options |= ColumnOption.autoIncrement;
      }
      break;
    case ColumnType.columnUnique:
      if (isTruthy(value)) {
        column.options |= ColumnOption.unique;
      }
      break;
    case ColumnType.columnNotNull:
      if (hasNotNullTruthy(value.trim().toLowerCase())) {
        column.options |= ColumnOption.notNull;
      }
      break;
  }
}

function isTruthy(value: string) {
  return hasTruthy(value.trim().toLowerCase());
}
