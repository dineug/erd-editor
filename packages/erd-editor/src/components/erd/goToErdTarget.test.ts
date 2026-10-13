// The store half of a jump from a search result: the ERD tab alone first, then
// the scroll, the selection and the ring on the cell, where the scroll comes
// only for a target not on screen whole, or of one too big for it, that cell.

import type { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import {
  getColumnCellSlots,
  getHeaderCellSlots,
  HEADER_CELLS_X,
} from '@/components/erd/canvas/table/cellLayout';
import {
  EDGE_MARGIN,
  goToErdTarget,
  planJump,
  showErdTab,
  showErdTargetAction$,
  type Span,
} from '@/components/erd/goToErdTarget';
import { CanvasType, RelationshipType, Show } from '@/constants/schema';
import {
  changeViewportAction,
  drawStartRelationshipAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  changeCanvasTypeAction,
  changeMaxWidthCommentAction,
  changeShowAction,
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableCommentAction,
  changeTableGroupAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnNameAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { addTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import {
  getColumnRect,
  getTableHeaderRect,
  getTableRect,
  getTableWidths,
} from '@/konva/scene/metrics';
import { toScreenPoint } from '@/konva/scene/viewport';
import { bHas } from '@/utils/bit';
import { getTableGroupRect } from '@/utils/tableGroup';

const VIEWPORT = { width: 800, height: 600 };

const apps: AppContext[] = [];

afterEach(() => {
  apps.splice(0).forEach(app => app.store.destroy());
});

/** A near table of 60 columns, its last row far below the screen, and a far memo. */
function seed(): AppContext {
  const app = createTestAppContext();
  apps.push(app);
  app.store.dispatchSync(
    changeViewportAction(VIEWPORT),
    addTableAction({ id: 'tall', ui: { x: 60, y: 60, zIndex: 1 } }),
    ...Array.from({ length: 60 }, (_, index) =>
      addColumnAction({ id: `c${index}`, tableId: 'tall' })
    ),
    addMemoAction({ id: 'note', ui: { x: 3000, y: 2000, zIndex: 2 } })
  );

  return app;
}

/** Every batch the store reduces from here on, by the types it carries. */
function recordBatches(app: AppContext): string[][] {
  const batches: string[][] = [];
  app.store.subscribe((actions: AnyAction[]) => {
    batches.push(actions.map(({ type }) => type));
  });

  return batches;
}

/** Turns one show flag off, as the View Option menu does. */
function hide(app: AppContext, flag: number) {
  app.store.dispatchSync(changeShowAction({ show: flag, value: false }));
  expect(bHas(app.store.state.settings.show, flag)).toBe(false);
}

const column = (columnId: string, focusType: FocusType) => ({
  kind: 'column' as const,
  tableId: 'tall',
  columnId,
  focusType,
});

describe('showErdTargetAction$', () => {
  it('scrolls a column row far below the screen into the middle and rings its cell', () => {
    const app = seed();
    const batches = recordBatches(app);

    app.store.dispatchSync(
      showErdTargetAction$(column('c59', FocusType.columnComment))
    );

    expect(batches.flat()).toContain('settings.scrollTo');
    const { editor, settings } = app.store.state;
    expect(settings.originY).toBeLessThan(0);
    expect(editor.selectedMap.tall).toBe(SelectType.table);
    expect(editor.focusTable).toMatchObject({
      tableId: 'tall',
      columnId: 'c59',
      focusType: FocusType.columnComment,
      selectColumnIds: ['c59'],
    });
  });

  it('moves a row on screen whose middle is off the middle half down, and that axis alone (AC-N6)', () => {
    const app = seed();
    const batches = recordBatches(app);

    app.store.dispatchSync(
      showErdTargetAction$(column('c0', FocusType.columnName))
    );

    expect(batches.flat()).toContain('settings.scrollTo');
    const { settings, collections } = app.store.state;
    const row = getColumnRect(
      app.store.state,
      collections.tableEntities.tall,
      0
    );
    const middle = toScreenPoint(settings, {
      x: row.x,
      y: row.y + row.height / 2,
    });
    expect(settings.originX).toBe(0);
    expect(middle.y).toBeCloseTo(VIEWPORT.height / 2, 6);
    expect(app.store.state.editor.focusTable?.columnId).toBe('c0');
  });

  it('leaves the scroll out for a row whose middle is in the middle half (AC-N5)', () => {
    const app = seed();
    const batches = recordBatches(app);

    app.store.dispatchSync(
      showErdTargetAction$(column('c4', FocusType.columnName))
    );

    expect(batches.flat()).not.toContain('settings.scrollTo');
    expect(app.store.state.editor.focusTable?.columnId).toBe('c4');
  });

  it('rings the name of a column whose comments are hidden', () => {
    const app = seed();
    hide(app, Show.columnComment);

    app.store.dispatchSync(
      showErdTargetAction$(column('c1', FocusType.columnComment))
    );

    expect(app.store.state.editor.focusTable?.focusType).toBe(
      FocusType.columnName
    );
  });

  it('goes by the name in the middle of a table when a zoom this far out draws no rows', () => {
    const app = seed();
    addFarTallTable(app);
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    const batches = recordBatches(app);

    // The last row of the tall table is below the screen, but its name is not,
    // so it stays down; across, its middle is left of the middle half.
    app.store.dispatchSync(
      showErdTargetAction$(column('c59', FocusType.columnName))
    );
    expect(batches.flat()).toContain('settings.scrollTo');
    const tall = app.store.state.collections.tableEntities.tall;
    const tallRect = getTableRect(app.store.state, tall);
    const tallMiddle = toScreenPoint(app.store.state.settings, {
      x: tallRect.x + tallRect.width / 2,
      y: tallRect.y,
    });
    expect(app.store.state.settings.originY).toBe(0);
    expect(tallMiddle.x).toBeCloseTo(VIEWPORT.width / 2, 6);
    expect(app.store.state.editor.focusTable?.columnId).toBe('c59');

    app.store.dispatchSync(
      showErdTargetAction$({
        kind: 'column',
        tableId: 'far',
        columnId: 'f0',
        focusType: FocusType.columnName,
      })
    );

    const { settings, collections } = app.store.state;
    const rect = getTableRect(app.store.state, collections.tableEntities.far);
    expect(rect.height * settings.zoomLevel).toBeGreaterThan(VIEWPORT.height);
    const middle = toScreenPoint(settings, {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    });
    expect(middle.x).toBeCloseTo(VIEWPORT.width / 2, 6);
    expect(middle.y).toBeCloseTo(VIEWPORT.height / 2, 6);
    expect(app.store.state.editor.focusTable?.columnId).toBe('f0');
  });

  it('rings the table comment, or the name while comments are hidden', () => {
    const app = seed();
    const target = {
      kind: 'table' as const,
      tableId: 'tall',
      focusType: FocusType.tableComment,
    };

    app.store.dispatchSync(showErdTargetAction$(target));
    expect(app.store.state.editor.focusTable?.focusType).toBe(
      FocusType.tableComment
    );

    hide(app, Show.tableComment);
    app.store.dispatchSync(showErdTargetAction$(target));
    expect(app.store.state.editor.focusTable?.focusType).toBe(
      FocusType.tableName
    );
  });

  it('leaves the ring where selecting puts it when no focus type is asked for', () => {
    const app = seed();

    app.store.dispatchSync(
      showErdTargetAction$({ kind: 'table', tableId: 'tall' })
    );

    expect(app.store.state.editor.focusTable).toMatchObject({
      tableId: 'tall',
      focusType: FocusType.tableName,
    });
  });

  it('scrolls to a memo off screen and selects it alone', () => {
    const app = seed();
    app.store.dispatchSync(
      showErdTargetAction$({ kind: 'table', tableId: 'tall' })
    );
    const batches = recordBatches(app);

    app.store.dispatchSync(
      showErdTargetAction$({ kind: 'memo', memoId: 'note' })
    );

    expect(batches.flat()).toContain('settings.scrollTo');
    expect(app.store.state.editor.selectedMap).toEqual({
      note: SelectType.memo,
    });
  });

  it('goes to no memo while memos are hidden, so nothing selects it', () => {
    const app = seed();
    app.store.dispatchSync(
      changeShowAction({ show: Show.hideMemo, value: true })
    );
    const batches = recordBatches(app);

    app.store.dispatchSync(
      showErdTargetAction$({ kind: 'memo', memoId: 'note' })
    );

    expect(batches.flat()).toEqual([]);
    expect(app.store.state.editor.selectedMap).not.toHaveProperty('note');
  });

  it('asks for nothing for a table, column or memo the document no longer holds', () => {
    const app = seed();
    const batches = recordBatches(app);

    app.store.dispatchSync(
      showErdTargetAction$({ kind: 'memo', memoId: 'gone' }),
      showErdTargetAction$({ kind: 'table', tableId: 'gone' }),
      showErdTargetAction$(column('gone', FocusType.columnName))
    );

    expect(batches.flat()).toEqual([]);
  });
});

/** Adds a table of 80 columns far below and right of the screen, taller than it. */
function addFarTallTable(app: AppContext) {
  app.store.dispatchSync(
    addTableAction({ id: 'far', ui: { x: 3000, y: 3000, zIndex: 3 } }),
    ...Array.from({ length: 80 }, (_, index) =>
      addColumnAction({ id: `f${index}`, tableId: 'far' })
    )
  );
}

/** Where a table's header band stands on screen, both corners. */
function headerOnScreen(app: AppContext, tableId: string) {
  const { settings, collections } = app.store.state;
  const header = getTableHeaderRect(
    app.store.state,
    collections.tableEntities[tableId]
  );
  const topLeft = toScreenPoint(settings, header);
  const bottomRight = toScreenPoint(settings, {
    x: header.x + header.width,
    y: header.y + header.height,
  });

  return { topLeft, bottomRight };
}

describe('showErdTargetAction$ to a table taller than the screen', () => {
  const name = (tableId: string) => ({
    kind: 'table' as const,
    tableId,
    focusType: FocusType.tableName,
  });

  it('leaves the scroll out while the header holding the name is on screen', () => {
    const app = seed();
    const { tall } = app.store.state.collections.tableEntities;
    expect(getTableRect(app.store.state, tall).height).toBeGreaterThan(
      VIEWPORT.height
    );
    const batches = recordBatches(app);

    app.store.dispatchSync(showErdTargetAction$(name('tall')));

    expect(batches.flat()).not.toContain('settings.scrollTo');
    expect(headerOnScreen(app, 'tall').topLeft).toEqual({ x: 60, y: 60 });
    expect(app.store.state.editor.focusTable?.focusType).toBe(
      FocusType.tableName
    );
  });

  it('brings the header in a margin below the top, not the middle of the table', () => {
    const app = seed();
    addFarTallTable(app);

    app.store.dispatchSync(showErdTargetAction$(name('far')));

    const { topLeft, bottomRight } = headerOnScreen(app, 'far');
    expect(topLeft.y).toBe(40);
    // Narrower than the screen, the table still stands in its middle across.
    expect((topLeft.x + bottomRight.x) / 2).toBeCloseTo(VIEWPORT.width / 2, 6);
  });

  it('scrolls to a header partly above the screen, as to one off it', () => {
    const app = seed();
    const tall = app.store.state.collections.tableEntities.tall;
    app.store.dispatchSync(
      scrollToAction({ originX: 0, originY: -(tall.ui.y + 10) })
    );

    app.store.dispatchSync(showErdTargetAction$(name('tall')));

    expect(headerOnScreen(app, 'tall').topLeft.y).toBe(40);
  });

  /** Where the row c30 of the tall table and its name cell stand on screen. */
  function nameOfRow30(app: AppContext) {
    const { settings, collections } = app.store.state;
    const table = collections.tableEntities.tall;
    const row = getColumnRect(app.store.state, table, 30);
    const name = getColumnCellSlots(
      app.store.state,
      getTableWidths(app.store.state, table)
    ).find(slot => slot.focusType === FocusType.columnName);
    const tableLeft = toScreenPoint(
      settings,
      getTableRect(app.store.state, table)
    ).x;

    return {
      row,
      topLeft: toScreenPoint(settings, row),
      left: tableLeft + (name?.x ?? 0),
      right: tableLeft + (name?.x ?? 0) + (name?.width ?? 0),
    };
  }

  it('leaves a row wider than the screen where it is across while its ringed name shows', () => {
    const app = seed();
    app.store.dispatchSync(changeViewportAction({ width: 200, height: 600 }));

    app.store.dispatchSync(
      showErdTargetAction$(column('c30', FocusType.columnName))
    );

    const { row, topLeft, left, right } = nameOfRow30(app);
    expect(row.width).toBeGreaterThan(200);
    expect(app.store.state.settings.originX).toBe(0);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(200);
    // Shorter than the screen, the row still stands in its middle down.
    expect(topLeft.y + row.height / 2).toBeCloseTo(300, 6);
  });

  it('starts the ringed name of a row wider than the screen a margin in once it is off screen', () => {
    const app = seed();
    app.store.dispatchSync(
      changeViewportAction({ width: 200, height: 600 }),
      scrollToAction({ originX: -1000, originY: 0 })
    );

    app.store.dispatchSync(
      showErdTargetAction$(column('c30', FocusType.columnName))
    );

    const { row, topLeft, left } = nameOfRow30(app);
    expect(left).toBe(EDGE_MARGIN);
    // The key badge before the name stays on screen too.
    expect(topLeft.x).toBeGreaterThan(0);
    expect(topLeft.y + row.height / 2).toBeCloseTo(300, 6);
  });
});

/**
 * Adds a table far off screen wider than the screen, by a name and a column
 * name 60 letters long, each with a comment after it that fits beside a panel.
 */
function addWideTable(app: AppContext) {
  const name = 'customer_account_identifier_for_billing_and_shipping_records';
  const comment = 'login email of the customer';
  app.store.dispatchSync(
    addTableAction({ id: 'wide', ui: { x: 3000, y: 2000, zIndex: 3 } }),
    changeTableNameAction({ id: 'wide', value: name }),
    changeTableCommentAction({ id: 'wide', value: comment }),
    addColumnAction({ id: 'w0', tableId: 'wide' }),
    changeColumnNameAction({ id: 'w0', tableId: 'wide', value: name }),
    changeColumnCommentAction({ id: 'w0', tableId: 'wide', value: comment })
  );
}

/** Where a cell of a table, the wide one unless named, stands on screen, from its left edge to its right. */
function cellOnScreen(app: AppContext, focusType: FocusType, tableId = 'wide') {
  const { state } = app.store;
  const table = state.collections.tableEntities[tableId];
  const tableRect = getTableRect(state, table);
  const header =
    focusType === FocusType.tableName || focusType === FocusType.tableComment;
  const cell = (
    header
      ? getHeaderCellSlots(state, table)
      : getColumnCellSlots(state, getTableWidths(state, table))
  ).find(slot => slot.focusType === focusType);
  expect(cell).toBeDefined();
  const x = tableRect.x + (header ? HEADER_CELLS_X : 0) + (cell?.x ?? 0);
  const width = cell?.width ?? 0;
  const { y } = tableRect;

  return {
    left: toScreenPoint(state.settings, { x, y }).x,
    right: toScreenPoint(state.settings, { x: x + width, y }).x,
    tableWidth: tableRect.width,
  };
}

const wideTarget = (focusType: FocusType) =>
  focusType === FocusType.tableComment
    ? { kind: 'table' as const, tableId: 'wide', focusType }
    : {
        kind: 'column' as const,
        tableId: 'wide',
        columnId: 'w0',
        focusType,
      };

describe('showErdTargetAction$ to a cell of a table wider than the screen', () => {
  it.each([
    ['a column comment', FocusType.columnComment],
    ['a table comment', FocusType.tableComment],
  ])('brings %s a margin inside the canvas', (_, focus) => {
    const app = seed();
    addWideTable(app);

    app.store.dispatchSync(showErdTargetAction$(wideTarget(focus)));

    const { left, right, tableWidth } = cellOnScreen(app, focus);
    expect(tableWidth).toBeGreaterThan(VIEWPORT.width);
    expect(left).toBeGreaterThanOrEqual(40);
    expect(right).toBeLessThanOrEqual(VIEWPORT.width - 40);
    expect(app.store.state.editor.focusTable?.focusType).toBe(focus);
  });

  it.each([FocusType.columnComment, FocusType.tableComment])(
    'leaves the scroll out while the ringed cell is on screen, as %s is after a jump',
    focus => {
      const app = seed();
      addWideTable(app);
      app.store.dispatchSync(showErdTargetAction$(wideTarget(focus)));
      const batches = recordBatches(app);

      app.store.dispatchSync(showErdTargetAction$(wideTarget(focus)));

      expect(batches.flat()).not.toContain('settings.scrollTo');
    }
  );
});

/** The width createTestAppContext measures a text at, ten a letter. */
const textWidth = (text: string) => text.length * 10;

/** A name and a comment wider than any canvas left clear here, each ending in the word found. */
const LONG_NAME = 'customer_account_identifier_for_billing_and_shipping_zebra';
const LONG_COMMENT = `${'the address the courier prints on the label, '.repeat(3)}see zebra`;

/** Adds a table far off screen whose name, comment, column name and column comment are long. */
function addLongTable(app: AppContext) {
  app.store.dispatchSync(
    addTableAction({ id: 'long', ui: { x: 2600, y: 1800, zIndex: 3 } }),
    changeTableNameAction({ id: 'long', value: LONG_NAME }),
    changeTableCommentAction({ id: 'long', value: LONG_COMMENT }),
    addColumnAction({ id: 'l0', tableId: 'long' }),
    changeColumnNameAction({ id: 'l0', tableId: 'long', value: LONG_NAME }),
    changeColumnCommentAction({
      id: 'l0',
      tableId: 'long',
      value: LONG_COMMENT,
    })
  );
}

const TEXT_OF: Partial<Record<FocusType, string>> = {
  [FocusType.tableName]: LONG_NAME,
  [FocusType.tableComment]: LONG_COMMENT,
  [FocusType.columnName]: LONG_NAME,
  [FocusType.columnComment]: LONG_COMMENT,
};

/** The last word of the long text a cell of the long table holds, as a search finds it. */
function lastWord(focusType: FocusType) {
  const text = TEXT_OF[focusType] ?? '';
  return { text, start: text.length - 'zebra'.length, end: text.length };
}

const longTarget = (focusType: FocusType, range = lastWord(focusType)) =>
  focusType === FocusType.tableName || focusType === FocusType.tableComment
    ? { kind: 'table' as const, tableId: 'long', focusType, range }
    : {
        kind: 'column' as const,
        tableId: 'long',
        columnId: 'l0',
        focusType,
        range,
      };

/** Where the text a range covers stands on screen across, the cell's text drawn from its left edge. */
function rangeOnScreen(
  app: AppContext,
  focusType: FocusType,
  { text, start, end }: { text: string; start: number; end: number }
) {
  const { left } = cellOnScreen(app, focusType, 'long');
  const { zoomLevel } = app.store.state.settings;

  return {
    left: left + textWidth(text.slice(0, start)) * zoomLevel,
    right: left + textWidth(text.slice(0, end)) * zoomLevel,
  };
}

/** The canvases a panel docked beside them leaves: 800 and 600 less 412. */
const NARROW = 388;
const NARROWER = 188;

describe('showErdTargetAction$ to a match in a cell wider than the canvas', () => {
  it.each([
    ['a column comment', 800, FocusType.columnComment],
    ['a column comment on a narrow canvas', NARROW, FocusType.columnComment],
    ['a column comment on a narrower one', NARROWER, FocusType.columnComment],
    ['a table comment', 800, FocusType.tableComment],
    ['a table comment on a narrow canvas', NARROW, FocusType.tableComment],
    ['a table comment on a narrower one', NARROWER, FocusType.tableComment],
    ['a column name on a narrow canvas', NARROW, FocusType.columnName],
    ['a column name on a narrower one', NARROWER, FocusType.columnName],
    ['a table name on a narrow canvas', NARROW, FocusType.tableName],
    ['a table name on a narrower one', NARROWER, FocusType.tableName],
  ])(
    'brings the match at the end of %s a margin inside it',
    (_, width, focus) => {
      const app = seed();
      app.store.dispatchSync(changeViewportAction({ width, height: 600 }));
      addLongTable(app);

      app.store.dispatchSync(showErdTargetAction$(longTarget(focus)));

      const cell = cellOnScreen(app, focus, 'long');
      const match = rangeOnScreen(app, focus, lastWord(focus));
      expect(cell.right - cell.left).toBeGreaterThan(width - 80);
      expect(match.left).toBeGreaterThanOrEqual(40);
      expect(match.right).toBeLessThanOrEqual(width - 40);
      expect(app.store.state.editor.focusTable?.focusType).toBe(focus);
    }
  );

  it('starts a match at the start of a long comment a margin in from the left', () => {
    const app = seed();
    app.store.dispatchSync(
      changeViewportAction({ width: NARROW, height: 600 })
    );
    addLongTable(app);
    const range = { text: LONG_COMMENT, start: 0, end: 3 };

    app.store.dispatchSync(
      showErdTargetAction$(longTarget(FocusType.columnComment, range))
    );

    const match = rangeOnScreen(app, FocusType.columnComment, range);
    expect(match.left).toBe(40);
  });

  it('leaves the scroll out while the match is on screen, though its cell is not whole (AC-N7)', () => {
    const app = seed();
    app.store.dispatchSync(
      changeViewportAction({ width: NARROW, height: 600 })
    );
    addLongTable(app);
    const target = longTarget(FocusType.columnComment);
    app.store.dispatchSync(showErdTargetAction$(target));
    const batches = recordBatches(app);

    app.store.dispatchSync(showErdTargetAction$(target));

    const cell = cellOnScreen(app, FocusType.columnComment, 'long');
    expect(cell.left).toBeLessThan(0);
    expect(batches.flat()).not.toContain('settings.scrollTo');
  });

  it('measures the match at the zoom the document is at', () => {
    const app = seed();
    app.store.dispatchSync(
      changeViewportAction({ width: NARROW, height: 600 }),
      changeZoomLevelAction({ value: 1.5 })
    );
    addLongTable(app);

    app.store.dispatchSync(
      showErdTargetAction$(longTarget(FocusType.columnComment))
    );

    const match = rangeOnScreen(
      app,
      FocusType.columnComment,
      lastWord(FocusType.columnComment)
    );
    expect(match.left).toBeGreaterThanOrEqual(40);
    expect(match.right).toBeCloseTo(NARROW - 40, 6);
  });

  it('goes by the whole cell while it fits, whatever part of it the match is', () => {
    const app = seed();
    addWideTable(app);
    const comment = app.store.state.collections.tableEntities.wide.comment;
    const target = {
      ...wideTarget(FocusType.tableComment),
      range: { text: comment, start: comment.length - 8, end: comment.length },
    };

    app.store.dispatchSync(
      changeViewportAction({ width: NARROW, height: 600 })
    );
    app.store.dispatchSync(showErdTargetAction$(target));
    const withRange = { ...app.store.state.settings };
    app.store.dispatchSync(scrollToAction({ originX: 0, originY: 0 }));
    app.store.dispatchSync(
      showErdTargetAction$(wideTarget(FocusType.tableComment))
    );

    expect(withRange.originX).toBe(app.store.state.settings.originX);
    expect(withRange.originY).toBe(app.store.state.settings.originY);
  });

  it('brings a match cut off past the width a comment is held to to the end the cell shows', () => {
    const app = seed();
    app.store.dispatchSync(
      changeViewportAction({ width: NARROWER, height: 600 }),
      changeMaxWidthCommentAction({ value: 200 })
    );
    addLongTable(app);

    app.store.dispatchSync(
      showErdTargetAction$(longTarget(FocusType.tableComment))
    );

    // The canvas is 188 px, too narrow for the 200 px the comment keeps.
    const cell = cellOnScreen(app, FocusType.tableComment, 'long');
    expect(cell.right - cell.left).toBe(200);
    expect(cell.right).toBe(NARROWER - 40);
  });

  it('keeps a match found in a hidden comment off the long name ringed in its place', () => {
    const app = seed();
    app.store.dispatchSync(
      changeViewportAction({ width: NARROW, height: 600 })
    );
    hide(app, Show.columnComment);
    addLongTable(app);

    app.store.dispatchSync(
      showErdTargetAction$(longTarget(FocusType.columnComment))
    );

    expect(app.store.state.editor.focusTable?.focusType).toBe(
      FocusType.columnName
    );
    // Too long for the canvas, the name goes by its start, as without a match.
    expect(cellOnScreen(app, FocusType.columnName, 'long').left).toBe(40);
  });
});

describe('showErdTargetAction$ with a relationship being drawn', () => {
  it('neither starts nor finishes the relationship, however many jumps are made', () => {
    const app = seed();
    app.store.dispatchSync(
      changeColumnPrimaryKeyAction({ id: 'c0', tableId: 'tall', value: true }),
      addTableAction({ id: 'other', ui: { x: 900, y: 60, zIndex: 3 } }),
      addColumnAction({ id: 'o0', tableId: 'other' }),
      drawStartRelationshipAction({ relationshipType: RelationshipType.OneN })
    );

    app.store.dispatchSync(
      showErdTargetAction$(column('c0', FocusType.columnName))
    );
    app.store.dispatchSync(
      showErdTargetAction$({ kind: 'table', tableId: 'other' })
    );

    const { doc, collections, editor } = app.store.state;
    expect(doc.relationshipIds).toEqual([]);
    expect(collections.tableEntities.other.columnIds).toEqual(['o0']);
    expect(editor.drawRelationship).toMatchObject({
      relationshipType: RelationshipType.OneN,
      start: null,
    });
    expect(editor.selectedMap).toEqual({ other: SelectType.table });
  });

  it('brings the table jumped to in front of everything else', () => {
    const app = seed();

    app.store.dispatchSync(
      showErdTargetAction$({ kind: 'table', tableId: 'tall' })
    );

    const { tall } = app.store.state.collections.tableEntities;
    const { note } = app.store.state.collections.memoEntities;
    expect(tall.ui.zIndex).toBeGreaterThan(note.ui.zIndex);
  });
});

describe('goToErdTarget', () => {
  it('takes the ERD tab in a batch of its own before the jump', () => {
    const app = seed();
    app.store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.visualization })
    );
    const batches = recordBatches(app);

    goToErdTarget(app.store, { kind: 'memo', memoId: 'note' });

    expect(batches[0]).toEqual(['settings.changeCanvasType']);
    expect(batches[1]).toContain('settings.scrollTo');
    expect(batches[1]).not.toContain('settings.changeCanvasType');
    expect(app.store.state.settings.canvasType).toBe(CanvasType.ERD);
  });

  it('changes no tab when the ERD is up already', () => {
    const app = seed();
    const batches = recordBatches(app);

    goToErdTarget(app.store, { kind: 'memo', memoId: 'note' });
    showErdTab(app.store);

    expect(batches.flat()).not.toContain('settings.changeCanvasType');
    expect(app.store.state.editor.selectedMap).toEqual({
      note: SelectType.memo,
    });
  });
});

