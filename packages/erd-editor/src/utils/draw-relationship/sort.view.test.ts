import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { Direction } from '@/constants/schema';
import {
  createEditor,
  ShowMode,
  ViewKind,
} from '@/engine/modules/editor/state';
import { createSceneView } from '@/engine/modules/editor/view';
import { RootState } from '@/engine/state';
import { Point, Relationship } from '@/internal-types';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import {
  type Anchors,
  getAnchors,
  getRoute,
  getStubSlots,
} from '@/utils/draw-relationship';
import { tableToObjectPoint } from '@/utils/draw-relationship/calc';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { getRelationshipPath } from '@/utils/draw-relationship/pathFinding';
import { collectObstacles } from '@/utils/draw-relationship/route';
import { relationshipSort } from '@/utils/draw-relationship/sort';

/** Where the view stands the tables: far from the document, so a leak between the two is a large number. */
const VIEW_POSITIONS: Record<string, Point> = {
  A: { x: 5_000, y: -3_000 },
  B: { x: 5_600, y: -3_000 },
  C: { x: 5_000, y: -2_600 },
};

type Bounds = { left: number; top: number; right: number; bottom: number };

function createState(): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  state.settings.show = 0;
  return state;
}

function addTable(state: RootState, id: string, x: number, y: number) {
  const table = createTable({ id, ui: { x, y } });
  state.collections.tableEntities[id] = table;
  state.doc.tableIds.push(id);
  return table;
}

function addRelationship(
  state: RootState,
  id: string,
  startTableId: string,
  endTableId: string
): Relationship {
  const relationship = createRelationship({
    id,
    start: { tableId: startTableId },
    end: { tableId: endTableId },
  });
  state.collections.relationshipEntities[id] = relationship;
  state.doc.relationshipIds.push(id);
  return relationship;
}

/**
 * A, B and C in a corner of the document and Z two hops from A, so a view
 * standing on A shows the first three and the connector to Z stays a document one.
 */
function createScene(state: RootState) {
  addTable(state, 'A', 0, 0);
  addTable(state, 'B', 400, 0);
  addTable(state, 'C', 0, 300);
  addTable(state, 'Z', 900, 900);

  return {
    ab: addRelationship(state, 'ab', 'A', 'B'),
    ac: addRelationship(state, 'ac', 'A', 'C'),
    bz: addRelationship(state, 'bz', 'B', 'Z'),
  };
}

function openFocused(
  state: RootState,
  positions: Record<string, Point> = VIEW_POSITIONS,
  showMode: ShowMode = ShowMode.keysOnly
) {
  const view = createSceneView(ViewKind.flow, ['A']);
  view.showMode = showMode;
  view.positions = positions;
  state.editor.views.flow = view;
  return view;
}

function openWhole(state: RootState, positions: Record<string, Point>) {
  const view = createSceneView(ViewKind.flow);
  view.positions = positions;
  state.editor.views.flow = view;
  return view;
}

const copyAnchors = ({ start, end }: Anchors) => ({
  start: { ...start },
  end: { ...end },
});

/** Everything one source draws for every connector, as plain data. */
function drawingOf(state: RootState, source: GeometrySource) {
  return state.doc.relationshipIds.map(id => {
    const relationship = state.collections.relationshipEntities[id];
    return {
      id,
      ...copyAnchors(getAnchors(relationship, source)),
      slots: [...getStubSlots(relationship, source)],
      route: getRoute(relationship, source)?.map(({ x, y }) => ({ x, y })),
    };
  });
}

/** The bounding rect of the boxes the view draws for the tables named. */
function viewBoundsOf(state: RootState, tableIds: string[]): Bounds {
  const bounds: Bounds = {
    left: Infinity,
    top: Infinity,
    right: -Infinity,
    bottom: -Infinity,
  };

  for (const id of tableIds) {
    const table = state.collections.tableEntities[id];
    const { lt, rb } = tableToObjectPoint(state, table, 'flow');
    bounds.left = Math.min(bounds.left, lt.x);
    bounds.top = Math.min(bounds.top, lt.y);
    bounds.right = Math.max(bounds.right, rb.x);
    bounds.bottom = Math.max(bounds.bottom, rb.y);
  }

  return bounds;
}

const within = ({ left, top, right, bottom }: Bounds, { x, y }: Point) =>
  x >= left && x <= right && y >= top && y <= bottom;

