import { type LWW } from '@dineug/erd-editor-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasType, Show } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  changeHasHistoryAction,
  changeOpenMapAction,
  changeViewportAction,
  clearAction,
  dragendColumnAction,
  dragstartColumnAction,
  drawEndRelationshipAction,
  drawRelationshipAction,
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
  editTableAction,
  editTableEndAction,
  focusColumnAction,
  focusMoveTableAction,
  focusTableAction,
  focusTableEndAction,
  getLWWAction,
  hoverColumnMapAction,
  hoverRelationshipMapAction,
  initialClearAction,
  initialLoadJsonAction,
  loadJsonAction,
  mergeLWWAction,
  selectAction,
  selectAllAction,
  selectAllColumnAction,
  sharedMouseTrackerAction,
  unselectAllAction,
  validationIdsAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, MoveKey, SelectType } from '@/engine/modules/editor/state';
import { createStore, Store } from '@/engine/store';
import { Tag } from '@/engine/tag';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createMemo } from '@/utils/collection/memo.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';

function createTestStore(enableObservable = true): Store {
  return createStore(
    { toWidth: text => text.length * 10, clock: new Clock() },
    enableObservable
  );
}

function addTable(store: Store, id: string, columnIds: string[] = []) {
  const table = createTable({ id, name: id, columnIds: [...columnIds] });
  store.state.collections.tableEntities[id] = table;
  store.state.doc.tableIds.push(id);
  return table;
}

function addColumn(store: Store, tableId: string, id: string) {
  const column = createColumn({ id, tableId, name: id });
  store.state.collections.tableColumnEntities[id] = column;
  return column;
}

function addMemo(store: Store, id: string) {
  const memo = createMemo({ id });
  store.state.collections.memoEntities[id] = memo;
  store.state.doc.memoIds.push(id);
  return memo;
}

/** table `t1` with columns `c1`, `c2`, `c3`. */
function seedTableWithColumns(store: Store) {
  addTable(store, 't1', ['c1', 'c2', 'c3']);
  addColumn(store, 't1', 'c1');
  addColumn(store, 't1', 'c2');
  addColumn(store, 't1', 'c3');
}

let store: Store;

beforeEach(() => {
  store = createTestStore();
});

afterEach(() => {
  store.destroy();
});

describe('editor.changeHasHistory', () => {
  it('mirrors the undo/redo flags onto the editor state', () => {
    store.dispatchSync(
      changeHasHistoryAction({ hasUndo: true, hasRedo: false })
    );

    expect(store.state.editor.hasUndo).toBe(true);
    expect(store.state.editor.hasRedo).toBe(false);

    store.dispatchSync(
      changeHasHistoryAction({ hasUndo: false, hasRedo: true })
    );

    expect(store.state.editor.hasUndo).toBe(false);
    expect(store.state.editor.hasRedo).toBe(true);
  });
});

describe('editor.selectAll / unselectAll / select', () => {
  it('selects every table and memo in the doc', () => {
    addTable(store, 't1');
    addTable(store, 't2');
    addMemo(store, 'm1');

    store.dispatchSync(selectAllAction());

    expect(store.state.editor.selectedMap).toEqual({
      t1: SelectType.table,
      t2: SelectType.table,
      m1: SelectType.memo,
    });
  });

  it('produces an empty map when the doc is empty', () => {
    store.dispatchSync(selectAllAction());
    expect(store.state.editor.selectedMap).toEqual({});
  });

  it('lets the table entry win when an id is both a table and a memo', () => {
    store.state.doc.tableIds.push('dup');
    store.state.doc.memoIds.push('dup');

    store.dispatchSync(selectAllAction());

    expect(store.state.editor.selectedMap.dup).toBe(SelectType.table);
  });

  it('merges the select payload into the existing map', () => {
    store.dispatchSync(selectAction({ t1: SelectType.table }));
    store.dispatchSync(selectAction({ m1: SelectType.memo }));

    expect(store.state.editor.selectedMap).toEqual({
      t1: SelectType.table,
      m1: SelectType.memo,
    });
  });

  it('clears every entry on unselectAll', () => {
    store.dispatchSync(
      selectAction({ t1: SelectType.table, m1: SelectType.memo })
    );

    store.dispatchSync(unselectAllAction());

    expect(store.state.editor.selectedMap).toEqual({});
    expect(Object.keys(store.state.editor.selectedMap)).toHaveLength(0);
  });
});