const span = (start: number, end: number): Span => ({ start, end });

describe('planJump', () => {
  const VIEW = { width: 800, height: 600 };
  const at = (x: Span, y: Span) => planJump(VIEW, [x, y], [x, y]);

  it('leaves a short rect whose middle is in the middle half on both axes (AC-N5)', () => {
    expect(at(span(300, 500), span(200, 400))).toBeNull();
  });

  it('centres a short rect on the axis its middle is off, and leaves the other (AC-N6)', () => {
    expect(at(span(0, 100), span(200, 400))).toEqual({ x: 350, y: 200 });
    expect(at(span(300, 500), span(500, 560))).toEqual({ x: 300, y: 270 });
  });

  it('leaves a rect over half the axis while it shows whole (AC-N7)', () => {
    expect(at(span(10, 700), span(10, 500))).toBeNull();
  });

  it('starts a rect over half the axis a margin down, and centres it across, once it shows in part', () => {
    expect(at(span(-100, 500), span(-100, 400))).toEqual({
      x: 100,
      y: EDGE_MARGIN,
    });
  });

  it('centres a rect within both margins of the axis once it shows in part', () => {
    expect(at(span(-10, 750), span(0, 590))).toEqual({ x: 20, y: 0 });
  });

  it('goes by the focus of a rect longer than the axis, and leaves it while the focus shows', () => {
    const rect = span(-500, 1500);

    expect(
      planJump(VIEW, [span(300, 500), rect], [span(300, 500), span(100, 130)])
    ).toBeNull();
    expect(
      planJump(VIEW, [span(300, 500), rect], [span(300, 500), span(-300, -270)])
    ).toEqual({ x: 300, y: EDGE_MARGIN - 200 });
  });

  it('moves nothing where the start it works out is within half a pixel of where the rect stands', () => {
    const across = span(300, 500);
    const rect = span(0, 3000);

    expect(
      planJump(VIEW, [across, rect], [across, span(40.2, 1000)])
    ).toBeNull();
    expect(planJump(VIEW, [across, rect], [across, span(41, 1000)])).toEqual({
      x: 300,
      y: -1,
    });
  });
});

