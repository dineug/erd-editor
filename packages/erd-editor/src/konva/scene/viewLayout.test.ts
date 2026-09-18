import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { CanvasType, ColumnUIKey } from '@/constants/schema';
import {
  createEditor,
  ShowMode,
  ViewKind,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import { createSceneView, getActiveView } from '@/engine/modules/editor/view';
import { RootState } from '@/engine/state';
import { Table } from '@/internal-types';
import {
  clearViewHoverTable,
  clearViewPinnedTable,
  getHighlightIds,
  getReachedTableIds,
  getTablePoint,
  getViewHoverTable,
  getViewPinnedTable,
  getVisibleColumnIds,
  getVisibleIds,
  setViewHoverTable,
  setViewPinnedTable,
} from '@/konva/scene/viewLayout';
import { createMemo } from '@/utils/collection/memo.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';

type ColumnSeed = { id: string; keys?: number };

function createState(): RootState {
  return {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
}

function addTable(
  state: RootState,
  id: string,
  columns: ColumnSeed[] = [],
  x = 0,
  y = 0
): Table {
  const table = createTable({
    id,
    name: id,
    columnIds: columns.map(column => column.id),
    ui: { x, y },
  });
  state.collections.tableEntities[id] = table;
  state.doc.tableIds.push(id);

  for (const { id: columnId, keys = 0 } of columns) {
    state.collections.tableColumnEntities[columnId] = createColumn({
      id: columnId,
      tableId: id,
      name: columnId,
      ui: { keys },
    });
  }

  return table;
}

function addRelationship(
  state: RootState,
  id: string,
  [startTable, startColumns]: [string, string[]],
  [endTable, endColumns]: [string, string[]]
) {
  state.collections.relationshipEntities[id] = createRelationship({
    id,
    start: { tableId: startTable, columnIds: startColumns },
    end: { tableId: endTable, columnIds: endColumns },
  });
  state.doc.relationshipIds.push(id);
}

function addMemo(state: RootState, id: string) {
  state.collections.memoEntities[id] = createMemo({ id });
  state.doc.memoIds.push(id);
}

/**
 * A chain a - b - c - d with e off on its own and a memo beside them. Each
 * table has a primary key; the b to c link ends on a column c does not flag,
 * and c carries one plain column, so the key-row rule has every case to answer.
 */
function seedGraph(state: RootState) {
  addTable(state, 'a', [
    { id: 'a.id', keys: ColumnUIKey.primaryKey },
    { id: 'a.name' },
  ]);
  addTable(state, 'b', [
    { id: 'b.id', keys: ColumnUIKey.primaryKey },
    { id: 'b.a_id', keys: ColumnUIKey.foreignKey },
    { id: 'b.note' },
  ]);
  addTable(state, 'c', [
    { id: 'c.id', keys: ColumnUIKey.primaryKey },
    { id: 'c.b_ref' },
    { id: 'c.plain' },
  ]);
  addTable(state, 'd', [
    { id: 'd.id', keys: ColumnUIKey.primaryKey },
    { id: 'd.c_id', keys: ColumnUIKey.foreignKey },
  ]);
  addTable(state, 'e', [{ id: 'e.only' }]);
  addMemo(state, 'm');
  addRelationship(state, 'ab', ['a', ['a.id']], ['b', ['b.a_id']]);
  addRelationship(state, 'bc', ['b', ['b.id']], ['c', ['c.b_ref']]);
  addRelationship(state, 'cd', ['c', ['c.id']], ['d', ['d.c_id']]);
}

/**
 * A view standing on the centers given once their layout has landed: every
 * table they reach placed along one row, which is how a view comes to show anything.
 */
function openFocused(state: RootState, centerIds: string[]) {
  const view = createSceneView(ViewKind.flow, centerIds);
  view.positions = Object.fromEntries(
    getReachedTableIds(state, centerIds).map((id, index) => [
      id,
      { x: index * 100, y: 0 },
    ])
  );
  state.editor.views.flow = view;
  return view;
}

function openFlow(state: RootState, placedIds: string[]) {
  const view = createSceneView(ViewKind.flow);
  view.positions = Object.fromEntries(
    placedIds.map((id, index) => [id, { x: index * 100, y: 0 }])
  );
  state.editor.views.flow = view;
  state.settings.canvasType = CanvasType.visualization;
  state.editor.visualizationMode = VisualizationMode.flow;
  return view;
}

describe('getTablePoint', () => {
  it('is the table placement in the document, whatever a view has', () => {
    const state = createState();
    const table = addTable(state, 't', [], 120, 340);
    openFocused(state, ['t']).positions.t = { x: 9, y: 9 };

    expect(getTablePoint(state, table)).toEqual({ x: 120, y: 340 });
    expect(getTablePoint(state, table, 'document')).toEqual({
      x: 120,
      y: 340,
    });
  });

  it('is the point the active view placed the table at', () => {
    const state = createState();
    const table = addTable(state, 't', [], 120, 340);
    openFocused(state, ['t']).positions.t = { x: -50, y: 75 };

    expect(getTablePoint(state, table, 'flow')).toEqual({ x: -50, y: 75 });
    expect(table.ui.x).toBe(120);
  });

  it('falls back to the document placement until the view places the table', () => {
    const state = createState();
    const table = addTable(state, 't', [], 120, 340);

    expect(getTablePoint(state, table, 'flow')).toEqual({ x: 120, y: 340 });

    state.editor.views.flow = createSceneView(ViewKind.flow, ['t']);
    expect(getTablePoint(state, table, 'flow')).toEqual({ x: 120, y: 340 });
  });
});

describe('getVisibleColumnIds', () => {
  it('is every row in the document, whatever the view shows', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['b']).showMode = ShowMode.nameOnly;
    const table = state.collections.tableEntities.b;

    expect(getVisibleColumnIds(state, table)).toBe(table.columnIds);
    expect(getVisibleColumnIds(state, table, 'document')).toEqual([
      'b.id',
      'b.a_id',
      'b.note',
    ]);
  });

  it('is no row at all in a name only view', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['b']).showMode = ShowMode.nameOnly;

    expect(
      getVisibleColumnIds(state, state.collections.tableEntities.b, 'flow')
    ).toEqual([]);
  });

  it('is every row in an all fields view', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['b']).showMode = ShowMode.allFields;

    expect(
      getVisibleColumnIds(state, state.collections.tableEntities.b, 'flow')
    ).toEqual(['b.id', 'b.a_id', 'b.note']);
  });

  /**
   * AC-2. The primary key row, the foreign key row and the row a relationship
   * ends on without a flag stay, in column order; the plain row goes.
   */
  it('keeps the flagged rows and the relationship ends in a keys only view', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['c']);
    const { b, c } = state.collections.tableEntities;

    expect(getVisibleColumnIds(state, b, 'flow')).toEqual(['b.id', 'b.a_id']);
    expect(getVisibleColumnIds(state, c, 'flow')).toEqual(['c.id', 'c.b_ref']);
  });

  it('keeps a relationship end that starts on the table as well as one that ends there', () => {
    const state = createState();
    addTable(state, 's', [{ id: 's.left' }, { id: 's.other' }]);
    addTable(state, 't', [{ id: 't.right' }]);
    addRelationship(state, 'st', ['s', ['s.left']], ['t', ['t.right']]);
    openFocused(state, ['s']);

    expect(
      getVisibleColumnIds(state, state.collections.tableEntities.s, 'flow')
    ).toEqual(['s.left']);
    expect(
      getVisibleColumnIds(state, state.collections.tableEntities.t, 'flow')
    ).toEqual(['t.right']);
  });

  /** AC-3. A table with no key row and no relationship shows its header alone. */
  it('is no row for a table with no key in a keys only view', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['e']);

    expect(
      getVisibleColumnIds(state, state.collections.tableEntities.e, 'flow')
    ).toEqual([]);
  });

  it('shows every row for a view scene while no view is open', () => {
    const state = createState();
    seedGraph(state);

    expect(
      getVisibleColumnIds(state, state.collections.tableEntities.c, 'flow')
    ).toEqual(['c.id', 'c.b_ref', 'c.plain']);
  });
});

