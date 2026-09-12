import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  FOCUS_BORDER_HEIGHT,
  getSceneFontMetrics,
  TABLE_INSET,
} from '@/components/erd/canvas/sceneTokens';
import {
  CELL_UNDERLINE_Y,
  COLUMN_CELLS_X,
  type ColumnCellWidths,
  getCellTextBaseline,
  getCellTextHeight,
  getColumnCellSlots,
  getColumnTextY,
  getColumnUnderlineY,
  getHeaderCellSlots,
  getHeaderCellsY,
  getWidthComment,
} from '@/components/erd/canvas/table/cellLayout';
import {
  COLUMN_HEIGHT,
  COLUMN_NOT_NULL_WIDTH,
  COLUMN_PADDING,
  COLUMN_UNIQUE_WIDTH,
  HEADER_ICON_HEIGHT,
  INPUT_HEIGHT,
  INPUT_MARGIN_RIGHT,
  TABLE_HEADER_ICON_MARGIN_BOTTOM,
  VIEW_COLUMN_HEIGHT,
  VIEW_COLUMN_PADDING,
} from '@/constants/layout';
import { ColumnType, Show } from '@/constants/schema';
import { createEditor, FocusType } from '@/engine/modules/editor/state';
import type { RootState } from '@/engine/state';
import { createTable } from '@/utils/collection/table.entity';

const WIDTHS: ColumnCellWidths = {
  name: 60,
  comment: 70,
  dataType: 80,
  default: 90,
};

function createState(show = 0): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  state.settings.show = show;
  return state;
}

const table = () => createTable({ id: 't1' });

describe('the comment width a table draws at', () => {
  it('takes the table width while no maximum is set', () => {
    const state = createState();
    state.settings.maxWidthComment = -1;
    const entity = table();
    entity.ui.widthComment = 120;

    expect(getWidthComment(state, entity)).toBe(120);
  });

  it('takes the table width while the maximum is wider than it', () => {
    const state = createState();
    state.settings.maxWidthComment = 200;
    const entity = table();
    entity.ui.widthComment = 120;

    expect(getWidthComment(state, entity)).toBe(120);
  });

  it('clamps to the maximum once the table is wider', () => {
    const state = createState();
    state.settings.maxWidthComment = 80;
    const entity = table();
    entity.ui.widthComment = 120;

    expect(getWidthComment(state, entity)).toBe(80);
  });
});

describe('the boxes a table header lays out', () => {
  it('carries the name alone while the comment is hidden', () => {
    const state = createState();
    const entity = table();
    entity.ui.widthName = 60;

    expect(getHeaderCellSlots(state, entity)).toEqual([
      { focusType: FocusType.tableName, x: 0, width: 60 },
    ]);
  });

  it('puts the comment past the name and its margin', () => {
    const state = createState(Show.tableComment);
    state.settings.maxWidthComment = -1;
    const entity = table();
    entity.ui.widthName = 60;
    entity.ui.widthComment = 70;

    expect(getHeaderCellSlots(state, entity)[1]).toEqual({
      focusType: FocusType.tableComment,
      x: 60 + INPUT_MARGIN_RIGHT,
      width: 70,
    });
  });
});

describe('the boxes a column row lays out', () => {
  it('starts past the key badge and steps by each width and its margin', () => {
    const state = createState(Show.columnDataType);
    state.settings.columnOrder = [
      ColumnType.columnName,
      ColumnType.columnDataType,
    ];

    expect(getColumnCellSlots(state, WIDTHS)).toEqual([
      {
        columnType: ColumnType.columnName,
        focusType: FocusType.columnName,
        x: COLUMN_CELLS_X,
        width: 60,
      },
      {
        columnType: ColumnType.columnDataType,
        focusType: FocusType.columnDataType,
        x: COLUMN_CELLS_X + 60 + INPUT_MARGIN_RIGHT,
        width: 80,
      },
    ]);
  });

  it('leaves out a cell its show bit is off for, and closes the gap', () => {
    const state = createState(Show.columnUnique);
    state.settings.columnOrder = [
      ColumnType.columnName,
      ColumnType.columnDefault,
      ColumnType.columnComment,
      ColumnType.columnNotNull,
      ColumnType.columnUnique,
      ColumnType.columnAutoIncrement,
    ];

    expect(getColumnCellSlots(state, WIDTHS)).toEqual([
      {
        columnType: ColumnType.columnName,
        focusType: FocusType.columnName,
        x: COLUMN_CELLS_X,
        width: 60,
      },
      {
        columnType: ColumnType.columnUnique,
        focusType: FocusType.columnUnique,
        x: COLUMN_CELLS_X + 60 + INPUT_MARGIN_RIGHT,
        width: COLUMN_UNIQUE_WIDTH,
      },
    ]);
  });

  it('gives the toggles the fixed widths they are drawn at', () => {
    const state = createState(Show.columnNotNull | Show.columnAutoIncrement);
    state.settings.columnOrder = [
      ColumnType.columnNotNull,
      ColumnType.columnAutoIncrement,
    ];

    expect(getColumnCellSlots(state, WIDTHS).map(slot => slot.width)).toEqual([
      COLUMN_NOT_NULL_WIDTH,
      15,
    ]);
  });

  it('skips a column type the layout knows nothing about', () => {
    const state = createState();
    state.settings.columnOrder = [9999, ColumnType.columnName];

    expect(getColumnCellSlots(state, WIDTHS)).toEqual([
      {
        columnType: ColumnType.columnName,
        focusType: FocusType.columnName,
        x: COLUMN_CELLS_X,
        width: 60,
      },
    ]);
  });
});

