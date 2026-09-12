import { query } from '@dineug/erd-editor-schema';
import { observable } from '@dineug/r-html';

import { ColumnUIKey } from '@/constants/schema';
import {
  type SceneView,
  ShowMode,
  ViewKind,
} from '@/engine/modules/editor/state';
import { getSourceView } from '@/engine/modules/editor/view';
import { RootState } from '@/engine/state';
import { Point, Relationship, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

/**
 * The ids a scene drawn from one source shows, each list in document order.
 * To be read, never changed in place: for the document these are the
 * document's own arrays, and with no view open the one shared empty set.
 */
export type VisibleIds = {
  tableIds: string[];
  memoIds: string[];
  relationshipIds: string[];
};

/** The tables a view lights and the relationships between them and what lit them. */
export type HighlightIds = {
  tableIds: Set<string>;
  relationshipIds: Set<string>;
};

const NONE: VisibleIds = Object.freeze({
  tableIds: [],
  memoIds: [],
  relationshipIds: [],
});

/**
 * What a box, a connector, a dot or a name fades to while it sits outside
 * the lit neighbourhood of a hovered table, so that neighbourhood reads on its
 * own. One value for the graph and the Flow scene, which fade the same way.
 */
export const DIM_OPACITY = 0.2;

/**
 * Where a table stands in the source given: its own placement in the
 * document, or the point the view of that kind placed it at. A view that has
 * not placed it yet shows it where the document has it, until a layout lands.
 */
export function getTablePoint(
  state: RootState,
  table: Table,
  source: GeometrySource = 'document'
): Point {
  const placed = getSourceView(state, source)?.positions[table.id];
  const { x, y } = placed ?? table.ui;

  return { x, y };
}

const isKeyColumn = (keys: number) =>
  bHas(keys, ColumnUIKey.primaryKey) || bHas(keys, ColumnUIKey.foreignKey);

/** The columns any relationship holds an end of on this table, whether or not they are flagged. */
function relationshipColumnIds(state: RootState, table: Table): Set<string> {
  const ids = new Set<string>();
  const relationships = query(state.collections)
    .collection('relationshipEntities')
    .selectByIds(state.doc.relationshipIds);

  for (const { start, end } of relationships) {
    if (start.tableId === table.id) start.columnIds.forEach(id => ids.add(id));
    if (end.tableId === table.id) end.columnIds.forEach(id => ids.add(id));
  }

  return ids;
}

/**
 * The rows a table shows in the source given, in column order: every row in
 * the document, and in a view what its show mode says, none, all, or the key
 * rows, a key row carrying a primary or foreign key flag or ending any relationship.
 */
export function getVisibleColumnIds(
  state: RootState,
  table: Table,
  source: GeometrySource = 'document'
): string[] {
  const view = getSourceView(state, source);
  if (!view || view.showMode === ShowMode.allFields) return table.columnIds;
  if (view.showMode === ShowMode.nameOnly) return [];

  const related = relationshipColumnIds(state, table);
  const columns = query(state.collections)
    .collection('tableColumnEntities')
    .selectByIds(table.columnIds);

  return columns
    .filter(column => isKeyColumn(column.ui.keys) || related.has(column.id))
    .map(column => column.id);
}

/** The tables within the given number of relationships of the centers, centers included. */
function reach(
  centerIds: string[],
  hop: number,
  relationships: Relationship[]
): Set<string> {
  const reached = new Set(centerIds);
  let frontier = reached;

  for (let step = 0; step < hop && frontier.size; step++) {
    const next = new Set<string>();

    for (const { start, end } of relationships) {
      if (frontier.has(start.tableId)) next.add(end.tableId);
      if (frontier.has(end.tableId)) next.add(start.tableId);
    }

    frontier = new Set([...next].filter(id => !reached.has(id)));
    frontier.forEach(id => reached.add(id));
  }

  return reached;
}

/**
 * What a scene drawn from the source given shows: the whole document, or in a
 * view its centers and their neighbours out to its hop for Focus and what the
 * layout placed for Flow, with only the relationships joining two shown tables and no memo.
 */
export function getVisibleIds(
  state: RootState,
  source: GeometrySource = 'document'
): VisibleIds {
  const { doc, collections } = state;

  if (source === 'document') {
    return {
      tableIds: doc.tableIds,
      memoIds: doc.memoIds,
      relationshipIds: doc.relationshipIds,
    };
  }

  const view = getSourceView(state, source);
  if (!view) return NONE;

  const relationships = query(collections)
    .collection('relationshipEntities')
    .selectByIds(doc.relationshipIds);
  // Object.keys registers no trigger on the positions object, since the
  // observable proxy has no ownKeys trap. The layout reducer replaces the
  // object whole, which is what keeps a Flow scene redrawing; a per-key write would not.
  const shown =
    view.kind === ViewKind.focus
      ? reach(view.centerIds, view.hop, relationships)
      : new Set(Object.keys(view.positions));
  const tableIds = doc.tableIds.filter(id => shown.has(id));
  const inView = new Set(tableIds);

  return {
    tableIds,
    memoIds: [],
    relationshipIds: relationships
      .filter(
        ({ start, end }) => inView.has(start.tableId) && inView.has(end.tableId)
      )
      .map(relationship => relationship.id),
  };
}

/**
 * The table the pointer rests on in each editor's view, by the id its editor
 * state mints once. Local to the scene, like a held drag: no action carries
 * it, so a view hover never reaches the document, the history or a peer.
 */
const hover = observable({ tableId: {} as Record<string, string> });

/**
 * The view each hover was taken in, beside the observable rather than inside
 * it: the proxy would wrap the view on the way out, and the identity below
 * compares it to the slot the reader's source names.
 */
const hoverView = new Map<string, SceneView>();

/**
 * Takes the hover for the view of the source given, or drops it on null. A
 * null from a scene of another kind leaves the hover alone: a leave on the Flow
 * scene under a Focus overlay is not the Focus table leaving the pointer.
 */
export function setViewHoverTable(
  root: RootState,
  tableId: string | null,
  source: GeometrySource = 'document'
): void {
  const view = getSourceView(root, source);
  const { id } = root.editor;

  if (tableId === null || !view) {
    if (hoverView.get(id)?.kind === source) {
      hoverView.delete(id);
      Reflect.deleteProperty(hover.tableId, id);
    }
    return;
  }

  hoverView.set(id, view);
  hover.tableId[id] = tableId;
}

/**
 * Drops the hover one table holds as it leaves the scene of the source given.
 * A node culled or unmounted under the pointer sends no mouseleave, and the
 * entry left behind would light that table until the next hover and hold its view meanwhile.
 */
export function clearViewHoverTable(
  root: RootState,
  tableId: string,
  source: GeometrySource = 'document'
): void {
  const { id } = root.editor;
  // The kind rather than the slot: the view a closing scene took the hover
  // in has left its slot by the time the scene's tables unmount.
  if (hover.tableId[id] !== tableId || hoverView.get(id)?.kind !== source) {
    return;
  }

  hoverView.delete(id);
  Reflect.deleteProperty(hover.tableId, id);
}

export function getViewHoverTable(
  root: RootState,
  source: GeometrySource = 'document'
): string | null {
  const { id } = root.editor;
  const held = hover.tableId[id];

  return held !== undefined && hoverView.get(id) === getSourceView(root, source)
    ? held
    : null;
}

/**
 * What the view of the source given lights: its centers, the table hovered,
 * and for each of those every shown relationship at it and the table at the
 * other end. A hover on a table the view does not show lights nothing, since it is stale.
 */
export function getHighlightIds(
  state: RootState,
  source: GeometrySource = 'document'
): HighlightIds {
  const tableIds = new Set<string>();
  const relationshipIds = new Set<string>();
  const view = getSourceView(state, source);
  if (!view) return { tableIds, relationshipIds };

  const shown = getVisibleIds(state, source);
  const shownTables = new Set(shown.tableIds);
  const hovered = getViewHoverTable(state, source);
  const lit = new Set(view.centerIds.filter(id => shownTables.has(id)));
  if (hovered !== null && shownTables.has(hovered)) lit.add(hovered);

  lit.forEach(id => tableIds.add(id));

  const relationships = query(state.collections)
    .collection('relationshipEntities')
    .selectByIds(shown.relationshipIds);

  for (const { id, start, end } of relationships) {
    if (!lit.has(start.tableId) && !lit.has(end.tableId)) continue;

    relationshipIds.add(id);
    tableIds.add(start.tableId);
    tableIds.add(end.tableId);
  }

  return { tableIds, relationshipIds };
}

/**
 * What a Flow scene fades while a table is hovered: every table it shows and
 * every connector between them outside what the hover lights. Null while no
 * shown table is hovered, and for any other scene, since only Flow reads as a whole graph.
 */
export function getFadedIds(
  state: RootState,
  source: GeometrySource = 'document'
): HighlightIds | null {
  const view = getSourceView(state, source);
  if (!view || view.kind !== ViewKind.flow) return null;

  const hovered = getViewHoverTable(state, source);
  if (hovered === null) return null;

  const shown = getVisibleIds(state, source);
  if (!shown.tableIds.includes(hovered)) return null;

  const lit = getHighlightIds(state, source);

  return {
    tableIds: new Set(shown.tableIds.filter(id => !lit.tableIds.has(id))),
    relationshipIds: new Set(
      shown.relationshipIds.filter(id => !lit.relationshipIds.has(id))
    ),
  };
}