/** Two tables tied by a relationship, the parent first, each with a run of columns. */
function seedPair(
  parent: { x: number; y: number },
  child: { x: number; y: number },
  rows = 0
): AppContext {
  const app = createTestAppContext();
  apps.push(app);
  app.store.dispatchSync(
    changeViewportAction(VIEWPORT),
    addTableAction({ id: 'parent', ui: { ...parent, zIndex: 1 } }),
    addTableAction({ id: 'child', ui: { ...child, zIndex: 2 } }),
    ...Array.from({ length: rows }, (_, index) => [
      addColumnAction({ id: `p${index}`, tableId: 'parent' }),
      addColumnAction({ id: `k${index}`, tableId: 'child' }),
    ]).flat(),
    addColumnAction({ id: 'pk', tableId: 'parent' }),
    addColumnAction({ id: 'fk', tableId: 'child' }),
    addRelationshipAction({
      id: 'rel',
      relationshipType: RelationshipType.OneN,
      start: { tableId: 'parent', columnIds: ['pk'] } as any,
      end: { tableId: 'child', columnIds: ['fk'] } as any,
    })
  );
  return app;
}

/** Where a table stands on screen, down: its top and bottom. */
function tableSpanDown(app: AppContext, tableId: string): Span {
  const { state } = app.store;
  const rect = getTableRect(state, state.collections.tableEntities[tableId]);
  return {
    start: toScreenPoint(state.settings, rect).y,
    end: toScreenPoint(state.settings, { x: rect.x, y: rect.y + rect.height })
      .y,
  };
}