describe('getVisibleIds', () => {
  it('is the document itself for the document, by the very lists it keeps', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);

    const ids = getVisibleIds(state);

    expect(ids.tableIds).toBe(state.doc.tableIds);
    expect(ids.memoIds).toBe(state.doc.memoIds);
    expect(ids.relationshipIds).toBe(state.doc.relationshipIds);
    expect(getVisibleIds(state, 'document')).toEqual(ids);
  });

  it('is nothing for a view scene while no view is open', () => {
    const state = createState();
    seedGraph(state);

    expect(getVisibleIds(state, 'flow')).toEqual({
      tableIds: [],
      memoIds: [],
      relationshipIds: [],
    });
  });

  /** AC-22 and AC-64. One center, its neighbours, the relationships between them, no memo. */
  it('shows a center with its neighbours one hop out, and no memo', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['b']);

    expect(getVisibleIds(state, 'flow')).toEqual({
      tableIds: ['a', 'b', 'c'],
      memoIds: [],
      relationshipIds: ['ab', 'bc'],
    });
  });

  /** AC-51. The reach is one hop and no more: c is two out from a and stays out. */
  it('reaches one hop out and no further', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);

    expect(getVisibleIds(state, 'flow').tableIds).toEqual(['a', 'b']);
    expect(getVisibleIds(state, 'flow').relationshipIds).toEqual(['ab']);
  });

  /** AC-24. */
  it('is the union of every center and its neighbours', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a', 'd']);

    expect(getVisibleIds(state, 'flow').tableIds).toEqual(['a', 'b', 'c', 'd']);
    expect(getVisibleIds(state, 'flow').relationshipIds).toEqual([
      'ab',
      'bc',
      'cd',
    ]);
  });

  it('leaves out a relationship whose other end the view does not show', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);

    expect(getVisibleIds(state, 'flow')).toEqual({
      tableIds: ['a', 'b'],
      memoIds: [],
      relationshipIds: ['ab'],
    });
  });

  it('shows an isolated center on its own', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['e']);

    expect(getVisibleIds(state, 'flow')).toEqual({
      tableIds: ['e'],
      memoIds: [],
      relationshipIds: [],
    });
  });

  /** AC-13. The set is read afresh, so a neighbour removed from the document is gone at once. */
  it('drops a neighbour and a center the document no longer holds', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['b', 'gone']);

    state.doc.tableIds = state.doc.tableIds.filter(id => id !== 'c');
    state.doc.relationshipIds = state.doc.relationshipIds.filter(
      id => id !== 'bc'
    );

    expect(getVisibleIds(state, 'flow')).toEqual({
      tableIds: ['a', 'b'],
      memoIds: [],
      relationshipIds: ['ab'],
    });
  });

  /** AC-17 and AC-64. A Flow view shows what its layout placed and nothing added since. */
  it('shows what a Flow layout placed, in document order, and no memo', () => {
    const state = createState();
    seedGraph(state);
    openFlow(state, ['d', 'a', 'b']);
    addTable(state, 'late');

    expect(getVisibleIds(state, 'flow')).toEqual({
      tableIds: ['a', 'b', 'd'],
      memoIds: [],
      relationshipIds: ['ab'],
    });
  });

  /** The display set turns on the centers a view stands on, never on the kind of the slot it stands in. */
  it('shows a Flow view standing on no centers what its layout placed', () => {
    const state = createState();
    seedGraph(state);
    const view = openFlow(state, ['a', 'b', 'c']);

    expect(view.centerIds).toEqual([]);
    expect(getVisibleIds(state, 'flow')).toEqual({
      tableIds: ['a', 'b', 'c'],
      memoIds: [],
      relationshipIds: ['ab', 'bc'],
    });
  });

  /** A first entry narrowed from the ERD draws nothing until ELK answers, as the whole document's does. */
  it('shows nothing of a view opened on centers until a layout lands', () => {
    const state = createState();
    seedGraph(state);
    state.editor.views.flow = createSceneView(ViewKind.flow, ['b']);

    expect(getVisibleIds(state, 'flow')).toEqual({
      tableIds: [],
      memoIds: [],
      relationshipIds: [],
    });
  });

  it('shows a Flow view moved onto other centers the landing it had, until theirs lands', () => {
    const state = createState();
    seedGraph(state);
    const view = openFlow(state, ['a', 'b', 'c']);
    view.centerIds = ['d'];

    expect(getVisibleIds(state, 'flow')).toEqual({
      tableIds: ['a', 'b', 'c'],
      memoIds: [],
      relationshipIds: ['ab', 'bc'],
    });
  });

  /** The tab decides which view is active, never what a Flow scene shows: the scene names its view. */
  it('shows the Flow view whichever tab is up, while the tab alone decides the active view', () => {
    const state = createState();
    seedGraph(state);
    openFlow(state, ['a']);

    state.editor.visualizationMode = VisualizationMode.graph;
    expect(getVisibleIds(state, 'flow').tableIds).toEqual(['a']);
    expect(getActiveView(state)).toBeNull();

    state.editor.visualizationMode = VisualizationMode.flow;
    state.settings.canvasType = CanvasType.ERD;
    expect(getVisibleIds(state, 'flow').tableIds).toEqual(['a']);
    expect(getActiveView(state)).toBeNull();
  });

  it('keeps the placement it landed while the centers narrow what it is laid out over', () => {
    const state = createState();
    seedGraph(state);
    const view = openFlow(state, ['a', 'b', 'c', 'd', 'e']);
    view.centerIds = ['d'];

    expect(getVisibleIds(state, 'flow').tableIds).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
    expect(
      getTablePoint(state, state.collections.tableEntities.d, 'flow')
    ).toEqual({ x: 300, y: 0 });
  });
});

