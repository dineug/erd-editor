// The store half of a jump from a search result: the ERD tab alone first, then
// the scroll, the selection and the ring on the cell, where the scroll comes
// only for a target not already on screen whole.

import type { AnyAction } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import {
  goToErdTarget,
  showErdTab,
  showErdTargetAction$,
} from '@/components/erd/goToErdTarget';
import { CanvasType, RelationshipType, Show } from '@/constants/schema';
import {
  changeViewportAction,
  drawStartRelationshipAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  changeCanvasTypeAction,
  changeShowAction,
  changeZoomLevelAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
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

  it('scrolls to the whole table when a zoom this far out draws no rows', () => {
    const app = seed();
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    const batches = recordBatches(app);

    app.store.dispatchSync(
      showErdTargetAction$(column('c59', FocusType.columnName))
    );

    expect(batches.flat()).toContain('settings.scrollTo');
    expect(app.store.state.editor.focusTable?.columnId).toBe('c59');
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

    goToErdTarget(app.store, { kind: 'memo', memoId: 'note' }, 100);

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