const relationship = { kind: 'relationship' as const, relationshipId: 'rel' };

describe('showErdTargetAction$ to a relationship', () => {
  it('brings both tables on screen where the two fit in it (AC-N3b)', () => {
    const app = seedPair({ x: 60, y: -400 }, { x: 60, y: 100 }, 10);
    app.store.dispatchSync(changeViewportAction({ width: 1200, height: 1200 }));

    app.store.dispatchSync(showErdTargetAction$(relationship));

    const parent = tableSpanDown(app, 'parent');
    const child = tableSpanDown(app, 'child');
    expect(parent.start).toBeGreaterThanOrEqual(0);
    expect(child.end).toBeLessThanOrEqual(1200);
  });

  it('selects the child table alone with its foreign key column focused, since nothing selects a relationship', () => {
    const app = seedPair({ x: 60, y: 60 }, { x: 600, y: 60 });
    app.store.dispatchSync(
      showErdTargetAction$({ kind: 'table', tableId: 'parent' })
    );

    app.store.dispatchSync(showErdTargetAction$(relationship));

    const { selectedMap, focusTable } = app.store.state.editor;
    expect(selectedMap).toEqual({ child: SelectType.table });
    expect(focusTable).toMatchObject({
      tableId: 'child',
      columnId: 'fk',
      focusType: FocusType.columnName,
      selectColumnIds: ['fk'],
    });
  });

  it('selects every key column in the order the child holds them, the first focused', () => {
    const app = seedPair({ x: 60, y: 60 }, { x: 600, y: 60 }, 2);
    app.store.dispatchSync(
      addRelationshipAction({
        id: 'pair',
        relationshipType: RelationshipType.OneN,
        start: { tableId: 'parent', columnIds: ['p0', 'p1'] } as any,
        end: { tableId: 'child', columnIds: ['k1', 'k0'] } as any,
      })
    );

    app.store.dispatchSync(
      showErdTargetAction$({ kind: 'relationship', relationshipId: 'pair' })
    );

    expect(app.store.state.editor.focusTable).toMatchObject({
      tableId: 'child',
      columnId: 'k0',
      selectColumnIds: ['k0', 'k1'],
    });
  });

  it('shows the child where the two are too far apart to fit, above the parent', () => {
    const app = seedPair({ x: 60, y: 3000 }, { x: 60, y: 600 });
    app.store.dispatchSync(scrollToAction({ originX: 0, originY: -6000 }));

    app.store.dispatchSync(showErdTargetAction$(relationship));

    expect(headerOnScreen(app, 'child').topLeft.y).toBe(EDGE_MARGIN);
    expect(tableSpanDown(app, 'parent').start).toBeGreaterThan(VIEWPORT.height);
  });

  it('shows the child whole a margin above the bottom where it stands far below the parent', () => {
    const app = seedPair({ x: 60, y: 600 }, { x: 60, y: 3000 });
    app.store.dispatchSync(scrollToAction({ originX: 0, originY: 6000 }));

    app.store.dispatchSync(showErdTargetAction$(relationship));

    const child = tableSpanDown(app, 'child');
    expect(child.start).toBeGreaterThanOrEqual(0);
    expect(child.end).toBeCloseTo(VIEWPORT.height - EDGE_MARGIN, 0);
    expect(tableSpanDown(app, 'parent').end).toBeLessThan(0);
  });

  it('asks for nothing for a relationship or a table the document no longer holds', () => {
    const app = seedPair({ x: 60, y: 60 }, { x: 600, y: 60 });
    const batches = recordBatches(app);

    app.store.dispatchSync(
      showErdTargetAction$({ kind: 'relationship', relationshipId: 'gone' })
    );
    expect(batches.flat()).toEqual([]);
  });
});

