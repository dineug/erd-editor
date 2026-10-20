import { last } from 'es-toolkit';

import { ColumnOption, ColumnType } from '@/constants/schema';
import { findDomain } from '@/engine/modules/dictionary/dictionaryIndex';
import { isDomainInTypeCell } from '@/engine/modules/editor/utils/nameView';
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

const CellTypeOf: Readonly<Record<number, CellType>> = {
  [ColumnType.columnName]: CellType.columnName,
  [ColumnType.columnLogicalName]: CellType.columnLogicalName,
  [ColumnType.columnDataType]: CellType.columnDataType,
  [ColumnType.columnDomain]: CellType.columnDomain,
  [ColumnType.columnNotNull]: CellType.columnNotNull,
  [ColumnType.columnUnique]: CellType.columnUnique,
  [ColumnType.columnAutoIncrement]: CellType.columnAutoIncrement,
  [ColumnType.columnDefault]: CellType.columnDefault,
  [ColumnType.columnComment]: CellType.columnComment,
};

/** A row as it is read: its column, the name its domain cell gave and whether a cell gave its type. */
type PastedRow = {
  column: Column;
  domainName: string | null;
  typed: boolean;
};

const createPastedRow = (): PastedRow => ({
  column: createColumn(),
  domainName: null,
  typed: false,
});

/**
 * What the cell in a column type's place holds. The logical view's type cell
 * draws a domain by its name, so a text naming a domain the document lists is
 * that domain there, and any other text a type.
 */
function cellTypeAt(
  state: RootState,
  columnType: number,
  value: string
): CellType | '' {
  if (
    columnType === ColumnType.columnDataType &&
    isDomainInTypeCell(state.settings)
  ) {
    return findDomain(state, value)
      ? CellType.columnDomain
      : CellType.columnDataType;
  }
  return CellTypeOf[columnType] ?? '';
}

/**
 * The column a row reads into. A domain cell links the domain of its name the
 * document lists, none where it lists no such domain, and gives the column
 * that domain's type unless a cell of the row gave one.
 */
function toPastedColumn(
  state: RootState,
  { column, domainName, typed }: PastedRow
): Column {
  if (domainName === null) return column;

  const domain = findDomain(state, domainName);
  column.domainId = domain?.id ?? '';
  if (domain && !typed) column.dataType = domain.dataType;
  return column;
}

export function tablePasteFromTextToColumns(
  state: RootState,
  text: string
): Column[] {
  const { show, columnOrder, nameViewMode } = state.settings;
  const lines = text.split(/\r?\n/);
  // A spreadsheet ends the last row with a line break too, which closes that
  // row rather than opening an empty one.
  if (lines.length > 1 && last(lines) === '') lines.pop();

  const rows = lines.map(line => line.split('\t'));
  const showColumnOrder = getShowColumnOrder(show, columnOrder, nameViewMode);

  return rows.map(cells => {
    const row = createPastedRow();

    showColumnOrder.forEach((columnType, index) => {
      const value = cells[index];
      if (!value) return;

      const newValue = value.trim();
      assignCell(row, newValue, cellTypeAt(state, columnType, newValue));
    });

    return toPastedColumn(state, row);
  });
}

export function tablePasteFromHtmlToColumns(
  state: RootState,
  html: string
): Column[] {
  const { show, columnOrder, nameViewMode } = state.settings;
  const showColumnOrder = getShowColumnOrder(show, columnOrder, nameViewMode);
  const template = document.createElement('template');
  template.innerHTML = html;

  const fragment = template.content;
  const rows: Row[] = Array.from(fragment.querySelectorAll('tr')).map(row =>
    Array.from(row.querySelectorAll<HTMLElement>('td,th')).map<Cell>(cell => [
      (cell.dataset?.type as CellType) ?? '',
      cell.textContent ?? '',
    ])
  );

  return rows.map(cells => {
    const row = createPastedRow();

    showColumnOrder.forEach((columnType, index) => {
      const cell = cells[index];
      if (!cell) return;

      const [type, value] = cell;
      const newValue = value.trim();
      assignCell(
        row,
        newValue,
        hasCellType(type) ? type : cellTypeAt(state, columnType, newValue)
      );
    });

    cells
      .filter(([type]) => hasCellType(type))
      .forEach(([type, value]) => {
        assignCell(row, value.trim(), type);
      });

    return toPastedColumn(state, row);
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

function assignCell(row: PastedRow, value: string, cellType: CellType | '') {
  const { column } = row;

  switch (cellType) {
    case CellType.columnName:
      column.name = value;
      break;
    case CellType.columnLogicalName:
      column.logicalName = value;
      break;
    case CellType.columnDataType:
      column.dataType = value;
      row.typed = true;
      break;
    case CellType.columnDomain:
      row.domainName = value;
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
}

function isTruthy(value: string) {
  return hasTruthy(value.trim().toLowerCase());
}
