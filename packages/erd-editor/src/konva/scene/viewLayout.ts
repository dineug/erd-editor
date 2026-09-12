import { query } from '@dineug/erd-editor-schema';
import { observable } from '@dineug/r-html';

import { ColumnUIKey } from '@/constants/schema';
import { type SceneView, ShowMode } from '@/engine/modules/editor/state';
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

/** Every end every relationship of the document holds, table by table. */
function forEachRelationshipEnd(
  state: RootState,
  visit: (tableId: string, columnIds: string[]) => void
): void {
  const relationships = query(state.collections)
    .collection('relationshipEntities')
    .selectByIds(state.doc.relationshipIds);

  for (const { start, end } of relationships) {
    visit(start.tableId, start.columnIds);
    visit(end.tableId, end.columnIds);
  }
}

/** The columns any relationship holds an end of on this table, whether or not they are flagged. */
export function relationshipColumnIds(
  state: RootState,
  table: Table
): Set<string> {
  const ids = new Set<string>();

  forEachRelationshipEnd(state, (tableId, columnIds) => {
    if (tableId !== table.id) return;

    columnIds.forEach(id => ids.add(id));
  });

  return ids;
}

/**
 * The same rows for every table at once, walked once over the document. What a
 * scene hands its cards, since a card asking for its own would walk every link
 * again, once per card drawn.
 *
 * @example
 * const related = relationshipColumnIdsByTable(state).get(table.id);
 */
export function relationshipColumnIdsByTable(
  state: RootState
): Map<string, Set<string>> {
  const byTable = new Map<string, Set<string>>();

  forEachRelationshipEnd(state, (tableId, columnIds) => {
    const ids = byTable.get(tableId) ?? new Set<string>();
    columnIds.forEach(id => ids.add(id));
    byTable.set(tableId, ids);
  });

  return byTable;
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

/** The tables one relationship out from the centers, centers included. */
function reach(
  centerIds: string[],
  relationships: Relationship[]
): Set<string> {
  const centers = new Set(centerIds);
  const reached = new Set(centers);

  for (const { start, end } of relationships) {
    if (centers.has(start.tableId)) reached.add(end.tableId);
    if (centers.has(end.tableId)) reached.add(start.tableId);
  }

  return reached;
}

/**
 * What a scene drawn from the source given shows: the whole document, or a
 * view's centers with their neighbours one relationship out while it stands on
 * centers and what its layout placed while it stands on none, with no memo and only the joining relationships.
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
  const shown = view.centerIds.length
    ? reach(view.centerIds, relationships)
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
 * null from a scene of another kind leaves the hover alone: a leave on the
 * document scene beside it is not the view's table leaving the pointer.
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
 * The one table a reader has pinned in a view, keyed by editor id, observable
 * so a scene that read it redraws when it moves. Local to the scene like the
 * hover: no action carries it, so a pin never reaches the document, the history or a peer.
 */
const pinned = observable({ tableId: {} as Record<string, string> });

/**
 * The view each pin was taken in, beside the observable rather than inside it,
 * for the same reason the hover keeps its view beside its own: the proxy would
 * wrap the view on the way out, and the identity below compares it to the slot the reader's source names.
 */
const pinnedView = new Map<string, SceneView>();

/**
 * Pins the table in the view of the source given, or lets it go when it is
 * the one already pinned. A second click on the same card is what releases it,
 * so the gesture is its own toggle and nothing else has to clear the slot.
 */
export function setViewPinnedTable(
  root: RootState,
  tableId: string,
  source: GeometrySource = 'document'
): void {
  const view = getSourceView(root, source);
  if (!view) return;

  const { id } = root.editor;
  const held = pinnedView.get(id) === view ? pinned.tableId[id] : undefined;

  if (held === tableId) {
    pinnedView.delete(id);
    Reflect.deleteProperty(pinned.tableId, id);
    return;
  }

  pinnedView.set(id, view);
  pinned.tableId[id] = tableId;
}

/**
 * The pin the view of the source given holds. One taken in a view that has
 * since closed fails the identity below and is never read, which is why the
 * gesture is the only thing that ever clears the slot.
 */
export function getViewPinnedTable(
  root: RootState,
  source: GeometrySource = 'document'
): string | null {
  const { id } = root.editor;
  const held = pinned.tableId[id];

  return held !== undefined &&
    pinnedView.get(id) === getSourceView(root, source)
    ? held
    : null;
}

/**
 * What the view of the source given lights: its centers, the table hovered,
 * the table pinned, and for each of those every shown relationship at it and
 * the table at the other end. A seed the view does not show lights nothing, since it is stale.
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
  const held = getViewPinnedTable(state, source);
  const lit = new Set(view.centerIds.filter(id => shownTables.has(id)));
  if (hovered !== null && shownTables.has(hovered)) lit.add(hovered);
  if (held !== null && shownTables.has(held)) lit.add(held);

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
