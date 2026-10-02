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
  goToErdTarget,
  showErdTab,
  showErdTargetAction$,
} from '@/components/erd/goToErdTarget';
import { Open } from '@/constants/open';
import { CanvasType, RelationshipType, Show } from '@/constants/schema';
import {
  changeOpenMapAction,
  changeViewportAction,
  drawStartRelationshipAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
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
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnNameAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import {
  getColumnRect,
  getTableHeaderRect,
  getTableRect,
  getTableWidths,
} from '@/konva/scene/metrics';
import { toScreenPoint } from '@/konva/scene/viewport';
import { bHas } from '@/utils/bit';

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

  it('leaves the scroll out for a row already on screen', () => {
    const app = seed();
    const batches = recordBatches(app);

    app.store.dispatchSync(
      showErdTargetAction$(column('c0', FocusType.columnName))
    );

    expect(batches.flat()).not.toContain('settings.scrollTo');
    expect(app.store.state.editor.focusTable?.columnId).toBe('c0');
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

    // The last row of the tall table is below the screen, but its name is not.
    app.store.dispatchSync(
      showErdTargetAction$(column('c59', FocusType.columnName))
    );
    expect(batches.flat()).not.toContain('settings.scrollTo');
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

  it('keeps the header of a table the panel would cover clear of the panel', () => {
    const app = seed();
    addFarTallTable(app);

    app.store.dispatchSync(showErdTargetAction$(name('far'), 300));

    const { topLeft, bottomRight } = headerOnScreen(app, 'far');
    expect(topLeft.x).toBeGreaterThanOrEqual(300);
    expect(bottomRight.x).toBeLessThanOrEqual(VIEWPORT.width);
    expect(topLeft.y).toBe(40);
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

  it('starts the ringed name of a row wider than the screen a margin in from its left edge', () => {
    const app = seed();
    app.store.dispatchSync(changeViewportAction({ width: 200, height: 600 }));

    app.store.dispatchSync(
      showErdTargetAction$(column('c30', FocusType.columnName))
    );

    const { settings, collections } = app.store.state;
    const table = collections.tableEntities.tall;
    const row = getColumnRect(app.store.state, table, 30);
    const name = getColumnCellSlots(
      app.store.state,
      getTableWidths(app.store.state, table)
    ).find(slot => slot.focusType === FocusType.columnName);
    const topLeft = toScreenPoint(settings, row);
    const tableLeft = toScreenPoint(
      settings,
      getTableRect(app.store.state, table)
    );
    expect(row.width).toBeGreaterThan(200);
    expect(tableLeft.x + (name?.x ?? 0)).toBe(40);
    // The key badge before the name stays on screen too.
    expect(topLeft.x).toBeGreaterThan(0);
    // Shorter than the screen, the row still stands in its middle down.
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
    ['a column comment', 0, FocusType.columnComment],
    ['a column comment beside a panel', 412, FocusType.columnComment],
    ['a table comment', 0, FocusType.tableComment],
    ['a table comment beside a panel', 412, FocusType.tableComment],
  ])('brings %s a margin inside the canvas left clear', (_, covered, focus) => {
    const app = seed();
    addWideTable(app);

    app.store.dispatchSync(showErdTargetAction$(wideTarget(focus), covered));

    const { left, right, tableWidth } = cellOnScreen(app, focus);
    expect(tableWidth).toBeGreaterThan(VIEWPORT.width - covered);
    expect(left).toBeGreaterThanOrEqual(covered + 40);
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

describe('showErdTargetAction$ to a match in a cell wider than the canvas left clear', () => {
  it.each([
    ['a column comment', 800, 0, FocusType.columnComment],
    ['a column comment beside a panel', 800, 412, FocusType.columnComment],
    ['a column comment in a narrow strip', 600, 412, FocusType.columnComment],
    ['a table comment', 800, 0, FocusType.tableComment],
    ['a table comment beside a panel', 800, 412, FocusType.tableComment],
    ['a table comment in a narrow strip', 600, 412, FocusType.tableComment],
    ['a column name beside a panel', 800, 412, FocusType.columnName],
    ['a column name in a narrow strip', 600, 412, FocusType.columnName],
    ['a table name beside a panel', 800, 412, FocusType.tableName],
    ['a table name in a narrow strip', 600, 412, FocusType.tableName],
  ])(
    'brings the match at the end of %s a margin inside the canvas left clear',
    (_, width, covered, focus) => {
      const app = seed();
      app.store.dispatchSync(changeViewportAction({ width, height: 600 }));
      addLongTable(app);

      app.store.dispatchSync(showErdTargetAction$(longTarget(focus), covered));

      const cell = cellOnScreen(app, focus, 'long');
      const match = rangeOnScreen(app, focus, lastWord(focus));
      expect(cell.right - cell.left).toBeGreaterThan(width - covered - 80);
      expect(match.left).toBeGreaterThanOrEqual(covered + 40);
      expect(match.right).toBeLessThanOrEqual(width - 40);
      expect(app.store.state.editor.focusTable?.focusType).toBe(focus);
    }
  );

  it('starts a match at the start of a long comment a margin in from the panel', () => {
    const app = seed();
    addLongTable(app);
    const range = { text: LONG_COMMENT, start: 0, end: 3 };

    app.store.dispatchSync(
      showErdTargetAction$(longTarget(FocusType.columnComment, range), 412)
    );

    const match = rangeOnScreen(app, FocusType.columnComment, range);
    expect(match.left).toBe(412 + 40);
  });

  it('leaves the scroll out while the match is on screen, though its cell is not whole', () => {
    const app = seed();
    addLongTable(app);
    const target = longTarget(FocusType.columnComment);
    app.store.dispatchSync(showErdTargetAction$(target, 412));
    const batches = recordBatches(app);

    app.store.dispatchSync(showErdTargetAction$(target, 412));

    const cell = cellOnScreen(app, FocusType.columnComment, 'long');
    expect(cell.left).toBeLessThan(412);
    expect(batches.flat()).not.toContain('settings.scrollTo');
  });

  it('measures the match at the zoom the document is at', () => {
    const app = seed();
    app.store.dispatchSync(changeZoomLevelAction({ value: 1.5 }));
    addLongTable(app);

    app.store.dispatchSync(
      showErdTargetAction$(longTarget(FocusType.columnComment), 412)
    );

    const match = rangeOnScreen(
      app,
      FocusType.columnComment,
      lastWord(FocusType.columnComment)
    );
    expect(match.left).toBeGreaterThanOrEqual(412 + 40);
    expect(match.right).toBeCloseTo(VIEWPORT.width - 40, 6);
  });

  it('goes by the whole cell while it fits, whatever part of it the match is', () => {
    const app = seed();
    addWideTable(app);
    const comment = app.store.state.collections.tableEntities.wide.comment;
    const target = {
      ...wideTarget(FocusType.tableComment),
      range: { text: comment, start: comment.length - 8, end: comment.length },
    };

    app.store.dispatchSync(showErdTargetAction$(target, 412));
    const withRange = { ...app.store.state.settings };
    app.store.dispatchSync(scrollToAction({ originX: 0, originY: 0 }));
    app.store.dispatchSync(
      showErdTargetAction$(wideTarget(FocusType.tableComment), 412)
    );

    expect(withRange.originX).toBe(app.store.state.settings.originX);
    expect(withRange.originY).toBe(app.store.state.settings.originY);
  });

  it('brings a match cut off past the width a comment is held to to the end the cell shows', () => {
    const app = seed();
    app.store.dispatchSync(
      changeViewportAction({ width: 600, height: 600 }),
      changeMaxWidthCommentAction({ value: 200 })
    );
    addLongTable(app);

    app.store.dispatchSync(
      showErdTargetAction$(longTarget(FocusType.tableComment), 412)
    );

    // The strip beside the panel is 188 px, too narrow for the 200 px the comment keeps.
    const cell = cellOnScreen(app, FocusType.tableComment, 'long');
    expect(cell.right - cell.left).toBe(200);
    expect(cell.right).toBe(600 - 40);
  });

  it('keeps a match found in a hidden comment off the long name ringed in its place', () => {
    const app = seed();
    hide(app, Show.columnComment);
    addLongTable(app);

    app.store.dispatchSync(
      showErdTargetAction$(longTarget(FocusType.columnComment), 412)
    );

    expect(app.store.state.editor.focusTable?.focusType).toBe(
      FocusType.columnName
    );
    // Too long for the strip, the name goes by its start, as without a match.
    expect(cellOnScreen(app, FocusType.columnName, 'long').left).toBe(412 + 40);
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

describe('showErdTargetAction$ beside a panel', () => {
  it('moves a table the panel covers into the middle of the canvas left beside it', () => {
    const app = seed();
    const batches = recordBatches(app);

    app.store.dispatchSync(
      showErdTargetAction$(column('c0', FocusType.columnName), 400)
    );

    expect(batches.flat()).toContain('settings.scrollTo');
    const { settings } = app.store.state;
    // The row starts at x 60 and is centred on x 600, the middle of 400 to 800.
    expect(settings.originX).toBeGreaterThan(300);
  });

  it('leaves a table already clear of the panel where it is', () => {
    const app = seed();
    const batches = recordBatches(app);

    app.store.dispatchSync(
      showErdTargetAction$(column('c0', FocusType.columnName), 40)
    );

    expect(batches.flat()).not.toContain('settings.scrollTo');
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

  /** Where the ringed name of the row c30 and the row itself stand on screen, across. */
  function rowOnScreen(app: AppContext) {
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
      row: { left: toScreenPoint(settings, row).x, width: row.width },
      name: {
        left: tableLeft + (name?.x ?? 0),
        right: tableLeft + (name?.x ?? 0) + (name?.width ?? 0),
      },
    };
  }

  /** The panel's left inset and width and the gap a jump keeps from it. */
  const COVERED = 16 + 380 + 16;

  it('lands in the strip a narrow canvas leaves beside an open panel, by the cell it rings', () => {
    const app = seed();
    app.store.dispatchSync(
      changeViewportAction({ width: 600, height: 600 }),
      changeOpenMapAction({ [Open.findReplace]: true })
    );

    goToErdTarget(app.store, column('c30', FocusType.columnName));

    const { row, name } = rowOnScreen(app);
    expect(row.width).toBeGreaterThan(600 - COVERED);
    // Wider than the strip, the row goes by its name, a margin in from the panel.
    expect(name.left).toBeCloseTo(COVERED + 40, 6);
    expect(name.right).toBeLessThanOrEqual(600);
  });

  it('lands as if there were no panel once the strip beside it is narrower than 160 px', () => {
    const app = seed();
    const width = COVERED + 159;
    app.store.dispatchSync(
      changeViewportAction({ width, height: 600 }),
      changeOpenMapAction({ [Open.findReplace]: true })
    );

    goToErdTarget(app.store, column('c30', FocusType.columnName));

    const { row } = rowOnScreen(app);
    expect(row.left + row.width / 2).toBeCloseTo(width / 2, 6);
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
