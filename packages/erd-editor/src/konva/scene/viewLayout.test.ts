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
  getFadedIds,
  getHighlightIds,
  getTablePoint,
  getViewHoverTable,
  getVisibleColumnIds,
  getVisibleIds,
  setViewHoverTable,
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

function openFocus(state: RootState, centerIds: string[], hop = 1) {
  const view = createSceneView(ViewKind.focus, centerIds);
  view.hop = hop;
  state.editor.views.focus = view;
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
    openFocus(state, ['t']).positions.t = { x: 9, y: 9 };

    expect(getTablePoint(state, table)).toEqual({ x: 120, y: 340 });
    expect(getTablePoint(state, table, 'document')).toEqual({
      x: 120,
      y: 340,
    });
  });

  it('is the point the active view placed the table at', () => {
    const state = createState();
    const table = addTable(state, 't', [], 120, 340);
    openFocus(state, ['t']).positions.t = { x: -50, y: 75 };

    expect(getTablePoint(state, table, 'focus')).toEqual({ x: -50, y: 75 });
    expect(table.ui.x).toBe(120);
  });

  it('falls back to the document placement until the view places the table', () => {
    const state = createState();
    const table = addTable(state, 't', [], 120, 340);

    expect(getTablePoint(state, table, 'focus')).toEqual({ x: 120, y: 340 });

    openFocus(state, ['t']);
    expect(getTablePoint(state, table, 'focus')).toEqual({ x: 120, y: 340 });
  });
});

describe('getVisibleColumnIds', () => {
  it('is every row in the document, whatever the view shows', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['b']).showMode = ShowMode.nameOnly;
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
    openFocus(state, ['b']).showMode = ShowMode.nameOnly;

    expect(
      getVisibleColumnIds(state, state.collections.tableEntities.b, 'focus')
    ).toEqual([]);
  });

  it('is every row in an all fields view', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['b']).showMode = ShowMode.allFields;

    expect(
      getVisibleColumnIds(state, state.collections.tableEntities.b, 'focus')
    ).toEqual(['b.id', 'b.a_id', 'b.note']);
  });

  /**
   * AC-2. The primary key row, the foreign key row and the row a relationship
   * ends on without a flag stay, in column order; the plain row goes.
   */
  it('keeps the flagged rows and the relationship ends in a keys only view', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['c']);
    const { b, c } = state.collections.tableEntities;

    expect(getVisibleColumnIds(state, b, 'focus')).toEqual(['b.id', 'b.a_id']);
    expect(getVisibleColumnIds(state, c, 'focus')).toEqual(['c.id', 'c.b_ref']);
  });

  it('keeps a relationship end that starts on the table as well as one that ends there', () => {
    const state = createState();
    addTable(state, 's', [{ id: 's.left' }, { id: 's.other' }]);
    addTable(state, 't', [{ id: 't.right' }]);
    addRelationship(state, 'st', ['s', ['s.left']], ['t', ['t.right']]);
    openFocus(state, ['s']);

    expect(
      getVisibleColumnIds(state, state.collections.tableEntities.s, 'focus')
    ).toEqual(['s.left']);
    expect(
      getVisibleColumnIds(state, state.collections.tableEntities.t, 'focus')
    ).toEqual(['t.right']);
  });

  /** AC-3. A table with no key row and no relationship shows its header alone. */
  it('is no row for a table with no key in a keys only view', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['e']);

    expect(
      getVisibleColumnIds(state, state.collections.tableEntities.e, 'focus')
    ).toEqual([]);
  });

  it('shows every row for a view scene while no view is open', () => {
    const state = createState();
    seedGraph(state);

    expect(
      getVisibleColumnIds(state, state.collections.tableEntities.c, 'focus')
    ).toEqual(['c.id', 'c.b_ref', 'c.plain']);
  });
});