/** AC-4. A view row is the name and the type, and the document's settings cannot change that. */
describe('the boxes a view lays out', () => {
  const VIEW_ROW = [
    {
      columnType: ColumnType.columnName,
      focusType: FocusType.columnName,
      x: COLUMN_CELLS_X,
      width: 60,
    },
    {
      columnType: ColumnType.columnDataType,
      focusType: FocusType.columnDataType,
      x: COLUMN_CELLS_X + 60 + INPUT_MARGIN_RIGHT,
      width: 80,
    },
  ];

  it('is the name and the type of a row, in that order', () => {
    const state = createState(0);
    state.settings.columnOrder = [];

    expect(getColumnCellSlots(state, WIDTHS, 'flow')).toEqual(VIEW_ROW);
  });

  it('keeps that row whatever show bit is set and however the columns are ordered', () => {
    const shows = [
      ...Object.values(Show),
      Object.values(Show).reduce((acc, bit) => acc | bit, 0),
    ];
    const orders = [
      [ColumnType.columnDataType, ColumnType.columnName],
      [
        ColumnType.columnNotNull,
        ColumnType.columnUnique,
        ColumnType.columnAutoIncrement,
        ColumnType.columnDefault,
        ColumnType.columnComment,
      ],
      [],
    ];

    for (const show of shows) {
      for (const columnOrder of orders) {
        const state = createState(show);
        state.settings.columnOrder = columnOrder;

        expect(getColumnCellSlots(state, WIDTHS, 'flow')).toEqual(VIEW_ROW);
        expect(getColumnCellSlots(state, WIDTHS, 'document')).toEqual(
          getColumnCellSlots(state, WIDTHS)
        );
      }
    }
  });

  it('carries the header name alone even while the comment is shown', () => {
    const state = createState(Show.tableComment);
    state.settings.maxWidthComment = -1;
    const entity = table();
    entity.ui.widthName = 60;
    entity.ui.widthComment = 70;

    expect(getHeaderCellSlots(state, entity, 'flow')).toEqual([
      { focusType: FocusType.tableName, x: 0, width: 60 },
    ]);
    expect(getHeaderCellSlots(state, entity, 'document')).toHaveLength(2);
  });
});

/** AC-13, AC-14, AC-15. Every offset a cell is laid out at answers for the source it is asked about. */
describe('the offsets a source lays its cells out at', () => {
  it('hangs the header cells under the icon band only in the document', () => {
    expect(getHeaderCellsY()).toBe(getHeaderCellsY('document'));
    expect(getHeaderCellsY('document')).toBe(
      TABLE_INSET + HEADER_ICON_HEIGHT + TABLE_HEADER_ICON_MARGIN_BOTTOM
    );
    expect(getHeaderCellsY('flow')).toBe(TABLE_INSET);
    expect(getHeaderCellsY('flow')).toBeLessThan(getHeaderCellsY('document'));
  });

  it('takes the row padding from the source that lays the row out', () => {
    expect(getColumnTextY()).toBe(COLUMN_PADDING);
    expect(getColumnTextY('flow')).toBe(VIEW_COLUMN_PADDING);
  });

  it('runs the row underline along the foot of that row own line box', () => {
    expect(getColumnUnderlineY()).toBe(CELL_UNDERLINE_Y);
    expect(getColumnUnderlineY('document')).toBe(
      COLUMN_HEIGHT - COLUMN_PADDING * 2 - FOCUS_BORDER_HEIGHT
    );
    expect(getColumnUnderlineY('flow')).toBe(
      VIEW_COLUMN_HEIGHT - VIEW_COLUMN_PADDING * 2 - FOCUS_BORDER_HEIGHT
    );
    expect(getColumnUnderlineY('flow')).toBeLessThan(getColumnUnderlineY());
  });

  it('leaves the underline and its border inside the row either way', () => {
    for (const source of ['document', 'flow'] as const) {
      const row = source === 'document' ? COLUMN_HEIGHT : VIEW_COLUMN_HEIGHT;

      expect(
        getColumnTextY(source) +
          getColumnUnderlineY(source) +
          FOCUS_BORDER_HEIGHT
      ).toBeLessThanOrEqual(row);
    }
  });
});

describe('the box a cell lays one line of text out in', () => {
  it('runs its underline along the bottom of the input slot', () => {
    expect(CELL_UNDERLINE_Y).toBe(INPUT_HEIGHT - FOCUS_BORDER_HEIGHT);
    expect(CELL_UNDERLINE_Y + FOCUS_BORDER_HEIGHT).toBe(INPUT_HEIGHT);
  });

  it('is the box whose centred line lands on a whole pixel', () => {
    // The face's own overhang is the only thing that moves this, so the box is
    // derived from it rather than written down, and both are held against a
    // real face in EditOverlay.browser.test.tsx.
    const { ascent, descent } = getSceneFontMetrics();
    const overhang = (ascent - descent) / 2;

    expect(Number.isInteger(getCellTextBaseline())).toBe(true);
    expect(getCellTextHeight() / 2 + overhang).toBe(getCellTextBaseline());
  });

  it('keeps that box inside the slot and its line above the underline', () => {
    expect(getCellTextHeight()).toBeGreaterThan(0);
    expect(getCellTextHeight()).toBeLessThanOrEqual(INPUT_HEIGHT);
    expect(getCellTextBaseline()).toBeLessThan(CELL_UNDERLINE_Y);
  });
});
