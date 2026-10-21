import { query } from '@dineug/erd-editor-schema';
import { observable } from '@dineug/r-html';

import {
  COLUMN_ALTERNATE_KEY_CHAR_WIDTH,
  COLUMN_AUTO_INCREMENT_WIDTH,
  COLUMN_DELETE_WIDTH,
  COLUMN_HEIGHT,
  COLUMN_KEY_WIDTH,
  COLUMN_MIN_WIDTH,
  COLUMN_NOT_NULL_WIDTH,
  COLUMN_UNIQUE_WIDTH,
  INPUT_MARGIN_RIGHT,
  TABLE_BORDER,
  TABLE_HEADER_BUTTONS_WIDTH,
  TABLE_HEADER_HEIGHT,
  TABLE_HEADER_NAME_X,
  TABLE_PADDING,
  VIEW_COLUMN_HEIGHT,
  VIEW_COLUMN_ICON_GAP,
  VIEW_COLUMN_ICON_SIZE,
  VIEW_TABLE_HEADER_BUTTONS_WIDTH,
  VIEW_TABLE_HEADER_FONT_SCALE,
  VIEW_TABLE_HEADER_HEIGHT,
  VIEW_TABLE_HEADER_NAME_X,
  VIEW_TABLE_HEADER_WEIGHT_SCALE,
  VIEW_TABLE_MIN_WIDTH,
} from '@/constants/layout';
import { Show } from '@/constants/schema';
import { EngineContext } from '@/engine/context';
import { getLiveDomainName } from '@/engine/modules/dictionary/membership';
import { FocusType } from '@/engine/modules/editor/state';
import {
  drawsDomainInTypeCell,
  drawsNameForLogicalName,
  getTableFocusTypes,
  isBothNameView,
  isLogicalNameView,
  sceneNameSettings,
} from '@/engine/modules/editor/utils/nameView';
import { RootState } from '@/engine/state';
import { Column, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { getAlternateKeyMarks } from '@/utils/tableKeys';
import { textInRange } from '@/utils/validation';

/**
 * Bumped whenever anything calcTableWidths reads outside a table's own widths
 * can have changed. A consumer caching a computed size keys on this rather than
 * re-reading every column.
 */
let widthGeneration = 0;

/**
 * The generation again, observable, for the few renders that size other tables
 * through the cache: a cache hit reads no column, so such a render would never
 * hear a member's column widen. A table's own render reads its columns itself.
 */
const widthSignal = observable({ generation: 0 });

export function getWidthGeneration() {
  return widthGeneration;
}

/**
 * Reads the generation through the observable, so the render calling it runs
 * again whenever any table's widths may have changed.
 *
 * @example
 * trackTableWidths();
 * const rect = getTableRect(state, member);
 */
export function trackTableWidths(): number {
  return widthSignal.generation;
}

/**
 * Invalidates every cached table size. Called from recalculateTableWidth,
 * which rewrites widths without dispatching an action, and from the
 * relationship-sort hook for any action that is not a pure move.
 */
export function invalidateTableWidths() {
  widthGeneration++;
  widthSignal.generation = widthGeneration;
}

/**
 * The room a row keeps for the table's alternate key marks after its last
 * cell: the longest mark, or none while the marks are hidden or the table has
 * none, so only a table that shows one widens.
 */
export function calcAlternateKeyWidth(table: Table, state: RootState): number {
  if (!bHas(state.settings.show, Show.columnAlternateKey)) return 0;

  return Object.values(getAlternateKeyMarks(state, table)).reduce(
    (width, mark) =>
      Math.max(width, Math.ceil(mark.length * COLUMN_ALTERNATE_KEY_CHAR_WIDTH)),
    0
  );
}

/**
 * The width a document header gives the cell of a focus type: the comment at
 * its clamp, and the logical name at its own width in the view of both names
 * or, in the logical view, at the name's while it holds none, which that view draws.
 */
export function headerCellWidth(
  state: RootState,
  table: Table,
  focusType: FocusType
): number {
  const { settings } = state;

  switch (focusType) {
    case FocusType.tableComment:
      return settings.maxWidthComment === -1 ||
        settings.maxWidthComment >= table.ui.widthComment
        ? table.ui.widthComment
        : settings.maxWidthComment;
    case FocusType.tableLogicalName:
      return drawsNameForLogicalName(settings, table)
        ? table.ui.widthName
        : table.ui.widthLogicalName;
    default:
      return table.ui.widthName;
  }
}

export function calcTableWidths(table: Table, state: RootState): ColumnWidth {
  const { settings, collections } = state;
  let width = getTableFocusTypes(settings).reduce(
    (acc, focusType) =>
      acc + headerCellWidth(state, table, focusType) + INPUT_MARGIN_RIGHT,
    TABLE_HEADER_NAME_X
  );
  // The two buttons share the header line, so the line keeps their room past
  // the last cell and a long name ends before them rather than under them.
  width += TABLE_HEADER_BUTTONS_WIDTH;

  const alternateKey = calcAlternateKeyWidth(table, state);
  const defaultWidthColumns =
    calcDefaultWidthColumns(settings) +
    (alternateKey ? alternateKey + INPUT_MARGIN_RIGHT : 0);
  if (width < defaultWidthColumns) {
    width = defaultWidthColumns;
  }

  const columns = query(collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  const maxWidthColumn = calcMaxWidthColumn(columns, state, alternateKey);
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
    key: Show.columnDomain,
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

/**
 * The least row a document lays out: every cell shown at its least width, the
 * logical name's among them in the view of both names.
 */
function calcDefaultWidthColumns(settings: RootState['settings']) {
  const shown = DEFAULT_WIDTH_COLUMNS.reduce(
    (acc, { key, width }) =>
      bHas(settings.show, key) ? acc + width + INPUT_MARGIN_RIGHT : acc,
    COLUMN_KEY_WIDTH +
      INPUT_MARGIN_RIGHT +
      COLUMN_MIN_WIDTH +
      INPUT_MARGIN_RIGHT +
      COLUMN_DELETE_WIDTH
  );

  return isBothNameView(settings)
    ? shown + COLUMN_MIN_WIDTH + INPUT_MARGIN_RIGHT
    : shown;
}

/**
 * The width of each cell a document row lays out in the view the settings
 * show, at the widest row, 0 for a cell it leaves out. The name and the type
 * are the cells in their places, which the logical view fills its own way.
 */
export type ColumnWidth = {
  width: number;
  /** The alternate key marks' room after a row's last cell, 0 while none is drawn. */
  alternateKey: number;
  name: number;
  /** The logical name's own cell, which the view of both names alone lays out. */
  logicalName: number;
  comment: number;
  dataType: number;
  /** The domain's own cell, laid out while its show bit is set. */
  domain: number;
  default: number;
  notNull: number;
  autoIncrement: number;
  unique: number;
};

/** Every width at zero, for a measurement to raise. */
function createColumnWidth(): ColumnWidth {
  return {
    width: 0,
    alternateKey: 0,
    name: 0,
    logicalName: 0,
    comment: 0,
    dataType: 0,
    domain: 0,
    default: 0,
    notNull: 0,
    autoIncrement: 0,
    unique: 0,
  };
}

function calcMaxWidthColumn(
  columns: Column[],
  state: RootState,
  alternateKey: number
): ColumnWidth {
  const { settings } = state;
  const { show, maxWidthComment } = settings;
  const logical = isLogicalNameView(settings);
  const both = isBothNameView(settings);
  const columnWidth = createColumnWidth();
  columnWidth.alternateKey = alternateKey;

  for (const column of columns) {
    // The logical view draws the name in a row whose logical name is blank.
    const widthName =
      logical && !drawsNameForLogicalName(settings, column)
        ? column.ui.widthLogicalName
        : column.ui.widthName;
    if (columnWidth.name < widthName) {
      columnWidth.name = widthName;
    }

    if (both && columnWidth.logicalName < column.ui.widthLogicalName) {
      columnWidth.logicalName = column.ui.widthLogicalName;
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

    if (bHas(show, Show.columnDataType)) {
      const widthDataType = drawsDomainInTypeCell(state, column)
        ? column.ui.widthDomain
        : column.ui.widthDataType;
      if (columnWidth.dataType < widthDataType) {
        columnWidth.dataType = widthDataType;
      }
    }

    if (
      bHas(show, Show.columnDomain) &&
      columnWidth.domain < column.ui.widthDomain
    ) {
      columnWidth.domain = column.ui.widthDomain;
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
 * The width a view draws a table at: the header names, or the key badge with
 * the widest of each cell its name view lays out among the rows given, whichever is wider.
 * The rows are the caller's to name, and no view reads the show bits or the column order.
 */
export function calcViewTableWidths(
  table: Table,
  state: RootState,
  columnIds: string[]
): ColumnWidth {
  const { settings } = state;
  const logical = isLogicalNameView(settings);
  const both = isBothNameView(settings);
  const columnWidth = createColumnWidth();
  const columns = query(state.collections)
    .collection('tableColumnEntities')
    .selectByIds(columnIds);

  // The type is counted whether or not it is drawn, so lighting a table
  // never changes its width. The logical view draws the name in a row whose
  // logical name is blank, and the domain in the type cell of one linking it.
  for (const column of columns) {
    columnWidth.name = Math.max(
      columnWidth.name,
      logical && !drawsNameForLogicalName(settings, column)
        ? column.ui.widthLogicalName
        : column.ui.widthName
    );
    columnWidth.dataType = Math.max(
      columnWidth.dataType,
      drawsDomainInTypeCell(state, column, 'flow')
        ? column.ui.widthDomain
        : column.ui.widthDataType
    );

    if (both) {
      columnWidth.logicalName = Math.max(
        columnWidth.logicalName,
        column.ui.widthLogicalName
      );
      columnWidth.domain = Math.max(columnWidth.domain, column.ui.widthDomain);
    }
  }

  const cells = both
    ? [
        columnWidth.logicalName,
        columnWidth.name,
        columnWidth.domain,
        columnWidth.dataType,
      ]
    : [columnWidth.name, columnWidth.dataType];
  const rowWidth = columns.length
    ? cells.reduce(
        (acc, width) => acc + INPUT_MARGIN_RIGHT + width,
        VIEW_COLUMN_ICON_SIZE + VIEW_COLUMN_ICON_GAP - INPUT_MARGIN_RIGHT
      )
    : 0;
  const chrome = (TABLE_BORDER + TABLE_PADDING) * 2;
  const content = Math.max(
    viewHeaderWidth(table, state),
    rowWidth,
    VIEW_TABLE_MIN_WIDTH - chrome
  );

  // Whatever the widest of the three leaves over goes to the name, so the type
  // stands against the right edge on a card the header or the minimum widened.
  if (columns.length) columnWidth.name += content - rowWidth;
  columnWidth.width = chrome + content;

  return columnWidth;
}

/**
 * The width a view header's name takes. Every ui width was measured at the size
 * and weight the rows are drawn in, and a header is drawn larger and heavier,
 * so the measured width is scaled by both rather than measured a second time.
 */
export function viewHeaderNameWidth(widthName: number): number {
  return Math.ceil(
    widthName * VIEW_TABLE_HEADER_FONT_SCALE * VIEW_TABLE_HEADER_WEIGHT_SCALE
  );
}

/**
 * The names the name view sets in a view header, each at that size and with
 * its margin, past the table icon and its gap, and the room the two buttons
 * take past them on a hovered card, so a name ends before them rather than under them.
 */
function viewHeaderWidth(table: Table, state: RootState): number {
  const names = getTableFocusTypes(sceneNameSettings(state.settings, 'flow'));

  return (
    names.reduce(
      (acc, focusType) =>
        acc +
        viewHeaderNameWidth(headerCellWidth(state, table, focusType)) +
        INPUT_MARGIN_RIGHT,
      VIEW_TABLE_HEADER_NAME_X
    ) + VIEW_TABLE_HEADER_BUTTONS_WIDTH
  );
}

/** The header band a source draws above its rows, each at its own line height. */
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
  // A card ends at its last row. The gap its header keeps over the first row
  // is the only padding it draws under the title, so a card with no row wears
  // that gap as its own and stands the title on the middle of the box.
  return (
    TABLE_BORDER +
    TABLE_PADDING +
    tableHeaderHeight(source) +
    rowCount * tableRowHeight(source) +
    TABLE_BORDER
  );
}

/** A table's header text widths as toWidth measures them. */
const tableTextWidths = (table: Table, toWidth: EngineContext['toWidth']) => ({
  widthName: textInRange(toWidth(table.name)),
  widthLogicalName: textInRange(toWidth(table.logicalName)),
  widthComment: textInRange(toWidth(table.comment)),
});

/**
 * A column's text widths as toWidth measures them, its domain cell by the name
 * of the domain it links, which the state holds, or by none.
 */
const columnTextWidths = (
  state: RootState,
  column: Column,
  toWidth: EngineContext['toWidth']
) => ({
  widthName: textInRange(toWidth(column.name)),
  widthLogicalName: textInRange(toWidth(column.logicalName)),
  widthDataType: textInRange(toWidth(column.dataType)),
  widthDomain: textInRange(toWidth(getLiveDomainName(state, column.domainId))),
  widthDefault: textInRange(toWidth(column.default)),
  widthComment: textInRange(toWidth(column.comment)),
});

export function recalculateTableWidth(
  state: RootState,
  { toWidth }: EngineContext
) {
  const {
    doc: { tableIds },
    collections,
  } = state;
  // Rewrites every ui.width* without dispatching an action, so a size cache
  // has no other way to learn it went stale.
  invalidateTableWidths();

  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds);
  const columnCollection = query(collections).collection('tableColumnEntities');

  for (const table of tables) {
    Object.assign(table.ui, tableTextWidths(table, toWidth));

    const columns = columnCollection.selectByIds(table.columnIds);

    for (const column of columns) {
      Object.assign(column.ui, columnTextWidths(state, column, toWidth));
    }
  }
}

/**
 * The box a table takes on the ERD canvas once toWidth has measured its text,
 * the size recalculateTableWidth would leave it at. It works on copies, so it
 * writes no width into the state and bumps no width generation.
 */
export function measureTableSize(
  table: Table,
  state: RootState,
  toWidth: EngineContext['toWidth']
): { width: number; height: number } {
  const columns = query(state.collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds)
    .map(column => ({
      ...column,
      ui: { ...column.ui, ...columnTextWidths(state, column, toWidth) },
    }));
  const measured = {
    ...table,
    ui: { ...table.ui, ...tableTextWidths(table, toWidth) },
  };
  const scratch: RootState = {
    ...state,
    collections: {
      ...state.collections,
      tableColumnEntities: Object.fromEntries(
        columns.map(column => [column.id, column])
      ),
    },
  };

  return {
    width: calcTableWidths(measured, scratch).width,
    height: calcTableHeight(measured),
  };
}
