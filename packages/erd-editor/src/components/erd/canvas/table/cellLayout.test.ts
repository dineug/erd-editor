import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  FOCUS_BORDER_HEIGHT,
  getSceneFontMetrics,
  SCENE_CODE_FONT_FAMILY,
  TABLE_INSET,
} from '@/components/erd/canvas/sceneTokens';
import {
  CELL_UNDERLINE_Y,
  type ColumnCellWidths,
  getAlternateKeyMarkHeight,
  getAlternateKeyMarkX,
  getCellTextBaseline,
  getCellTextHeight,
  getColumnCellSlots,
  getColumnCellsX,
  getColumnTextHeight,
  getColumnTextY,
  getColumnUnderlineY,
  getHeaderCellSlots,
  getHeaderCellsY,
  getHeaderTextHeight,
  getHeaderTextY,
  getWidthComment,
} from '@/components/erd/canvas/table/cellLayout';
import {
  COLUMN_HEIGHT,
  COLUMN_KEY_WIDTH,
  COLUMN_NOT_NULL_WIDTH,
  COLUMN_PADDING,
  COLUMN_UNIQUE_WIDTH,
  INPUT_HEIGHT,
  INPUT_MARGIN_RIGHT,
  TABLE_BORDER,
  TABLE_HEADER_BAND_PADDING,
  TABLE_HEADER_ICON_GAP,
  TABLE_HEADER_ICON_SIZE,
  TABLE_HEADER_PADDING,
  VIEW_COLUMN_ICON_GAP,
  VIEW_COLUMN_ICON_SIZE,
  VIEW_COLUMN_PADDING,
  VIEW_TABLE_HEADER_ICON_GAP,
  VIEW_TABLE_HEADER_ICON_SIZE,
} from '@/constants/layout';
import { ColumnType, NameViewMode, Show } from '@/constants/schema';
import { createEditor, FocusType } from '@/engine/modules/editor/state';
import {
  getColumnFocusTypes,
  getTableFocusTypes,
  getViewColumnFocusTypes,
} from '@/engine/modules/editor/utils/nameView';
import type { RootState } from '@/engine/state';
import { viewHeaderNameWidth } from '@/utils/calcTable';
import { createTable } from '@/utils/collection/table.entity';

const WIDTHS: ColumnCellWidths = {
  name: 60,
  comment: 70,
  dataType: 80,
  default: 90,
  logicalName: 100,
  domain: 110,
};

function createState(
  show = 0,
  nameViewMode: RootState['settings']['nameViewMode'] = NameViewMode.physical
): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  state.settings.show = show;
  state.settings.nameViewMode = nameViewMode;
  return state;
}

const ALL_SHOW = Object.values(Show).reduce((acc, bit) => acc | bit, 0);

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
  it('carries the name alone, past the table icon, while the comment is hidden', () => {
    const state = createState();
    const entity = table();
    entity.ui.widthName = 60;

    expect(getHeaderCellSlots(state, entity)).toEqual([
      {
        focusType: FocusType.tableName,
        x: TABLE_HEADER_ICON_SIZE + TABLE_HEADER_ICON_GAP,
        width: 60,
      },
    ]);
  });

  it('lines the header name up with the column names under it', () => {
    const state = createState();
    const [name] = getHeaderCellSlots(state, table());

    expect(TABLE_INSET + name.x).toBe(getColumnCellsX());
  });

  it('puts the comment past the name and its margin', () => {
    const state = createState(Show.tableComment);
    state.settings.maxWidthComment = -1;
    const entity = table();
    entity.ui.widthName = 60;
    entity.ui.widthComment = 70;

    expect(getHeaderCellSlots(state, entity)[1]).toEqual({
      focusType: FocusType.tableComment,
      x:
        TABLE_HEADER_ICON_SIZE +
        TABLE_HEADER_ICON_GAP +
        60 +
        INPUT_MARGIN_RIGHT,
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
        x: getColumnCellsX(),
        width: 60,
      },
      {
        columnType: ColumnType.columnDataType,
        focusType: FocusType.columnDataType,
        x: getColumnCellsX() + 60 + INPUT_MARGIN_RIGHT,
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
        x: getColumnCellsX(),
        width: 60,
      },
      {
        columnType: ColumnType.columnUnique,
        focusType: FocusType.columnUnique,
        x: getColumnCellsX() + 60 + INPUT_MARGIN_RIGHT,
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
        x: getColumnCellsX(),
        width: 60,
      },
    ]);
  });
});