/** A table group around one member table, its stored box the size given. */
function seedGroup(ui: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  const app = createTestAppContext();
  apps.push(app);
  app.store.dispatchSync(
    changeViewportAction(VIEWPORT),
    addTableGroupAction({ id: 'group', ui: { ...ui, zIndex: 1 } }),
    addTableAction({
      id: 'member',
      ui: { x: ui.x + 20, y: ui.y + 40, zIndex: 2 },
    }),
    changeTableGroupAction({ id: 'member', value: 'group' })
  );
  return app;
}

/** Where the group's box stands on screen, down. */
function groupSpanDown(app: AppContext): Span {
  const { state } = app.store;
  const box = getTableGroupRect(
    state,
    state.collections.tableGroupEntities.group
  );
  return {
    start: toScreenPoint(state.settings, box).y,
    end: toScreenPoint(state.settings, { x: box.x, y: box.y + box.height }).y,
  };
}

const group = { kind: 'tableGroup' as const, tableGroupId: 'group' };

describe('showErdTargetAction$ to a table group', () => {
  it('starts a group over half the screen a margin down when its title alone shows (AC-N4b)', () => {
    const app = seedGroup({ x: 60, y: 560, width: 400, height: 360 });

    app.store.dispatchSync(showErdTargetAction$(group));

    const box = groupSpanDown(app);
    expect(box.start).toBe(EDGE_MARGIN);
    expect(box.end).toBeLessThanOrEqual(VIEWPORT.height);
    expect(app.store.state.editor.selectedMap).toMatchObject({
      group: SelectType.tableGroup,
    });
  });

  it('brings the title of a group taller than the screen a margin below the top', () => {
    const app = seedGroup({ x: 60, y: 2000, width: 400, height: 1400 });

    app.store.dispatchSync(showErdTargetAction$(group));

    expect(groupSpanDown(app).start).toBe(EDGE_MARGIN);
  });

  it('goes to no group while the groups are hidden, nor to one that is gone', () => {
    const app = seedGroup({ x: 60, y: 2000, width: 400, height: 300 });
    const batches = recordBatches(app);

    app.store.dispatchSync(
      showErdTargetAction$({ kind: 'tableGroup', tableGroupId: 'gone' })
    );
    app.store.dispatchSync(
      changeShowAction({ show: Show.hideTableGroup, value: true })
    );
    app.store.dispatchSync(showErdTargetAction$(group));

    expect(batches.flat()).not.toContain('settings.scrollTo');
    expect(app.store.state.editor.selectedMap).not.toHaveProperty('group');
  });
});