describe('editor.changeViewport', () => {
  it('writes width and height into the viewport', () => {
    store.dispatchSync(changeViewportAction({ width: 1024, height: 768 }));

    expect(store.state.editor.viewport).toEqual({ width: 1024, height: 768 });
  });
});

describe('editor.clear / initialClear', () => {
  it('resets doc and collections on clear', () => {
    seedTableWithColumns(store);
    addMemo(store, 'm1');

    store.dispatchSync(clearAction());

    expect(store.state.doc.tableIds).toEqual([]);
    expect(store.state.doc.memoIds).toEqual([]);
    expect(store.state.collections.tableEntities).toEqual({});
    expect(store.state.collections.tableColumnEntities).toEqual({});
    expect(store.state.collections.memoEntities).toEqual({});
  });

  it('keeps settings untouched on clear', () => {
    store.state.settings.databaseName = 'keep-me';
    seedTableWithColumns(store);

    store.dispatchSync(clearAction());

    expect(store.state.settings.databaseName).toBe('keep-me');
  });

  it('resets doc and collections on initialClear', () => {
    seedTableWithColumns(store);

    store.dispatchSync(initialClearAction());

    expect(store.state.doc.tableIds).toEqual([]);
    expect(store.state.collections.tableEntities).toEqual({});
  });
});

describe('editor.loadJson / initialLoadJson', () => {
  const buildJson = (canvasType: string) =>
    JSON.stringify({
      version: '3.0.0',
      settings: { canvasType, databaseName: 'loaded' },
      doc: { tableIds: ['t1'], relationshipIds: [], indexIds: [], memoIds: [] },
      collections: {
        tableEntities: {
          t1: { id: 't1', name: 'users' },
        },
      },
    });

  it('loads doc, collections, settings and version', () => {
    store.dispatchSync(
      loadJsonAction({ value: buildJson(CanvasType.schemaSQL) })
    );

    expect(store.state.version).toBe('3.0.0');
    expect(store.state.doc.tableIds).toEqual(['t1']);
    expect(store.state.collections.tableEntities.t1.name).toBe('users');
    expect(store.state.settings.databaseName).toBe('loaded');
    expect(store.state.settings.canvasType).toBe(CanvasType.schemaSQL);
  });

  it('falls back to the ERD canvas type when the loaded one is unknown', () => {
    store.dispatchSync(loadJsonAction({ value: buildJson('nope') }));

    expect(store.state.settings.canvasType).toBe(CanvasType.ERD);
  });

  it('loads through initialLoadJson as well', () => {
    store.dispatchSync(
      initialLoadJsonAction({ value: buildJson(CanvasType.visualization) })
    );

    expect(store.state.doc.tableIds).toEqual(['t1']);
    expect(store.state.settings.canvasType).toBe(CanvasType.visualization);
  });

  it('falls back to the ERD canvas type on initialLoadJson too', () => {
    store.dispatchSync(initialLoadJsonAction({ value: buildJson('') }));

    expect(store.state.settings.canvasType).toBe(CanvasType.ERD);
  });
});