/** The two ends of the path itself: the anchors the guide lines start from. */
function pathEnds(relationship: Relationship, source: GeometrySource) {
  const { line } = getRelationshipPath(relationship, source).path;
  return [
    { x: line.start.x1, y: line.start.y1 },
    { x: line.end.x1, y: line.end.y1 },
  ];
}

describe('relationshipSort for a view', () => {
  let state: RootState;
  let ab: Relationship;
  let ac: Relationship;
  let bz: Relationship;

  beforeEach(() => {
    state = createState();
    ({ ab, ac, bz } = createScene(state));
  });

  /** AC-55. The entity carries the document's anchors, and a view sort never writes it. */
  it('leaves the document anchors on the entity where the document sort wrote them', () => {
    relationshipSort(state);
    const written = drawingOf(state, 'document');
    openFocused(state);

    relationshipSort(state, 'flow');

    expect(drawingOf(state, 'document')).toEqual(written);
    expect(ab.start).toMatchObject({
      x: 134,
      y: 15,
      direction: Direction.right,
    });
    expect(ab.end).toMatchObject({ x: 400, y: 15, direction: Direction.left });
    // The view placed its ends far away, and only its own reader sees them.
    expect(getAnchors(ab, 'flow').start.x).toBeGreaterThanOrEqual(5_000);
    expect(getAnchors(ab, 'flow')).not.toBe(ab);
  });

  /** AC-56. What the document draws does not depend on a view being open or having sorted. */
  it('sorts the document the same whether or not a view is open', () => {
    const alone = createState();
    createScene(alone);
    relationshipSort(alone);

    openFocused(state);
    relationshipSort(state, 'flow');
    relationshipSort(state);
    relationshipSort(state, 'flow');

    expect(drawingOf(state, 'document')).toEqual(drawingOf(alone, 'document'));
  });

  it('reads the document by default', () => {
    const named = createState();
    createScene(named);
    relationshipSort(named, 'document');

    relationshipSort(state);

    expect(drawingOf(state, 'document')).toEqual(drawingOf(named, 'document'));
  });

  /** AC-56. Anchors, turning points, route and path ends of a view all lie among the view's boxes. */
  it('keeps every point a view draws inside the bounding rect of the boxes it shows', () => {
    relationshipSort(state);
    openFocused(state);

    relationshipSort(state, 'flow');

    const bounds = viewBoundsOf(state, ['A', 'B', 'C']);
    expect(bounds.left).toBe(5_000);
    expect(bounds.top).toBe(-3_000);

    for (const relationship of [ab, ac]) {
      const { start, end } = getAnchors(relationship, 'flow');
      const route = getRoute(relationship, 'flow') ?? [];

      expect(within(bounds, start)).toBe(true);
      expect(within(bounds, end)).toBe(true);
      expect(route.length).toBeGreaterThan(1);
      for (const point of route) expect(within(bounds, point)).toBe(true);
      for (const point of pathEnds(relationship, 'flow')) {
        expect(within(bounds, point)).toBe(true);
      }
      for (const [from, to] of getRelationshipPath(
        relationship,
        'flow'
      ).path.path.d()) {
        expect(within(bounds, from)).toBe(true);
        expect(within(bounds, to)).toBe(true);
      }
    }

    // The same connectors read from the document sit where the document is.
    for (const point of pathEnds(ab, 'document')) {
      expect(within(bounds, point)).toBe(false);
    }
  });

  it('anchors the view ends on the facing edges of the view boxes', () => {
    openFocused(state);

    relationshipSort(state, 'flow');

    const a = tableToObjectPoint(
      state,
      state.collections.tableEntities.A,
      'flow'
    );
    const b = tableToObjectPoint(
      state,
      state.collections.tableEntities.B,
      'flow'
    );
    const c = tableToObjectPoint(
      state,
      state.collections.tableEntities.C,
      'flow'
    );

    expect(getAnchors(ab, 'flow').start).toEqual({
      tableId: 'A',
      ...a.right,
      direction: Direction.right,
    });
    expect(getAnchors(ab, 'flow').end).toEqual({
      tableId: 'B',
      ...b.left,
      direction: Direction.left,
    });
    expect(getAnchors(ac, 'flow').start).toEqual({
      tableId: 'A',
      ...a.bottom,
      direction: Direction.bottom,
    });
    expect(getAnchors(ac, 'flow').end).toEqual({
      tableId: 'C',
      ...c.top,
      direction: Direction.top,
    });
  });

  it('stores the two turning points of the view and routes nothing between them', () => {
    openFocused(state);

    relationshipSort(state, 'flow');

    // The obstacle set a view would route around is still the view's own
    // boxes; a view no longer asks for it, because its curve joins the two
    // turning points and reads no route.
    const obstacles = collectObstacles(state, 'flow');
    expect(obstacles.ids).toEqual(['A', 'B', 'C']);
    expect(Array.from(obstacles.left)).toEqual([5_002, 5_602, 5_002]);
    expect(Array.from(obstacles.top)).toEqual([-2_998, -2_998, -2_598]);

    const a = tableToObjectPoint(
      state,
      state.collections.tableEntities.A,
      'flow'
    );
    expect(getRoute(ab, 'flow')).toHaveLength(2);
    expect(getRoute(ac, 'flow')).toHaveLength(2);
    for (const { y } of getRoute(ab, 'flow') ?? []) expect(y).toBe(a.right.y);
    for (const { x } of getRoute(ac, 'flow') ?? []) expect(x).toBe(a.bottom.x);
    // The two points are the curve's own ends, which is what the culling box
    // reads them as.
    const { M, L } = getRelationshipPath(ab, 'flow').path.path;
    expect(getRoute(ab, 'flow')?.[0]).toEqual({ x: M.x, y: M.y });
    expect(getRoute(ab, 'flow')?.[1]).toEqual({ x: L.x, y: L.y });
    expect(getRoute(ab, 'flow')?.[0].y).toBe(-3_000 + 17);
  });

  it('routes only the connectors between two tables the view shows', () => {
    relationshipSort(state);
    openFocused(state);

    relationshipSort(state, 'flow');

    expect(getRoute(bz, 'document')).toBeDefined();
    expect(getRoute(bz, 'flow')).toBeUndefined();
    expect(getStubSlots(bz, 'flow')).toEqual([0, 0]);
    // A connector the view never sorted reads the document's anchors, as a
    // table the view has not placed stands at its document point.
    expect(getAnchors(bz, 'flow')).toBe(bz);
  });

  it('shows a view standing on no centers the tables its layout placed', () => {
    openWhole(state, { A: VIEW_POSITIONS.A, B: VIEW_POSITIONS.B });

    relationshipSort(state, 'flow');

    expect(collectObstacles(state, 'flow').ids).toEqual(['A', 'B']);
    expect(getRoute(ab, 'flow')).toBeDefined();
    expect(getRoute(ac, 'flow')).toBeUndefined();
    expect(getAnchors(ab, 'flow').start.x).toBeGreaterThanOrEqual(5_000);
  });

  /** AC-6. A name only box is its header, and the connector meets its edge. */
  it('anchors a name only box on its header edge', () => {
    openFocused(state, VIEW_POSITIONS, ShowMode.nameOnly);

    relationshipSort(state, 'flow');

    const a = tableToObjectPoint(
      state,
      state.collections.tableEntities.A,
      'flow'
    );
    expect(a.height).toBe(34);
    expect(getAnchors(ab, 'flow').start).toMatchObject({
      x: 5_000 + a.width,
      y: -3_000 + 17,
    });
    expect(getAnchors(ac, 'flow').start).toMatchObject({
      x: 5_000 + a.width / 2,
      y: -3_000 + 34,
    });
    expect(getAnchors(ac, 'flow').end).toMatchObject({
      x: 5_000 + a.width / 2,
      y: -2_600,
    });
  });

  it('follows a view table the view moves, and leaves the document where it was', () => {
    relationshipSort(state);
    const view = openFocused(state);
    relationshipSort(state, 'flow');
    const before = getAnchors(ab, 'flow').end.x;

    view.positions.B = { x: 6_000, y: -3_000 };
    relationshipSort(state, 'flow');

    expect(getAnchors(ab, 'flow').end.x).toBe(before + 400);
    expect(ab.end.x).toBe(400);
  });

  it('does nothing for a view while no view is open', () => {
    relationshipSort(state);
    const written = drawingOf(state, 'document');

    expect(() => relationshipSort(state, 'flow')).not.toThrow();

    expect(getRoute(ab, 'flow')).toBeUndefined();
    expect(drawingOf(state, 'document')).toEqual(written);
  });
});