describe('getReachedTableIds', () => {
  /** What ELK is asked to place for a narrowed view, which has to be there before anything is placed. */
  it('reaches the centers and their one hop, in document order, placed or not', () => {
    const state = createState();
    seedGraph(state);

    expect(getReachedTableIds(state, ['c'])).toEqual(['b', 'c', 'd']);
    expect(getReachedTableIds(state, ['e', 'a'])).toEqual(['a', 'b', 'e']);
  });

  it('leaves out a center the document no longer holds', () => {
    const state = createState();
    seedGraph(state);

    expect(getReachedTableIds(state, ['gone', 'a'])).toEqual(['a', 'b']);
  });
});

describe('the table a view hover rests on', () => {
  it('starts on none and holds what it is told, by editor', () => {
    const one = createState();
    const other = createState();
    seedGraph(one);
    seedGraph(other);
    openFocused(one, ['a']);
    openFocused(other, ['a']);

    expect(getViewHoverTable(one, 'flow')).toBeNull();

    setViewHoverTable(one, 'a', 'flow');
    expect(getViewHoverTable(one, 'flow')).toBe('a');
    expect(getViewHoverTable(other, 'flow')).toBeNull();

    setViewHoverTable(one, null, 'flow');
    expect(getViewHoverTable(one, 'flow')).toBeNull();
  });

  it('holds nothing while no view is open', () => {
    const state = createState();
    seedGraph(state);

    setViewHoverTable(state, 'a', 'flow');

    expect(getViewHoverTable(state, 'flow')).toBeNull();
  });

  /** AC-63. A hover belongs to the view it was taken in: a close drops it, and so does a reopen. */
  it('is dropped with the view it was taken in', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);
    setViewHoverTable(state, 'a', 'flow');

    state.editor.views.flow = null;
    expect(getViewHoverTable(state, 'flow')).toBeNull();

    openFocused(state, ['a']);
    expect(getViewHoverTable(state, 'flow')).toBeNull();
    expect(getHighlightIds(state, 'flow')).toEqual({
      tableIds: new Set(),
      relationshipIds: new Set(),
    });
  });

  it('is dropped by the table that held it as it leaves the scene', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);
    setViewHoverTable(state, 'b', 'flow');

    // A table culled out from under the pointer sends no mouseleave, and
    // another that never held the hover must not drop it on its way out.
    clearViewHoverTable(state, 'c', 'flow');
    expect(getViewHoverTable(state, 'flow')).toBe('b');

    clearViewHoverTable(state, 'b', 'flow');
    expect(getViewHoverTable(state, 'flow')).toBeNull();
  });

  it('is dropped by that table even once the view it was taken in is gone', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);
    setViewHoverTable(state, 'b', 'flow');

    state.editor.views.flow = null;
    clearViewHoverTable(state, 'b', 'flow');
    openFocused(state, ['b']);

    // Nothing of the closed session is left to take back: the entry is gone
    // rather than merely ignored, so neither map holds this editor any more.
    expect(getViewHoverTable(state, 'flow')).toBeNull();
  });

  it('is dropped when the view closes, and was never the document scene hover', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);
    setViewHoverTable(state, 'a', 'flow');
    expect(getViewHoverTable(state, 'document')).toBeNull();

    state.editor.views.flow = null;

    expect(getViewHoverTable(state, 'flow')).toBeNull();
    expect(getHighlightIds(state, 'flow').tableIds).toEqual(new Set());
  });

  it('is dropped only by a table of the scene it was taken in', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);
    setViewHoverTable(state, 'b', 'flow');

    // The document scene unmounting its b, say on a tab switch, is not the
    // view's b leaving the pointer.
    clearViewHoverTable(state, 'b', 'document');
    expect(getViewHoverTable(state, 'flow')).toBe('b');

    clearViewHoverTable(state, 'b', 'flow');
    expect(getViewHoverTable(state, 'flow')).toBeNull();
  });

  it('is kept through a leave on the scene of the other source', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);
    setViewHoverTable(state, 'b', 'flow');

    // The pointer crossing from the document scene onto the view is a
    // mouseleave on a document table, and not the view's b leaving it.
    setViewHoverTable(state, null, 'document');
    expect(getViewHoverTable(state, 'flow')).toBe('b');
    expect(getHighlightIds(state, 'flow').tableIds).toEqual(
      new Set(['a', 'b'])
    );

    setViewHoverTable(state, 'c', 'document');
    expect(getViewHoverTable(state, 'flow')).toBe('b');

    setViewHoverTable(state, null, 'flow');
    expect(getViewHoverTable(state, 'flow')).toBeNull();
  });
});

