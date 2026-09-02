import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { FOCUS_BORDER_HEIGHT } from '@/components/erd/canvas/sceneTokens';
import {
  CELL_TEXT_HEIGHT,
  CELL_UNDERLINE_Y,
  COLUMN_CELLS_X,
  type ColumnCellWidths,
  getColumnCellSlots,
  getHeaderCellSlots,
  getWidthComment,
} from '@/components/erd/canvas/table/cellLayout';
import {
  COLUMN_NOT_NULL_WIDTH,
  COLUMN_UNIQUE_WIDTH,
  INPUT_HEIGHT,
  INPUT_MARGIN_RIGHT,
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

describe('the box a cell lays one line of text out in', () => {
  it('is the input line the scene hands konva, so both centre in one box', () => {
    expect(CELL_TEXT_HEIGHT).toBe(INPUT_HEIGHT);
  });

  it('runs its underline along the bottom of that box', () => {
    expect(CELL_UNDERLINE_Y).toBe(CELL_TEXT_HEIGHT - FOCUS_BORDER_HEIGHT);
    expect(CELL_UNDERLINE_Y + FOCUS_BORDER_HEIGHT).toBe(CELL_TEXT_HEIGHT);
  });
});