describe('getVisibleIds', () => {
  it('is the document itself for the document, by the very lists it keeps', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['a']);

    const ids = getVisibleIds(state);

    expect(ids.tableIds).toBe(state.doc.tableIds);
    expect(ids.memoIds).toBe(state.doc.memoIds);
    expect(ids.relationshipIds).toBe(state.doc.relationshipIds);
    expect(getVisibleIds(state, 'document')).toEqual(ids);
  });

  it('is nothing for a view scene while no view is open', () => {
    const state = createState();
    seedGraph(state);

    expect(getVisibleIds(state, 'focus')).toEqual({
      tableIds: [],
      memoIds: [],
      relationshipIds: [],
    });
  });

  /** AC-22 and AC-64. One center, its neighbours, the relationships between them, no memo. */
  it('shows a Focus center with its neighbours one hop out, and no memo', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['b']);

    expect(getVisibleIds(state, 'focus')).toEqual({
      tableIds: ['a', 'b', 'c'],
      memoIds: [],
      relationshipIds: ['ab', 'bc'],
    });
  });

  /** AC-23. */
  it('reaches two hops out once the view asks for them', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['a'], 2);

    expect(getVisibleIds(state, 'focus').tableIds).toEqual(['a', 'b', 'c']);
    expect(getVisibleIds(state, 'focus').relationshipIds).toEqual(['ab', 'bc']);
  });

  /** AC-24. */
  it('is the union of every center and its neighbours', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['a', 'd']);

    expect(getVisibleIds(state, 'focus').tableIds).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(getVisibleIds(state, 'focus').relationshipIds).toEqual([
      'ab',
      'bc',
      'cd',
    ]);
  });

  it('leaves out a relationship whose other end the view does not show', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['a']);

    expect(getVisibleIds(state, 'focus')).toEqual({
      tableIds: ['a', 'b'],
      memoIds: [],
      relationshipIds: ['ab'],
    });
  });

  it('shows an isolated center on its own', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['e'], 2);

    expect(getVisibleIds(state, 'focus')).toEqual({
      tableIds: ['e'],
      memoIds: [],
      relationshipIds: [],
    });
  });

  /** AC-13. The set is read afresh, so a neighbour removed from the document is gone at once. */
  it('drops a neighbour and a center the document no longer holds', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['b', 'gone']);

    state.doc.tableIds = state.doc.tableIds.filter(id => id !== 'c');
    state.doc.relationshipIds = state.doc.relationshipIds.filter(
      id => id !== 'bc'
    );

    expect(getVisibleIds(state, 'focus')).toEqual({
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

  it('shows each view its own set while a Focus view is open over a Flow view', () => {
    const state = createState();
    seedGraph(state);
    openFlow(state, ['a', 'b', 'c', 'd', 'e']);
    openFocus(state, ['d']);

    expect(getVisibleIds(state, 'focus').tableIds).toEqual(['c', 'd']);
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

describe('the table a view hover rests on', () => {
  it('starts on none and holds what it is told, by editor', () => {
    const one = createState();
    const other = createState();
    seedGraph(one);
    seedGraph(other);
    openFocus(one, ['a']);
    openFocus(other, ['a']);

    expect(getViewHoverTable(one, 'focus')).toBeNull();

    setViewHoverTable(one, 'a', 'focus');
    expect(getViewHoverTable(one, 'focus')).toBe('a');
    expect(getViewHoverTable(other, 'focus')).toBeNull();

    setViewHoverTable(one, null, 'focus');
    expect(getViewHoverTable(one, 'focus')).toBeNull();
  });

  it('holds nothing while no view is open', () => {
    const state = createState();
    seedGraph(state);

    setViewHoverTable(state, 'a', 'focus');

    expect(getViewHoverTable(state, 'focus')).toBeNull();
  });

  /** AC-63. A hover belongs to the view it was taken in: a close drops it, and so does a reopen. */
  it('is dropped with the view it was taken in', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['a']);
    setViewHoverTable(state, 'a', 'focus');

    state.editor.views.focus = null;
    expect(getViewHoverTable(state, 'focus')).toBeNull();

    openFocus(state, ['a']);
    expect(getViewHoverTable(state, 'focus')).toBeNull();
    expect(getHighlightIds(state, 'focus')).toEqual({
      tableIds: new Set(['a', 'b']),
      relationshipIds: new Set(['ab']),
    });
  });

  it('is dropped by the table that held it as it leaves the scene', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['a']);
    setViewHoverTable(state, 'b', 'focus');

    // A table culled out from under the pointer sends no mouseleave, and
    // another that never held the hover must not drop it on its way out.
    clearViewHoverTable(state, 'c', 'focus');
    expect(getViewHoverTable(state, 'focus')).toBe('b');

    clearViewHoverTable(state, 'b', 'focus');
    expect(getViewHoverTable(state, 'focus')).toBeNull();
  });

  it('is dropped by that table even once the view it was taken in is gone', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['a']);
    setViewHoverTable(state, 'b', 'focus');

    state.editor.views.focus = null;
    clearViewHoverTable(state, 'b', 'focus');
    openFocus(state, ['b']);

    // Nothing of the closed session is left to take back: the entry is gone
    // rather than merely ignored, so neither map holds this editor any more.
    expect(getViewHoverTable(state, 'focus')).toBeNull();
  });

  it('is dropped when the Focus view over a Flow view closes, and was never the Flow scene hover', () => {
    const state = createState();
    seedGraph(state);
    openFlow(state, ['a', 'b', 'c', 'd', 'e']);
    openFocus(state, ['a']);
    setViewHoverTable(state, 'a', 'focus');
    expect(getViewHoverTable(state, 'flow')).toBeNull();
    expect(getHighlightIds(state, 'flow').tableIds).toEqual(new Set());

    state.editor.views.focus = null;

    expect(getViewHoverTable(state, 'focus')).toBeNull();
    expect(getHighlightIds(state, 'focus').tableIds).toEqual(new Set());
  });

  it('is dropped only by a table of the scene it was taken in', () => {
    const state = createState();
    seedGraph(state);
    openFlow(state, ['a', 'b', 'c', 'd', 'e']);
    openFocus(state, ['a']);
    setViewHoverTable(state, 'b', 'focus');

    // The Flow scene under the overlay unmounting its b, say on a tab
    // switch, is not the Focus b leaving the pointer.
    clearViewHoverTable(state, 'b', 'flow');
    expect(getViewHoverTable(state, 'focus')).toBe('b');

    clearViewHoverTable(state, 'b', 'focus');
    expect(getViewHoverTable(state, 'focus')).toBeNull();
  });

  it('is kept through a leave on the scene of the other kind, open or not', () => {
    const state = createState();
    seedGraph(state);
    openFlow(state, ['a', 'b', 'c', 'd', 'e']);
    openFocus(state, ['a']);
    setViewHoverTable(state, 'b', 'focus');

    // The pointer crossing from the Flow scene onto the overlay is a
    // mouseleave on a Flow table, and not the Focus b leaving the pointer.
    setViewHoverTable(state, null, 'flow');
    expect(getViewHoverTable(state, 'focus')).toBe('b');
    expect(getHighlightIds(state, 'focus').tableIds).toEqual(
      new Set(['a', 'b'])
    );

    state.editor.views.flow = null;
    setViewHoverTable(state, null, 'flow');
    setViewHoverTable(state, 'c', 'flow');
    expect(getViewHoverTable(state, 'focus')).toBe('b');

    setViewHoverTable(state, null, 'focus');
    expect(getViewHoverTable(state, 'focus')).toBeNull();
  });
});