describe('the table a view pin holds', () => {
  it('starts on none and holds what it is told, by editor', () => {
    const one = createState();
    const other = createState();
    seedGraph(one);
    seedGraph(other);
    openFocused(one, ['a']);
    openFocused(other, ['a']);

    expect(getViewPinnedTable(one, 'flow')).toBeNull();

    setViewPinnedTable(one, 'a', 'flow');
    expect(getViewPinnedTable(one, 'flow')).toBe('a');
    expect(getViewPinnedTable(other, 'flow')).toBeNull();
  });

  /** AC-43. The gesture is its own toggle: the same table twice lets it go, another takes it over. */
  it('lets the table it holds go on a second take, and moves to any other', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);

    setViewPinnedTable(state, 'a', 'flow');
    setViewPinnedTable(state, 'a', 'flow');
    expect(getViewPinnedTable(state, 'flow')).toBeNull();

    setViewPinnedTable(state, 'a', 'flow');
    setViewPinnedTable(state, 'b', 'flow');
    expect(getViewPinnedTable(state, 'flow')).toBe('b');
  });

  it('holds nothing while no view is open', () => {
    const state = createState();
    seedGraph(state);

    setViewPinnedTable(state, 'a', 'flow');

    expect(getViewPinnedTable(state, 'flow')).toBeNull();
  });

  /** AC-43. The press on the background lets it go, and only in the view that took it. */
  it('is let go whatever it holds, by the source that took it alone', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);
    setViewPinnedTable(state, 'a', 'flow');

    clearViewPinnedTable(state, 'document');
    expect(getViewPinnedTable(state, 'flow')).toBe('a');

    clearViewPinnedTable(state, 'flow');
    expect(getViewPinnedTable(state, 'flow')).toBeNull();

    // Nothing of the take is left behind, so the same table pins again rather
    // than reading the stale entry as a release.
    setViewPinnedTable(state, 'a', 'flow');
    expect(getViewPinnedTable(state, 'flow')).toBe('a');
  });

  /**
   * The whole cleanup story of the slot: a pin belongs to the view it was
   * taken in, so a close drops it and a reopen does not revive it. Nothing
   * else clears it, which is why the identity is what has to be held still.
   */
  it('is dropped with the view it was taken in, and a reopen does not revive it', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);
    setViewPinnedTable(state, 'a', 'flow');

    state.editor.views.flow = null;
    expect(getViewPinnedTable(state, 'flow')).toBeNull();

    openFocused(state, ['b']);
    expect(getViewPinnedTable(state, 'flow')).toBeNull();
    expect(getHighlightIds(state, 'flow')).toEqual({
      tableIds: new Set(),
      relationshipIds: new Set(),
    });
  });

  it('takes the same table again in the view that reopened, rather than reading the old take as a release', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);
    setViewPinnedTable(state, 'a', 'flow');

    state.editor.views.flow = null;
    openFocused(state, ['a']);
    setViewPinnedTable(state, 'a', 'flow');

    expect(getViewPinnedTable(state, 'flow')).toBe('a');
  });

  it('is never the document scene pin, whichever source asks', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);

    setViewPinnedTable(state, 'a', 'document');
    expect(getViewPinnedTable(state, 'flow')).toBeNull();

    setViewPinnedTable(state, 'a', 'flow');
    expect(getViewPinnedTable(state, 'document')).toBeNull();
    expect(getHighlightIds(state, 'document')).toEqual({
      tableIds: new Set(),
      relationshipIds: new Set(),
    });
  });

  /** AC-43 in the whole display set, where a pin is the only thing lighting anything. */
  it('lights the table it holds and its one hop with no pointer on the scene', () => {
    const state = createState();
    seedGraph(state);
    openFlow(state, ['a', 'b', 'c', 'd', 'e']);

    expect(getHighlightIds(state, 'flow').tableIds).toEqual(new Set());

    setViewPinnedTable(state, 'c', 'flow');
    expect(getHighlightIds(state, 'flow')).toEqual({
      tableIds: new Set(['b', 'c', 'd']),
      relationshipIds: new Set(['bc', 'cd']),
    });
  });

  it('lights beside a hover rather than in its place', () => {
    const state = createState();
    seedGraph(state);
    openFlow(state, ['a', 'b', 'c', 'd', 'e']);

    setViewPinnedTable(state, 'a', 'flow');
    setViewHoverTable(state, 'd', 'flow');

    expect(getHighlightIds(state, 'flow')).toEqual({
      tableIds: new Set(['a', 'b', 'c', 'd']),
      relationshipIds: new Set(['ab', 'cd']),
    });
  });

  it('lights nothing while the table it holds is one the view does not show', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);
    setViewPinnedTable(state, 'd', 'flow');

    expect(getViewPinnedTable(state, 'flow')).toBe('d');
    expect(getHighlightIds(state, 'flow')).toEqual({
      tableIds: new Set(),
      relationshipIds: new Set(),
    });
  });
});