describe('where a row puts its alternate key mark', () => {
  const ends = (state: RootState) =>
    getColumnCellSlots(state, WIDTHS).map(slot => slot.x + slot.width);

  it('stands one margin past the last cell, the cells where they were', () => {
    const state = createState(Show.columnDataType);
    state.settings.columnOrder = [
      ColumnType.columnName,
      ColumnType.columnDataType,
    ];
    const slots = getColumnCellSlots(state, WIDTHS);

    expect(slots[0].x).toBe(getColumnCellsX());
    expect(getAlternateKeyMarkX(slots)).toBe(
      getColumnCellsX() + 60 + INPUT_MARGIN_RIGHT + 80 + INPUT_MARGIN_RIGHT
    );
  });

  it('stays last whatever order the settings put the cells in', () => {
    const state = createState(
      Show.columnComment | Show.columnDataType | Show.columnNotNull
    );
    state.settings.columnOrder = [
      ColumnType.columnComment,
      ColumnType.columnNotNull,
      ColumnType.columnName,
      ColumnType.columnDataType,
    ];
    const slots = getColumnCellSlots(state, WIDTHS);
    const x = getAlternateKeyMarkX(slots);

    expect(slots.map(slot => slot.columnType)).toEqual(
      state.settings.columnOrder
    );
    expect(x).toBe(Math.max(...ends(state)) + INPUT_MARGIN_RIGHT);
    expect(slots.every(slot => slot.x < x)).toBe(true);
  });

  it('takes the place of the first cell while the row lays out none', () => {
    expect(getAlternateKeyMarkX([])).toBe(getColumnCellsX());
  });

  it('centres its code face line on the baseline the text face cells stand on', () => {
    const { ascent, descent } = getSceneFontMetrics(SCENE_CODE_FONT_FAMILY);

    expect(getAlternateKeyMarkHeight() / 2 + (ascent - descent) / 2).toBe(
      getCellTextBaseline()
    );
  });
});