describe('getHighlightIds', () => {
  it('lights nothing while no view is open', () => {
    const state = createState();
    seedGraph(state);
    setViewHoverTable(state, 'a', 'focus');

    expect(getHighlightIds(state, 'focus')).toEqual({
      tableIds: new Set(),
      relationshipIds: new Set(),
    });
  });

  /** AC-27 and AC-45. The centers and their one hop light; a table two hops out does not. */
  it('lights the centers, their one hop and the relationships between, and not the second hop', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['a'], 2);

    expect(getHighlightIds(state, 'focus')).toEqual({
      tableIds: new Set(['a', 'b']),
      relationshipIds: new Set(['ab']),
    });
  });

  /** AC-45. A hover lights the hovered table and its one hop as well. */
  it('lights the hovered table and its one hop beside the centers', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['a'], 2);
    setViewHoverTable(state, 'c', 'focus');

    expect(getHighlightIds(state, 'focus')).toEqual({
      tableIds: new Set(['a', 'b', 'c']),
      relationshipIds: new Set(['ab', 'bc']),
    });
  });

  it('keeps the light inside what the view shows', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['b']);
    setViewHoverTable(state, 'c', 'focus');

    // c is shown but d, its other neighbour, is not; a hover on c lights c and b only.
    expect(getHighlightIds(state, 'focus')).toEqual({
      tableIds: new Set(['a', 'b', 'c']),
      relationshipIds: new Set(['ab', 'bc']),
    });
  });

  it('ignores a hover on a table the view does not show', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['a']);
    setViewHoverTable(state, 'd', 'focus');

    expect(getHighlightIds(state, 'focus')).toEqual({
      tableIds: new Set(['a', 'b']),
      relationshipIds: new Set(['ab']),
    });
  });

  /** AC-19. A Flow view has no center: only a hover lights, and nothing lights without one. */
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