describe('getHighlightIds', () => {
  it('lights nothing while no view is open', () => {
    const state = createState();
    seedGraph(state);
    setViewHoverTable(state, 'a', 'flow');

    expect(getHighlightIds(state, 'flow')).toEqual({
      tableIds: new Set(),
      relationshipIds: new Set(),
    });
  });

  /**
   * AC-27 and AC-42. A narrowed view seeds nothing from its centers: it rests
   * unlit the way the whole document does, and a hover on the center is what
   * lights the center, its one hop and the connector between.
   */
  it('rests unlit over a center, and lights its one hop once the center is hovered', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);

    expect(getHighlightIds(state, 'flow')).toEqual({
      tableIds: new Set(),
      relationshipIds: new Set(),
    });

    setViewHoverTable(state, 'a', 'flow');
    expect(getHighlightIds(state, 'flow')).toEqual({
      tableIds: new Set(['a', 'b']),
      relationshipIds: new Set(['ab']),
    });
  });

  /**
   * AC-42. A hover lights the hovered table and its one hop, which on a
   * neighbour of the center is the connector between two neighbours.
   */
  it('lights a neighbour to neighbour connector once one of its ends is hovered', () => {
    const state = createState();
    seedGraph(state);
    addRelationship(state, 'ac', ['a', ['a.id']], ['c', ['c.plain']]);
    openFocused(state, ['a']);

    expect(getHighlightIds(state, 'flow')).toEqual({
      tableIds: new Set(),
      relationshipIds: new Set(),
    });

    setViewHoverTable(state, 'b', 'flow');

    expect(getHighlightIds(state, 'flow')).toEqual({
      tableIds: new Set(['a', 'b', 'c']),
      relationshipIds: new Set(['ab', 'bc']),
    });
  });

  it('keeps the light inside what the view shows', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['b']);
    setViewHoverTable(state, 'c', 'flow');

    // c is shown but d, its other neighbour, is not; a hover on c lights c and b only.
    expect(getHighlightIds(state, 'flow')).toEqual({
      tableIds: new Set(['b', 'c']),
      relationshipIds: new Set(['bc']),
    });
  });

  it('ignores a hover on a table the view does not show', () => {
    const state = createState();
    seedGraph(state);
    openFocused(state, ['a']);
    setViewHoverTable(state, 'd', 'flow');

    expect(getHighlightIds(state, 'flow')).toEqual({
      tableIds: new Set(),
      relationshipIds: new Set(),
    });
  });

  /** AC-19. Whatever the display set, only a hover or a pin lights, and nothing lights without one. */
  it('lights only the hovered neighbourhood in a Flow view', () => {
    const state = createState();
    seedGraph(state);
    openFlow(state, ['a', 'b', 'c', 'd', 'e']);

    expect(getHighlightIds(state, 'flow')).toEqual({
      tableIds: new Set(),
      relationshipIds: new Set(),
    });

    setViewHoverTable(state, 'c', 'flow');
    expect(getHighlightIds(state, 'flow')).toEqual({
      tableIds: new Set(['b', 'c', 'd']),
      relationshipIds: new Set(['bc', 'cd']),
    });
  });
});