/** AC-4. A view row is the cells its name view names, and no show bit or column order changes that. */
describe('the boxes a view lays out', () => {
  const VIEW_ROW = [
    {
      columnType: ColumnType.columnName,
      focusType: FocusType.columnName,
      x: getColumnCellsX('flow'),
      width: 60,
    },
    {
      columnType: ColumnType.columnDataType,
      focusType: FocusType.columnDataType,
      x: getColumnCellsX('flow') + 60 + INPUT_MARGIN_RIGHT,
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

    // The document row under every bit takes the domain cell at its own width.
    const state = createState(ALL_SHOW);
    expect(getColumnCellSlots(state, WIDTHS)).toContainEqual(
      expect.objectContaining({
        columnType: ColumnType.columnDomain,
        focusType: FocusType.columnDomain,
        width: WIDTHS.domain,
      })
    );
  });

  it('keeps the physical row and header name in the physical view under every bit', () => {
    const state = createState(ALL_SHOW, NameViewMode.physical);

    expect(getColumnCellSlots(state, WIDTHS, 'flow')).toEqual(VIEW_ROW);
    expect(getHeaderCellSlots(state, table(), 'flow')).toEqual([
      expect.objectContaining({ focusType: FocusType.tableName }),
    ]);
  });

  it('puts the logical name and the domain in the name and type cells of the logical view, whatever the Domain bit says', () => {
    for (const show of [0, Show.columnDomain, ALL_SHOW]) {
      const state = createState(show, NameViewMode.logical);

      expect(getColumnCellSlots(state, WIDTHS, 'flow')).toEqual([
        { ...VIEW_ROW[0], focusType: FocusType.columnLogicalName },
        { ...VIEW_ROW[1], focusType: FocusType.columnDomain },
      ]);
    }
  });

  it('lays the logical name, the name, the domain and the type out in the view of both', () => {
    const state = createState(0, NameViewMode.both);
    const x = getColumnCellsX('flow');

    expect(getColumnCellSlots(state, WIDTHS, 'flow')).toEqual([
      {
        columnType: ColumnType.columnLogicalName,
        focusType: FocusType.columnLogicalName,
        x,
        width: 100,
      },
      {
        columnType: ColumnType.columnName,
        focusType: FocusType.columnName,
        x: x + 100 + INPUT_MARGIN_RIGHT,
        width: 60,
      },
      {
        columnType: ColumnType.columnDomain,
        focusType: FocusType.columnDomain,
        x: x + 100 + INPUT_MARGIN_RIGHT + 60 + INPUT_MARGIN_RIGHT,
        width: 110,
      },
      {
        columnType: ColumnType.columnDataType,
        focusType: FocusType.columnDataType,
        x:
          x +
          100 +
          INPUT_MARGIN_RIGHT +
          60 +
          INPUT_MARGIN_RIGHT +
          110 +
          INPUT_MARGIN_RIGHT,
        width: 80,
      },
    ]);
  });

  it('sets the header names the name view names, each at the size a view header draws it', () => {
    const entity = table();
    entity.logicalName = 'Member';
    entity.ui.widthName = 60;
    entity.ui.widthLogicalName = 90;
    const x = VIEW_TABLE_HEADER_ICON_SIZE + VIEW_TABLE_HEADER_ICON_GAP;

    expect(
      getHeaderCellSlots(
        createState(ALL_SHOW, NameViewMode.logical),
        entity,
        'flow'
      )
    ).toEqual([
      {
        focusType: FocusType.tableLogicalName,
        x,
        width: viewHeaderNameWidth(90),
      },
    ]);
    expect(
      getHeaderCellSlots(
        createState(ALL_SHOW, NameViewMode.both),
        entity,
        'flow'
      )
    ).toEqual([
      {
        focusType: FocusType.tableLogicalName,
        x,
        width: viewHeaderNameWidth(90),
      },
      {
        focusType: FocusType.tableName,
        x: x + viewHeaderNameWidth(90) + INPUT_MARGIN_RIGHT,
        width: viewHeaderNameWidth(60),
      },
    ]);

    // A blank logical name draws the name in its place, at the name's width.
    entity.logicalName = ' ';
    expect(
      getHeaderCellSlots(createState(0, NameViewMode.logical), entity, 'flow')
    ).toEqual([
      {
        focusType: FocusType.tableLogicalName,
        x,
        width: viewHeaderNameWidth(60),
      },
    ]);
  });

  it('lays out the cells a peer focus is matched against in every name view', () => {
    for (const nameViewMode of Object.values(NameViewMode)) {
      const state = createState(ALL_SHOW, nameViewMode);

      expect(
        getColumnCellSlots(state, WIDTHS, 'flow').map(slot => slot.focusType)
      ).toEqual(getViewColumnFocusTypes(state.settings));
    }
  });

  it('carries the header name alone even while the comment is shown', () => {
    const state = createState(Show.tableComment);
    state.settings.maxWidthComment = -1;
    const entity = table();
    entity.ui.widthName = 60;
    entity.ui.widthComment = 70;

    expect(getHeaderCellSlots(state, entity, 'flow')).toEqual([
      {
        focusType: FocusType.tableName,
        x: VIEW_TABLE_HEADER_ICON_SIZE + VIEW_TABLE_HEADER_ICON_GAP,
        width: viewHeaderNameWidth(60),
      },
    ]);
    expect(getHeaderCellSlots(state, entity, 'document')).toHaveLength(2);
  });

  /**
   * A view draws the name larger and heavier than every ui width was measured
   * at, so the box it reserves has to be larger too or the name it was
   * measured to hold would come out clipped.
   */
  it('reserves the wider box a view header draws that name in', () => {
    const state = createState();
    const entity = table();
    entity.ui.widthName = 60;

    const [view] = getHeaderCellSlots(state, entity, 'flow');
    const [document] = getHeaderCellSlots(state, entity, 'document');

    expect(view.width).toBe(73);
    expect(view.width).toBeGreaterThan(document.width);
    expect(view.x).toBe(20);
    expect(document.x).toBe(20);
  });
});