// AC-19: what a Flow hover fades is everything shown that the hover does not
// light, and no other scene fades at all, whatever its hover holds.
describe('getFadedIds', () => {
  it('fades what the hover leaves unlit in a Flow view, tables and connectors both', () => {
    const state = createState();
    seedGraph(state);
    openFlow(state, ['a', 'b', 'c', 'd', 'e']);
    setViewHoverTable(state, 'c', 'flow');

    expect(getFadedIds(state, 'flow')).toEqual({
      tableIds: new Set(['a', 'e']),
      relationshipIds: new Set(['ab']),
    });
  });

  it('fades nothing while no table is hovered', () => {
    const state = createState();
    seedGraph(state);
    openFlow(state, ['a', 'b', 'c', 'd', 'e']);

    expect(getFadedIds(state, 'flow')).toBeNull();
  });

  it('fades nothing for a hover on a table the view does not show', () => {
    const state = createState();
    seedGraph(state);
    openFlow(state, ['a', 'b', 'c', 'd']);
    setViewHoverTable(state, 'e', 'flow');

    expect(getFadedIds(state, 'flow')).toBeNull();
  });

  it('fades nothing in the document scene, whatever a Flow hover holds', () => {
    const state = createState();
    seedGraph(state);
    openFlow(state, ['a', 'b', 'c', 'd', 'e']);
    setViewHoverTable(state, 'c', 'flow');

    expect(getFadedIds(state, 'document')).toBeNull();
    expect(getFadedIds(state)).toBeNull();
  });

  it('fades nothing in a Focus view, which lights its centers instead', () => {
    const state = createState();
    seedGraph(state);
    openFocus(state, ['b']);
    setViewHoverTable(state, 'c', 'focus');

    expect(getFadedIds(state, 'focus')).toBeNull();
  });

  it('keeps a Focus hover over a Flow view out of the Flow scene', () => {
    const state = createState();
    seedGraph(state);
    openFlow(state, ['a', 'b', 'c', 'd', 'e']);
    openFocus(state, ['b']);
    setViewHoverTable(state, 'c', 'focus');

    expect(getFadedIds(state, 'flow')).toBeNull();
  });
});