describe('showErdTargetAction$ pressed again', () => {
  it.each([
    ['a table', () => seed(), { kind: 'table' as const, tableId: 'tall' }],
    ['a column', () => seed(), column('c59', FocusType.columnName)],
    ['a memo', () => seed(), { kind: 'memo' as const, memoId: 'note' }],
    [
      'a relationship',
      () => seedPair({ x: 3000, y: 3000 }, { x: 3500, y: 3200 }),
      relationship,
    ],
    [
      'a table group',
      () => seedGroup({ x: 2000, y: 2000, width: 400, height: 300 }),
      group,
    ],
  ])('moves nothing the second time for %s (AC-N13)', (_, make, target) => {
    const app = make();
    app.store.dispatchSync(showErdTargetAction$(target));
    const batches = recordBatches(app);

    app.store.dispatchSync(showErdTargetAction$(target));

    expect(batches.flat()).not.toContain('settings.scrollTo');
  });

  it('moves nothing the second time at a zoom whose origin the store rounds', () => {
    const app = seed();
    addLongTable(app);
    app.store.dispatchSync(changeZoomLevelAction({ value: 1.3 }));
    const target = longTarget(FocusType.columnComment);
    app.store.dispatchSync(showErdTargetAction$(target));
    const batches = recordBatches(app);

    app.store.dispatchSync(showErdTargetAction$(target));

    expect(batches.flat()).not.toContain('settings.scrollTo');
  });
});