/** AC-13, AC-14, AC-15. Every offset a cell is laid out at answers for the source it is asked about. */
describe('the offsets a source lays its cells out at', () => {
  it('runs the document header band from the top border, and a view header inside the padding', () => {
    expect(getHeaderCellsY()).toBe(getHeaderCellsY('document'));
    expect(getHeaderCellsY('document')).toBe(
      TABLE_BORDER + TABLE_HEADER_BAND_PADDING
    );
    expect(getHeaderCellsY('flow')).toBe(TABLE_INSET);
  });

  it('takes the row padding from the source that lays the row out', () => {
    expect(getColumnTextY()).toBe(COLUMN_PADDING);
    expect(getColumnTextY('flow')).toBe(VIEW_COLUMN_PADDING);
    expect(getColumnTextY('flow')).toBeGreaterThan(getColumnTextY());
  });

  it('starts the cells past the badge its own source sizes', () => {
    expect(getColumnCellsX()).toBe(getColumnCellsX('document'));
    expect(getColumnCellsX()).toBe(
      TABLE_INSET + COLUMN_KEY_WIDTH + INPUT_MARGIN_RIGHT
    );
    expect(getColumnCellsX('flow')).toBe(
      TABLE_INSET + VIEW_COLUMN_ICON_SIZE + VIEW_COLUMN_ICON_GAP
    );
    expect(getColumnCellsX('flow')).toBeGreaterThan(getColumnCellsX());
  });

  /**
   * Both boxes are the band their source's own icon stands in, which is what
   * puts a line of text on that icon's middle. The document keeps the box its
   * editor opens an input in, so its two baselines still meet.
   */
  it('centres a line in the band its source draws icons in', () => {
    expect(getHeaderTextY()).toBe(TABLE_HEADER_PADDING);
    expect(getHeaderTextY('flow')).toBe(0);
    expect(getHeaderTextHeight()).toBe(getCellTextHeight());
    expect(getHeaderTextHeight('flow')).toBe(VIEW_TABLE_HEADER_ICON_SIZE);
    expect(getColumnTextHeight()).toBe(getCellTextHeight());
    expect(getColumnTextHeight('flow')).toBe(VIEW_COLUMN_ICON_SIZE);
  });

  it('runs the row underline along the foot of the document row own line box', () => {
    expect(getColumnUnderlineY()).toBe(CELL_UNDERLINE_Y);
    expect(getColumnUnderlineY()).toBe(
      COLUMN_HEIGHT - COLUMN_PADDING * 2 - FOCUS_BORDER_HEIGHT
    );
  });

  it('leaves the underline and its border inside the document row', () => {
    expect(
      getColumnTextY('document') + getColumnUnderlineY() + FOCUS_BORDER_HEIGHT
    ).toBeLessThanOrEqual(COLUMN_HEIGHT);
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

/** The header and the rows each name view lays out, and the focus each cell takes. */
describe('the boxes a name view lays out', () => {
  const named = () => {
    const entity = table();
    entity.logicalName = 'Member';
    entity.ui.widthName = 60;
    entity.ui.widthLogicalName = 90;
    entity.ui.widthComment = 70;
    return entity;
  };

  it('puts the logical name in the place of the header name in the logical view', () => {
    const state = createState(Show.tableComment, NameViewMode.logical);
    state.settings.maxWidthComment = -1;

    expect(getHeaderCellSlots(state, named())).toEqual([
      {
        focusType: FocusType.tableLogicalName,
        x: TABLE_HEADER_ICON_SIZE + TABLE_HEADER_ICON_GAP,
        width: 90,
      },
      {
        focusType: FocusType.tableComment,
        x:
          TABLE_HEADER_ICON_SIZE +
          TABLE_HEADER_ICON_GAP +
          90 +
          INPUT_MARGIN_RIGHT,
        width: 70,
      },
    ]);
  });

  it('keeps the width of the name a logical view draws dimmed for an empty logical name', () => {
    const state = createState(0, NameViewMode.logical);
    const entity = named();
    entity.logicalName = '';

    expect(getHeaderCellSlots(state, entity)).toEqual([
      {
        focusType: FocusType.tableLogicalName,
        x: TABLE_HEADER_ICON_SIZE + TABLE_HEADER_ICON_GAP,
        width: 60,
      },
    ]);
  });

  it('sets the logical name before the name in the view of both, the comment past the two', () => {
    const state = createState(Show.tableComment, NameViewMode.both);
    state.settings.maxWidthComment = -1;
    const x = TABLE_HEADER_ICON_SIZE + TABLE_HEADER_ICON_GAP;

    expect(getHeaderCellSlots(state, named())).toEqual([
      { focusType: FocusType.tableLogicalName, x, width: 90 },
      {
        focusType: FocusType.tableName,
        x: x + 90 + INPUT_MARGIN_RIGHT,
        width: 60,
      },
      {
        focusType: FocusType.tableComment,
        x: x + 90 + INPUT_MARGIN_RIGHT + 60 + INPUT_MARGIN_RIGHT,
        width: 70,
      },
    ]);
  });

  it('adds the logical name cell to a row of the view of both alone', () => {
    const state = createState(Show.columnDataType, NameViewMode.both);
    state.settings.columnOrder = [
      ColumnType.columnLogicalName,
      ColumnType.columnName,
      ColumnType.columnDataType,
    ];

    expect(getColumnCellSlots(state, WIDTHS)).toEqual([
      {
        columnType: ColumnType.columnLogicalName,
        focusType: FocusType.columnLogicalName,
        x: getColumnCellsX(),
        width: 100,
      },
      {
        columnType: ColumnType.columnName,
        focusType: FocusType.columnName,
        x: getColumnCellsX() + 100 + INPUT_MARGIN_RIGHT,
        width: 60,
      },
      {
        columnType: ColumnType.columnDataType,
        focusType: FocusType.columnDataType,
        x:
          getColumnCellsX() +
          100 +
          INPUT_MARGIN_RIGHT +
          60 +
          INPUT_MARGIN_RIGHT,
        width: 80,
      },
    ]);

    state.settings.nameViewMode = NameViewMode.physical;
    expect(
      getColumnCellSlots(state, WIDTHS).map(slot => slot.columnType)
    ).toEqual([ColumnType.columnName, ColumnType.columnDataType]);
  });

  it('edits the logical name and the domain in the name and type cells of the logical view', () => {
    const state = createState(Show.columnDataType, NameViewMode.logical);
    state.settings.columnOrder = [
      ColumnType.columnLogicalName,
      ColumnType.columnName,
      ColumnType.columnDataType,
      ColumnType.columnDomain,
    ];

    expect(getColumnCellSlots(state, WIDTHS)).toEqual([
      {
        columnType: ColumnType.columnName,
        focusType: FocusType.columnLogicalName,
        x: getColumnCellsX(),
        width: 60,
      },
      {
        columnType: ColumnType.columnDataType,
        focusType: FocusType.columnDomain,
        x: getColumnCellsX() + 60 + INPUT_MARGIN_RIGHT,
        width: 80,
      },
    ]);
  });

  it('gives the domain a cell of its own under its show bit, the type cell then the type', () => {
    for (const nameViewMode of Object.values(NameViewMode)) {
      const state = createState(
        Show.columnDataType | Show.columnDomain,
        nameViewMode
      );
      state.settings.columnOrder = [
        ColumnType.columnDataType,
        ColumnType.columnDomain,
      ];

      expect(getColumnCellSlots(state, WIDTHS)).toEqual([
        {
          columnType: ColumnType.columnDataType,
          focusType: FocusType.columnDataType,
          x: getColumnCellsX(),
          width: 80,
        },
        {
          columnType: ColumnType.columnDomain,
          focusType: FocusType.columnDomain,
          x: getColumnCellsX() + 80 + INPUT_MARGIN_RIGHT,
          width: 110,
        },
      ]);
    }
  });

  it('lays out the cells the focus walks, in every view and under every show bit', () => {
    const shows = [0, Show.tableComment | Show.columnDataType, ALL_SHOW];

    for (const nameViewMode of Object.values(NameViewMode)) {
      for (const show of shows) {
        const state = createState(show, nameViewMode);

        expect(
          getColumnCellSlots(state, WIDTHS).map(slot => slot.focusType)
        ).toEqual(getColumnFocusTypes(state.settings));
        expect(
          getHeaderCellSlots(state, named()).map(slot => slot.focusType)
        ).toEqual(getTableFocusTypes(state.settings));
      }
    }
  });
});