describe('editor.focusTable', () => {
  it('focuses a table with tableName when no focusType is given', () => {
    addTable(store, 't1');

    store.dispatchSync(focusTableAction({ tableId: 't1' }));

    expect(store.state.editor.focusTable).toEqual({
      tableId: 't1',
      focusType: FocusType.tableName,
      columnId: null,
      prevSelectColumnId: null,
      selectColumnIds: [],
      edit: false,
    });
  });

  it('focuses a table with the requested focusType', () => {
    addTable(store, 't1');

    store.dispatchSync(
      focusTableAction({ tableId: 't1', focusType: FocusType.tableComment })
    );

    expect(store.state.editor.focusTable?.focusType).toBe(
      FocusType.tableComment
    );
  });

  it('ignores an unknown table id', () => {
    store.dispatchSync(focusTableAction({ tableId: 'ghost' }));
    expect(store.state.editor.focusTable).toBeNull();

    store.dispatchSync(
      focusTableAction({ tableId: 'ghost', focusType: FocusType.tableName })
    );
    expect(store.state.editor.focusTable).toBeNull();
  });

  it('resets the column selection when re-focusing the same table', () => {
    seedTableWithColumns(store);
    store.dispatchSync(
      focusColumnAction({
        tableId: 't1',
        columnId: 'c2',
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
    expect(store.state.editor.focusTable?.selectColumnIds).toEqual(['c2']);

    store.dispatchSync(
      focusTableAction({ tableId: 't1', focusType: FocusType.tableComment })
    );

    expect(store.state.editor.focusTable).toEqual({
      tableId: 't1',
      focusType: FocusType.tableComment,
      columnId: null,
      prevSelectColumnId: null,
      selectColumnIds: [],
      edit: false,
    });
  });

  it('does nothing when the same table is focused without a focusType', () => {
    seedTableWithColumns(store);
    store.dispatchSync(
      focusColumnAction({
        tableId: 't1',
        columnId: 'c2',
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );

    store.dispatchSync(focusTableAction({ tableId: 't1' }));

    expect(store.state.editor.focusTable?.columnId).toBe('c2');
    expect(store.state.editor.focusTable?.focusType).toBe(FocusType.columnName);
  });

  it('moves focus to another table without a focusType', () => {
    addTable(store, 't1');
    addTable(store, 't2');
    store.dispatchSync(focusTableAction({ tableId: 't1' }));

    store.dispatchSync(focusTableAction({ tableId: 't2' }));

    expect(store.state.editor.focusTable?.tableId).toBe('t2');
    expect(store.state.editor.focusTable?.focusType).toBe(FocusType.tableName);
  });

  it('clears the focus on focusTableEnd', () => {
    addTable(store, 't1');
    store.dispatchSync(focusTableAction({ tableId: 't1' }));

    store.dispatchSync(focusTableEndAction());

    expect(store.state.editor.focusTable).toBeNull();
  });
});

describe('editor.focusColumn', () => {
  beforeEach(() => {
    seedTableWithColumns(store);
  });

  const focus = (
    columnId: string,
    modifiers: Partial<{ $mod: boolean; shiftKey: boolean }> = {}
  ) =>
    store.dispatchSync(
      focusColumnAction({
        tableId: 't1',
        columnId,
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
        ...modifiers,
      })
    );

  it('creates the focus entry when no table is focused yet', () => {
    focus('c2');

    expect(store.state.editor.focusTable).toEqual({
      tableId: 't1',
      focusType: FocusType.columnName,
      columnId: 'c2',
      prevSelectColumnId: 'c2',
      selectColumnIds: ['c2'],
      edit: false,
    });
  });

  it('ignores an unknown table id when nothing is focused', () => {
    store.dispatchSync(
      focusColumnAction({
        tableId: 'ghost',
        columnId: 'c1',
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );

    expect(store.state.editor.focusTable).toBeNull();
  });

  it('ignores the action when the focused table entity disappeared', () => {
    focus('c1');
    Reflect.deleteProperty(store.state.collections.tableEntities, 't1');

    focus('c3');

    expect(store.state.editor.focusTable?.columnId).toBe('c1');
  });

  it('replaces the selection without modifiers', () => {
    focus('c1');
    focus('c3');

    expect(store.state.editor.focusTable?.selectColumnIds).toEqual(['c3']);
    expect(store.state.editor.focusTable?.prevSelectColumnId).toBe('c3');
  });

  it('appends a single column with $mod', () => {
    focus('c1');
    focus('c3', { $mod: true });

    expect(store.state.editor.focusTable?.selectColumnIds).toEqual([
      'c1',
      'c3',
    ]);
  });

  it('selects a range with shiftKey', () => {
    focus('c1');
    focus('c3', { shiftKey: true });

    expect(store.state.editor.focusTable?.selectColumnIds).toEqual([
      'c1',
      'c2',
      'c3',
    ]);
  });

  it('appends a range with $mod + shiftKey', () => {
    focus('c2');
    focus('c1', { $mod: true, shiftKey: true });

    expect(store.state.editor.focusTable?.selectColumnIds).toEqual([
      'c2',
      'c1',
    ]);
  });
});

describe('editor.focusMoveTable', () => {
  beforeEach(() => {
    seedTableWithColumns(store);
    store.dispatchSync(focusTableAction({ tableId: 't1' }));
  });

  it('does nothing when no table is focused', () => {
    store.dispatchSync(focusTableEndAction());

    store.dispatchSync(
      focusMoveTableAction({ moveKey: MoveKey.ArrowDown, shiftKey: false })
    );

    expect(store.state.editor.focusTable).toBeNull();
  });

  it('always leaves edit mode', () => {
    store.dispatchSync(editTableAction());
    expect(store.state.editor.focusTable?.edit).toBe(true);

    store.dispatchSync(
      focusMoveTableAction({ moveKey: MoveKey.ArrowDown, shiftKey: false })
    );

    expect(store.state.editor.focusTable?.edit).toBe(false);
  });

  it('ArrowDown jumps from the table name to the first column', () => {
    store.dispatchSync(
      focusMoveTableAction({ moveKey: MoveKey.ArrowDown, shiftKey: false })
    );

    expect(store.state.editor.focusTable?.columnId).toBe('c1');
    expect(store.state.editor.focusTable?.focusType).toBe(FocusType.columnName);
    expect(store.state.editor.focusTable?.selectColumnIds).toEqual(['c1']);
  });

  it('ArrowUp jumps from the table name to the last column', () => {
    store.dispatchSync(
      focusMoveTableAction({ moveKey: MoveKey.ArrowUp, shiftKey: false })
    );

    expect(store.state.editor.focusTable?.columnId).toBe('c3');
    expect(store.state.editor.focusTable?.focusType).toBe(
      FocusType.columnComment
    );
  });

  it('ArrowRight walks to the next table focus type', () => {
    store.dispatchSync(
      focusMoveTableAction({ moveKey: MoveKey.ArrowRight, shiftKey: false })
    );

    expect(store.state.editor.focusTable?.focusType).toBe(
      FocusType.tableComment
    );
    expect(store.state.editor.focusTable?.columnId).toBeNull();
  });

  it('ArrowLeft from the first table type wraps into the last column', () => {
    store.dispatchSync(
      focusMoveTableAction({ moveKey: MoveKey.ArrowLeft, shiftKey: false })
    );

    expect(store.state.editor.focusTable?.columnId).toBe('c3');
    expect(store.state.editor.focusTable?.focusType).toBe(
      FocusType.columnComment
    );
  });

  it('Tab behaves like ArrowRight and shift+Tab like ArrowLeft', () => {
    store.dispatchSync(
      focusMoveTableAction({ moveKey: MoveKey.Tab, shiftKey: false })
    );
    expect(store.state.editor.focusTable?.focusType).toBe(
      FocusType.tableComment
    );

    store.dispatchSync(
      focusMoveTableAction({ moveKey: MoveKey.Tab, shiftKey: true })
    );
    expect(store.state.editor.focusTable?.focusType).toBe(FocusType.tableName);
  });

  it('ignores an unhandled move key', () => {
    store.dispatchSync(
      focusMoveTableAction({ moveKey: 'Enter', shiftKey: false })
    );

    expect(store.state.editor.focusTable?.focusType).toBe(FocusType.tableName);
    expect(store.state.editor.focusTable?.columnId).toBeNull();
  });
});

describe('editor.editTable / editTableEnd', () => {
  it('toggles the edit flag of the focused table', () => {
    addTable(store, 't1');
    store.dispatchSync(focusTableAction({ tableId: 't1' }));

    store.dispatchSync(editTableAction());
    expect(store.state.editor.focusTable?.edit).toBe(true);

    store.dispatchSync(editTableEndAction());
    expect(store.state.editor.focusTable?.edit).toBe(false);
  });

  it('is a no-op when nothing is focused', () => {
    store.dispatchSync(editTableAction());
    store.dispatchSync(editTableEndAction());

    expect(store.state.editor.focusTable).toBeNull();
  });
});

describe('editor.selectAllColumn', () => {
  it('selects every column of the focused table', () => {
    seedTableWithColumns(store);
    store.dispatchSync(focusTableAction({ tableId: 't1' }));

    store.dispatchSync(selectAllColumnAction());

    expect(store.state.editor.focusTable?.selectColumnIds).toEqual([
      'c1',
      'c2',
      'c3',
    ]);
  });

  it('is a no-op when nothing is focused', () => {
    store.dispatchSync(selectAllColumnAction());
    expect(store.state.editor.focusTable).toBeNull();
  });

  it('is a no-op when the focused table entity is gone', () => {
    seedTableWithColumns(store);
    store.dispatchSync(focusTableAction({ tableId: 't1' }));
    Reflect.deleteProperty(store.state.collections.tableEntities, 't1');

    store.dispatchSync(selectAllColumnAction());

    expect(store.state.editor.focusTable?.selectColumnIds).toEqual([]);
  });
});

describe('editor draw relationship', () => {
  it('starts a draw with an empty start point', () => {
    store.dispatchSync(drawStartRelationshipAction({ relationshipType: 8 }));

    expect(store.state.editor.drawRelationship).toEqual({
      relationshipType: 8,
      start: null,
      end: { x: 0, y: 0 },
    });
  });

  it('is a no-op to add a start table before a draw started', () => {
    addTable(store, 't1');

    store.dispatchSync(drawStartAddRelationshipAction({ tableId: 't1' }));

    expect(store.state.editor.drawRelationship).toBeNull();
  });

  it('ignores an unknown start table', () => {
    store.dispatchSync(drawStartRelationshipAction({ relationshipType: 8 }));

    store.dispatchSync(drawStartAddRelationshipAction({ tableId: 'ghost' }));

    expect(store.state.editor.drawRelationship?.start).toBeNull();
  });

  it('records the start table position', () => {
    const table = addTable(store, 't1');
    table.ui.x = 111;
    table.ui.y = 222;
    store.dispatchSync(drawStartRelationshipAction({ relationshipType: 8 }));

    store.dispatchSync(drawStartAddRelationshipAction({ tableId: 't1' }));

    expect(store.state.editor.drawRelationship?.start).toEqual({
      tableId: 't1',
      x: 111,
      y: 222,
    });
  });

  it('clears the draw state on drawEndRelationship', () => {
    store.dispatchSync(drawStartRelationshipAction({ relationshipType: 8 }));

    store.dispatchSync(drawEndRelationshipAction());

    expect(store.state.editor.drawRelationship).toBeNull();
  });

  it('is a no-op to move the pointer with no draw in progress', () => {
    store.dispatchSync(drawRelationshipAction({ x: 10, y: 10 }));

    expect(store.state.editor.drawRelationship).toBeNull();
  });

  it('is a no-op to move the pointer before a start table is set', () => {
    store.dispatchSync(drawStartRelationshipAction({ relationshipType: 8 }));

    store.dispatchSync(drawRelationshipAction({ x: 10, y: 10 }));

    expect(store.state.editor.drawRelationship?.end).toEqual({ x: 0, y: 0 });
  });

  it('translates the pointer into canvas coordinates', () => {
    addTable(store, 't1');
    store.state.settings.zoomLevel = 0.5;
    store.state.settings.scrollLeft = 20;
    store.state.settings.scrollTop = 30;
    store.dispatchSync(drawStartRelationshipAction({ relationshipType: 8 }));
    store.dispatchSync(drawStartAddRelationshipAction({ tableId: 't1' }));

    store.dispatchSync(drawRelationshipAction({ x: 120, y: 230 }));

    // width/height are 2000: zoom viewport origin is (500, 500) at zoom 0.5
    expect(store.state.editor.drawRelationship?.end).toEqual({
      x: -800,
      y: -600,
    });
  });

  it('is an identity transform at zoom level 1', () => {
    addTable(store, 't1');
    store.dispatchSync(drawStartRelationshipAction({ relationshipType: 8 }));
    store.dispatchSync(drawStartAddRelationshipAction({ tableId: 't1' }));

    store.dispatchSync(drawRelationshipAction({ x: 40, y: 60 }));

    expect(store.state.editor.drawRelationship?.end).toEqual({ x: 40, y: 60 });
  });
});

describe('editor hover maps', () => {
  it('replaces the hovered column map', () => {
    store.dispatchSync(hoverColumnMapAction({ columnIds: ['c1', 'c2'] }));
    expect(store.state.editor.hoverColumnMap).toEqual({ c1: true, c2: true });

    store.dispatchSync(hoverColumnMapAction({ columnIds: ['c3'] }));
    expect(store.state.editor.hoverColumnMap).toEqual({ c3: true });

    store.dispatchSync(hoverColumnMapAction({ columnIds: [] }));
    expect(store.state.editor.hoverColumnMap).toEqual({});
  });

  it('replaces the hovered relationship map', () => {
    store.dispatchSync(
      hoverRelationshipMapAction({ relationshipIds: ['r1', 'r2'] })
    );
    expect(store.state.editor.hoverRelationshipMap).toEqual({
      r1: true,
      r2: true,
    });

    store.dispatchSync(hoverRelationshipMapAction({ relationshipIds: ['r3'] }));
    expect(store.state.editor.hoverRelationshipMap).toEqual({ r3: true });

    store.dispatchSync(hoverRelationshipMapAction({ relationshipIds: [] }));
    expect(store.state.editor.hoverRelationshipMap).toEqual({});
  });
});

describe('editor.changeOpenMap', () => {
  it('merges the payload instead of replacing the map', () => {
    store.dispatchSync(changeOpenMapAction({ a: true }));
    store.dispatchSync(changeOpenMapAction({ b: false }));
    store.dispatchSync(changeOpenMapAction({ a: false }));

    expect(store.state.editor.openMap).toEqual({ a: false, b: false });
  });
});

describe('editor column drag', () => {
  it('marks the dragged columns and clears them again', () => {
    store.dispatchSync(
      dragstartColumnAction({ tableId: 't1', columnIds: ['c1', 'c2'] })
    );

    expect(store.state.editor.draggableColumn).toEqual({
      tableId: 't1',
      columnIds: ['c1', 'c2'],
    });
    expect(store.state.editor.draggingColumnMap).toEqual({
      c1: true,
      c2: true,
    });

    store.dispatchSync(dragendColumnAction());

    expect(store.state.editor.draggableColumn).toBeNull();
    expect(store.state.editor.draggingColumnMap).toEqual({});
  });
});

describe('editor.sharedMouseTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const track = (
    x: number,
    y: number,
    { tags, meta }: { tags?: number; meta?: Record<string, any> } = {}
  ) =>
    store.dispatchSync({
      ...sharedMouseTrackerAction({ x, y }),
      tags,
      meta,
    });

  it('ignores actions without tags', () => {
    track(1, 2, { meta: { editorId: 'remote' } });
    expect(store.state.editor.sharedMouseTrackerMap).toEqual({});
  });

  it('ignores actions that are not tagged as shared', () => {
    track(1, 2, {
      tags: Tag.changeOnly,
      meta: { editorId: 'remote' },
    });
    expect(store.state.editor.sharedMouseTrackerMap).toEqual({});
  });

  it('ignores actions without a string editorId', () => {
    track(1, 2, { tags: Tag.shared, meta: { editorId: 42 } });
    track(1, 2, { tags: Tag.shared });
    expect(store.state.editor.sharedMouseTrackerMap).toEqual({});
  });

  it('ignores its own editor id', () => {
    track(1, 2, {
      tags: Tag.shared,
      meta: { editorId: store.state.editor.id },
    });
    expect(store.state.editor.sharedMouseTrackerMap).toEqual({});
  });

  it('creates a tracker with the fallback nickname', () => {
    track(10, 20, { tags: Tag.shared, meta: { editorId: 'remote' } });

    const tracker = store.state.editor.sharedMouseTrackerMap.remote;
    expect(tracker.id).toBe('remote');
    expect(tracker.x).toBe(10);
    expect(tracker.y).toBe(20);
    expect(tracker.nickname).toBe('user');
  });

  it('falls back to "user" for a blank nickname', () => {
    track(1, 1, {
      tags: Tag.shared,
      meta: { editorId: 'remote', nickname: '   ' },
    });

    expect(store.state.editor.sharedMouseTrackerMap.remote.nickname).toBe(
      'user'
    );
  });

  it('trims a provided nickname', () => {
    track(1, 1, {
      tags: Tag.shared,
      meta: { editorId: 'remote', nickname: '  kim  ' },
    });

    expect(store.state.editor.sharedMouseTrackerMap.remote.nickname).toBe(
      'kim'
    );
  });

  it('updates an existing tracker in place', () => {
    track(1, 1, {
      tags: Tag.shared,
      meta: { editorId: 'remote', nickname: 'a' },
    });
    track(5, 6, {
      tags: Tag.shared,
      meta: { editorId: 'remote', nickname: 'b' },
    });

    expect(Object.keys(store.state.editor.sharedMouseTrackerMap)).toEqual([
      'remote',
    ]);
    const tracker = store.state.editor.sharedMouseTrackerMap.remote;
    expect(tracker.x).toBe(5);
    expect(tracker.y).toBe(6);
    expect(tracker.nickname).toBe('b');
  });

  it('drops the tracker after 30s of silence', () => {
    track(1, 1, { tags: Tag.shared, meta: { editorId: 'remote' } });

    vi.advanceTimersByTime(29_999);
    expect(store.state.editor.sharedMouseTrackerMap.remote).toBeDefined();

    vi.advanceTimersByTime(2);
    expect(store.state.editor.sharedMouseTrackerMap.remote).toBeUndefined();
  });

  it('restarts the expiry timer on every update', () => {
    track(1, 1, { tags: Tag.shared, meta: { editorId: 'remote' } });
    vi.advanceTimersByTime(20_000);

    track(2, 2, { tags: Tag.shared, meta: { editorId: 'remote' } });
    vi.advanceTimersByTime(20_000);
    expect(store.state.editor.sharedMouseTrackerMap.remote).toBeDefined();

    vi.advanceTimersByTime(11_000);
    expect(store.state.editor.sharedMouseTrackerMap.remote).toBeUndefined();
  });
});

describe('editor.validationIds', () => {
  it('drops doc ids that have no matching entity', () => {
    addTable(store, 't1');
    store.state.doc.tableIds.push('ghost-table');

    const relationship = createRelationship({ id: 'r1' });
    store.state.collections.relationshipEntities.r1 = relationship;
    store.state.doc.relationshipIds.push('r1', 'ghost-relationship');

    const index = createIndex({ id: 'i1', tableId: 't1' });
    store.state.collections.indexEntities.i1 = index;
    store.state.doc.indexIds.push('i1', 'ghost-index');

    addMemo(store, 'm1');
    store.state.doc.memoIds.push('ghost-memo');

    store.dispatchSync(validationIdsAction());

    expect(store.state.doc.tableIds).toEqual(['t1']);
    expect(store.state.doc.relationshipIds).toEqual(['r1']);
    expect(store.state.doc.indexIds).toEqual(['i1']);
    expect(store.state.doc.memoIds).toEqual(['m1']);
  });

  it('drops dangling column ids from tables', () => {
    const table = addTable(store, 't1', ['c1', 'ghost-column']);
    table.seqColumnIds.push('c1', 'ghost-column');
    addColumn(store, 't1', 'c1');

    store.dispatchSync(validationIdsAction());

    expect(store.state.collections.tableEntities.t1.columnIds).toEqual(['c1']);
    expect(store.state.collections.tableEntities.t1.seqColumnIds).toEqual([
      'c1',
    ]);
  });

  it('drops dangling index column ids from indexes', () => {
    addTable(store, 't1');
    const index = createIndex({
      id: 'i1',
      tableId: 't1',
      indexColumnIds: ['ic1', 'ghost-index-column'],
      seqIndexColumnIds: ['ic1', 'ghost-index-column'],
    });
    store.state.collections.indexEntities.i1 = index;
    store.state.doc.indexIds.push('i1');
    store.state.collections.indexColumnEntities.ic1 = createIndexColumn({
      id: 'ic1',
      indexId: 'i1',
    });

    store.dispatchSync(validationIdsAction());

    expect(store.state.collections.indexEntities.i1.indexColumnIds).toEqual([
      'ic1',
    ]);
    expect(store.state.collections.indexEntities.i1.seqIndexColumnIds).toEqual([
      'ic1',
    ]);
  });

  it('leaves a consistent document untouched', () => {
    seedTableWithColumns(store);
    const before = JSON.parse(JSON.stringify(store.state.doc));

    store.dispatchSync(validationIdsAction());

    expect(JSON.parse(JSON.stringify(store.state.doc))).toEqual(before);
    expect(store.state.collections.tableEntities.t1.columnIds).toEqual([
      'c1',
      'c2',
      'c3',
    ]);
  });
});

describe('editor.getLWW', () => {
  it('is a no-op reducer', () => {
    seedTableWithColumns(store);
    store.state.lww.t1 = ['tableEntities', 1, -1, {}];
    const before = JSON.parse(
      JSON.stringify({
        doc: store.state.doc,
        collections: store.state.collections,
        lww: store.state.lww,
      })
    );

    store.dispatchSync(getLWWAction());

    expect(
      JSON.parse(
        JSON.stringify({
          doc: store.state.doc,
          collections: store.state.collections,
          lww: store.state.lww,
        })
      )
    ).toEqual(before);
  });
});

describe('editor.mergeLWW', () => {
  it('copies unknown remote entries into the local register', () => {
    const remote: LWW = {
      a: ['tableEntities', 5, -1, { name: 3, comment: 4 }],
    };

    store.dispatchSync(mergeLWWAction({ lww: remote }));

    expect(store.state.lww.a).toEqual([
      'tableEntities',
      5,
      -1,
      { name: 3, comment: 4 },
    ]);
  });

  it('keeps the newer local versions', () => {
    store.state.lww.b = ['tableEntities', 10, 2, { name: 8 }];

    store.dispatchSync(
      mergeLWWAction({ lww: { b: ['tableEntities', 5, 1, { name: 3 }] } })
    );

    expect(store.state.lww.b).toEqual(['tableEntities', 10, 2, { name: 8 }]);
  });

  it('adopts the newer remote versions', () => {
    store.state.lww.c = ['tableEntities', 1, -1, { name: 1 }];

    store.dispatchSync(
      mergeLWWAction({
        lww: { c: ['tableEntities', 7, 9, { name: 4, comment: 2 }] },
      })
    );

    expect(store.state.lww.c).toEqual([
      'tableEntities',
      7,
      9,
      { name: 4, comment: 2 },
    ]);
  });

  it('keeps the local tag when the id already exists', () => {
    store.state.lww.d = ['memoEntities', 1, -1, {}];

    store.dispatchSync(
      mergeLWWAction({ lww: { d: ['tableEntities', 2, -1, {}] } })
    );

    expect(store.state.lww.d[0]).toBe('memoEntities');
    expect(store.state.lww.d[1]).toBe(2);
  });

  it('handles an empty remote register', () => {
    store.dispatchSync(mergeLWWAction({ lww: {} }));
    expect(store.state.lww).toEqual({});
  });
});

describe('editor reducers with a non-observable store', () => {
  it('behaves the same without the observable proxy', () => {
    const plain = createTestStore(false);
    plain.state.collections.tableEntities.t1 = createTable({ id: 't1' });
    plain.state.doc.tableIds.push('t1');

    plain.dispatchSync(selectAllAction());
    plain.dispatchSync(
      focusTableAction({ tableId: 't1', focusType: FocusType.tableName })
    );

    expect(plain.state.editor.selectedMap).toEqual({ t1: SelectType.table });
    expect(plain.state.editor.focusTable?.tableId).toBe('t1');

    plain.destroy();
  });
});

describe('editor settings driven focus movement', () => {
  it('skips the table comment focus type when it is hidden', () => {
    seedTableWithColumns(store);
    store.state.settings.show = store.state.settings.show & ~Show.tableComment;
    store.dispatchSync(focusTableAction({ tableId: 't1' }));

    store.dispatchSync(
      focusMoveTableAction({ moveKey: MoveKey.ArrowRight, shiftKey: false })
    );

    expect(store.state.editor.focusTable?.focusType).toBe(FocusType.columnName);
    expect(store.state.editor.focusTable?.columnId).toBe('c1');
  });
});
