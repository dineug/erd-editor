import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { observer } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { flush } from '@/__test-utils__';
import { RELATIONSHIP_STROKE_WIDTH } from '@/constants/layout';
import { Direction } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { createEditor, ViewKind } from '@/engine/modules/editor/state';
import { createSceneView } from '@/engine/modules/editor/view';
import {
  viewCloseAction,
  viewOpenAction,
} from '@/engine/modules/editor/view.actions';
import { RootState } from '@/engine/state';
import { createStore, Store } from '@/engine/store';
import { Point, Relationship } from '@/internal-types';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import {
  type BBox,
  CIRCLE_HEIGHT,
  CIRCLE_RADIUS,
  clearSortChannel,
  DirectionName,
  DirectionNameList,
  getAnchors,
  getRoute,
  getRouteBBox,
  getStubSlots,
  isDirection,
  LINE_HEIGHT,
  LINE_SIZE,
  MAX_STUB,
  MIN_STUB,
  nextSortEpoch,
  PATH_END_HEIGHT,
  PATH_HEIGHT,
  PATH_LINE_HEIGHT,
  ROUTE_BBOX_REACH,
  setRoute,
} from '@/utils/draw-relationship';
import { curveReach } from '@/utils/draw-relationship/bezier';
import { tableToObjectPoint } from '@/utils/draw-relationship/calc';
import { getRelationshipPath } from '@/utils/draw-relationship/pathFinding';
import { relationshipSort } from '@/utils/draw-relationship/sort';

describe('DirectionName', () => {
  it('maps every direction key to its own name', () => {
    expect(DirectionName).toEqual({
      left: 'left',
      right: 'right',
      top: 'top',
      bottom: 'bottom',
    });
  });

  it('lists the direction names in declaration order', () => {
    expect(DirectionNameList).toEqual(['left', 'right', 'top', 'bottom']);
  });
});

describe('isDirection', () => {
  it('accepts every direction name', () => {
    expect(DirectionNameList.every(isDirection)).toBe(true);
  });

  it.each(['left', 'right', 'top', 'bottom'])('accepts %s', name => {
    expect(isDirection(name)).toBe(true);
  });

  it.each(['lt', 'rb', 'center', 'LEFT', '', 'width'])('rejects %j', name => {
    expect(isDirection(name)).toBe(false);
  });

  it('rejects the corner point keys that share the ObjectPoint shape', () => {
    expect(['lt', 'rt', 'lb', 'rb'].some(isDirection)).toBe(false);
  });
});

describe('layout constants', () => {
  it('derives the path end height from the path height', () => {
    expect(PATH_HEIGHT).toBe(30);
    expect(PATH_END_HEIGHT).toBe(PATH_HEIGHT + 20);
    expect(PATH_END_HEIGHT).toBe(50);
  });

  it('exposes the line drawing metrics', () => {
    expect(PATH_LINE_HEIGHT).toBe(25);
    expect(LINE_SIZE).toBe(7);
    expect(LINE_HEIGHT).toBe(11);
    expect(CIRCLE_HEIGHT).toBe(18);
    expect(CIRCLE_RADIUS).toBe(6);
  });

  it('centres the ring on the second tick', () => {
    expect(CIRCLE_HEIGHT).toBe(LINE_SIZE + LINE_HEIGHT);
  });

  it('starts the guide line where the longest decoration stroke ends', () => {
    expect(PATH_LINE_HEIGHT).toBe(LINE_HEIGHT + LINE_HEIGHT + 3);
  });

  it('leaves the ring clear of the tick behind it and the guide line ahead', () => {
    expect(CIRCLE_HEIGHT - CIRCLE_RADIUS).toBeGreaterThan(LINE_HEIGHT);
    expect(CIRCLE_HEIGHT + CIRCLE_RADIUS).toBeLessThan(PATH_LINE_HEIGHT);
  });

  it('keeps the path line stub shorter than the path end', () => {
    expect(PATH_LINE_HEIGHT).toBeLessThan(PATH_END_HEIGHT);
  });

  it('clamps a stub clear of the decorations without following them down', () => {
    expect(MIN_STUB).toBe(36);
    // The guide line runs from the decorations out to the stub, so a stub
    // inside them draws it backwards.
    expect(MIN_STUB).toBeGreaterThan(PATH_LINE_HEIGHT);
  });
});

describe('getAnchors', () => {
  const relationship = createRelationship({
    id: 'rel',
    start: { tableId: 'A', x: 10, y: 20, direction: Direction.right },
    end: { tableId: 'B', x: 300, y: 20, direction: Direction.left },
  });

  it('reads the document anchors off the entity, where the sort wrote them', () => {
    const { start, end } = getAnchors(relationship);

    expect(start).toBe(relationship.start);
    expect(end).toBe(relationship.end);
  });

  it('reads the document by default', () => {
    expect(getAnchors(relationship)).toEqual(
      getAnchors(relationship, 'document')
    );
  });
});

/** Where the view stands the two tables, far from the document's corner. */
const VIEW_POSITIONS: Record<string, Point> = {
  A: { x: 5_000, y: -3_000 },
  B: { x: 5_600, y: -3_000 },
};

const PAD = ROUTE_BBOX_REACH + RELATIONSHIP_STROKE_WIDTH;

/**
 * How far past the points a view's curve can reach, which its box carries and
 * the document's does not. The slack is the stub each end could still gain
 * where no route has fixed where it turns.
 */
function viewReach(points: Point[], slack: number): number {
  const { width, height } = boxOf(points, 0);

  return curveReach(Math.max(width, height) + 2 * slack);
}

function boxOf(points: Point[], pad: number): BBox {
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return {
    x: x - pad,
    y: y - pad,
    width: Math.max(...xs) - x + pad * 2,
    height: Math.max(...ys) - y + pad * 2,
  };
}

const contains = (outer: BBox, inner: BBox) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/** A and B joined by one connector, both in the document and placed by a view standing on A. */
function createScene(state: RootState = createState()) {
  for (const [id, x, y] of [
    ['A', 0, 0],
    ['B', 400, 0],
  ] as const) {
    state.collections.tableEntities[id] = createTable({ id, ui: { x, y } });
    state.doc.tableIds.push(id);
  }
  const relationship = createRelationship({
    id: 'ab',
    start: { tableId: 'A' },
    end: { tableId: 'B' },
  });
  state.collections.relationshipEntities.ab = relationship;
  state.doc.relationshipIds.push('ab');

  const view = createSceneView(ViewKind.flow, ['A']);
  view.positions = { ...VIEW_POSITIONS };
  state.editor.views.flow = view;

  return { state, relationship, view };
}

function createState(): RootState {
  const state: RootState = {
    ...schemaV3Parser({}),
    editor: createEditor(),
    lww: {},
  };
  state.settings.show = 0;
  return state;
}

/** The bounding rect of the boxes the view draws, the area a view box is measured against. */
function viewBounds(state: RootState): BBox {
  const boxes = ['A', 'B'].map(id =>
    tableToObjectPoint(state, state.collections.tableEntities[id], 'flow')
  );
  return boxOf(
    boxes.flatMap(({ lt, rb }) => [lt, rb]),
    0
  );
}

describe('getAnchors across the two channels', () => {
  /** AC-68. A view reads what its own sort wrote; the document reads the entity. */
  it('hands a view the anchors its sort wrote, and the document the entity', () => {
    const { state, relationship } = createScene();
    relationshipSort(state);
    relationshipSort(state, 'flow');

    const view = getAnchors(relationship, 'flow');
    const document = getAnchors(relationship, 'document');

    expect(document.start).toBe(relationship.start);
    expect(document.end).toBe(relationship.end);
    expect(view).not.toBe(relationship);
    expect(view.start).toMatchObject({
      tableId: 'A',
      x:
        5_000 +
        tableToObjectPoint(state, state.collections.tableEntities.A, 'flow')
          .width,
      y: -3_000 + 17,
      direction: Direction.right,
    });
    expect(view.end).toMatchObject({ tableId: 'B', x: 5_600, y: -3_000 + 17 });
    expect(relationship.start).toMatchObject({ x: 118, y: 28 });
  });

  it('reads the document anchors for a view that has not sorted the connector', () => {
    const { state, relationship } = createScene();
    relationshipSort(state);

    expect(getAnchors(relationship, 'flow')).toBe(relationship);
  });
});

describe('getRouteBBox across the two channels', () => {
  /** A view's sort opens the view's epoch, never the document's. */
  it('keeps the document box on its route while a view sorts in between', () => {
    const { state, relationship } = createScene();
    relationshipSort(state);
    const routed = getRouteBBox(relationship);
    const fallback = boxOf(
      [relationship.start, relationship.end],
      PAD + MAX_STUB
    );
    expect(routed).toEqual(
      boxOf(
        [
          ...(getRoute(relationship) ?? []),
          relationship.start,
          relationship.end,
        ],
        PAD
      )
    );
    expect(routed).not.toEqual(fallback);

    relationshipSort(state, 'flow');
    expect(getRouteBBox(relationship)).toEqual(routed);
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'document')
    ).toEqual(routed);

    relationshipSort(state);
    relationshipSort(state, 'flow');
    relationshipSort(state);
    expect(getRouteBBox(relationship)).toEqual(routed);
  });

  /** The view box is the two turning points, the view anchors and the curve's own reach. */
  it('builds a view box from the turning points and the view anchors, inside the view bounds', () => {
    const { state, relationship } = createScene();
    relationshipSort(state);
    relationshipSort(state, 'flow');

    const box = getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'flow');
    const { start, end } = getAnchors(relationship, 'flow');
    const route = getRoute(relationship, 'flow') ?? [];
    const turns = [route[0], route[route.length - 1]];
    const framed = [...turns, start, end];
    const reach = viewReach(framed, 0);

    expect(box).toEqual(boxOf(framed, PAD + reach));
    // The route the view no longer draws is inside it, curve reach and all.
    expect(contains(box, boxOf([...route, start, end], 0))).toBe(true);
    expect(
      contains(
        boxOf(
          [viewBounds(state)].flatMap(b => [
            { x: b.x, y: b.y },
            { x: b.x + b.width, y: b.y + b.height },
          ]),
          PAD + reach
        ),
        box
      )
    ).toBe(true);
    // Nowhere near the document's box, which is what a leak would have shown.
    expect(box.x).toBeGreaterThan(4_000);
    expect(getRouteBBox(relationship).x).toBeLessThan(200);
  });

  /** The box a view culls by holds the curve it draws, which is no longer its route. */
  it('holds every point of the curve a view draws, routed or not', () => {
    const { state, relationship } = createScene();
    relationshipSort(state);
    relationshipSort(state, 'flow');

    const drawn = () =>
      getRelationshipPath(relationship, 'flow')
        .path.path.d()
        .flatMap(([from, to]) => [from, to]);

    const holds = () =>
      contains(
        getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'flow'),
        boxOf(drawn(), 0)
      );

    expect(drawn().length).toBeGreaterThan(2);
    expect(holds()).toBe(true);

    nextSortEpoch('flow');
    expect(holds()).toBe(true);
  });

  it('falls back for a view that sorted the connector in an earlier epoch', () => {
    const { state, relationship } = createScene();
    relationshipSort(state);
    relationshipSort(state, 'flow');
    const routed = getRouteBBox(
      relationship,
      RELATIONSHIP_STROKE_WIDTH,
      'flow'
    );

    nextSortEpoch('flow');

    const { start, end } = getAnchors(relationship, 'flow');
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'flow')
    ).toEqual(
      boxOf([start, end], PAD + MAX_STUB + viewReach([start, end], MAX_STUB))
    );
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'flow')
    ).not.toEqual(routed);
    expect(getRouteBBox(relationship)).toEqual(
      boxOf(
        [
          ...(getRoute(relationship) ?? []),
          relationship.start,
          relationship.end,
        ],
        PAD
      )
    );
  });
});

describe('the view channel and the document channel', () => {
  const stores: Store[] = [];

  afterEach(() => {
    stores.splice(0).forEach(store => store.destroy());
  });

  /** Opening or closing the view empties the view's channel and leaves the document's. */
  it('is emptied by viewOpen and viewClose, and the document channel is not', () => {
    const store = createStore({
      toWidth: text => text.length * 10,
      clock: new Clock(),
    });
    stores.push(store);
    store.state.settings.show = 0;
    createScene(store.state);
    const relationship = store.state.collections.relationshipEntities.ab;
    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    store.state.editor.views.flow!.positions = { ...VIEW_POSITIONS };
    relationshipSort(store.state);
    relationshipSort(store.state, 'flow');
    const documentRoute = getRoute(relationship);
    expect(documentRoute).toBeDefined();
    expect(getRoute(relationship, 'flow')).toBeDefined();

    store.dispatchSync(viewCloseAction({ kind: ViewKind.flow }));

    expect(getAnchors(relationship, 'flow')).toBe(relationship);
    expect(getRoute(relationship, 'flow')).toBeUndefined();
    expect(getRoute(relationship)).toBe(documentRoute);

    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    store.state.editor.views.flow!.positions = { ...VIEW_POSITIONS };
    relationshipSort(store.state, 'flow');
    const viewRoute = getRoute(relationship, 'flow');
    expect(viewRoute).toBeDefined();

    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));

    expect(getRoute(relationship, 'flow')).toBeUndefined();
    expect(getAnchors(relationship, 'flow')).toBe(relationship);
    expect(getRoute(relationship)).toBe(documentRoute);
  });
});

describe('clearSortChannel', () => {
  const stores: Store[] = [];

  afterEach(() => {
    stores.splice(0).forEach(store => store.destroy());
  });

  /** Anchors, slots, routes and the epoch of one channel go, and the other channel keeps its own. */
  it('empties the view anchors, slots, routes and epoch, and leaves the document channel', () => {
    const { state, relationship } = createScene();
    relationshipSort(state);
    relationshipSort(state, 'flow');
    relationshipSort(state, 'flow');
    const documentBox = getRouteBBox(relationship);
    expect(getStubSlots(relationship, 'flow')).not.toBe(
      getStubSlots(relationship)
    );

    clearSortChannel([relationship], 'flow');

    expect(getAnchors(relationship, 'flow')).toBe(relationship);
    expect(getStubSlots(relationship, 'flow')).toEqual([0, 0]);
    expect(getRoute(relationship, 'flow')).toBeUndefined();
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'flow')
    ).toEqual(
      boxOf(
        [relationship.start, relationship.end],
        PAD +
          MAX_STUB +
          viewReach([relationship.start, relationship.end], MAX_STUB)
      )
    );
    expect(getRoute(relationship)).toBeDefined();
    expect(getRouteBBox(relationship)).toEqual(documentBox);

    // A route written after the clearing is stamped current, so it stands
    // until the next sort opens, exactly as in a fresh channel.
    const points = [
      { x: 5_200, y: -2_972 },
      { x: 5_500, y: -2_972 },
    ];
    setRoute(relationship, points, 'flow');
    const framed = [...points, relationship.start, relationship.end];
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'flow')
    ).toEqual(boxOf(framed, PAD + viewReach(framed, 0)));
    nextSortEpoch('flow');
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'flow')
    ).toEqual(
      boxOf(
        [relationship.start, relationship.end],
        PAD +
          MAX_STUB +
          viewReach([relationship.start, relationship.end], MAX_STUB)
      )
    );
  });

  it('empties the document channel by default', () => {
    const { state, relationship } = createScene();
    relationshipSort(state);
    relationshipSort(state, 'flow');
    const viewRoute = getRoute(relationship, 'flow');

    clearSortChannel([relationship]);

    expect(getRoute(relationship)).toBeUndefined();
    expect(getRoute(relationship, 'flow')).toBe(viewRoute);
  });

  /**
   * A store with the scene, a view open on A at the view points, and
   * both sorts run. Read back through the store: its state is an observable
   * proxy, and the channels key on the object the sort reads, which is the proxied one.
   */
  function createSortedStore() {
    const store = createStore({
      toWidth: text => text.length * 10,
      clock: new Clock(),
    });
    stores.push(store);
    store.state.settings.show = 0;
    createScene(store.state);
    const relationship = store.state.collections.relationshipEntities.ab;
    store.dispatchSync(
      viewOpenAction({ kind: ViewKind.flow, centerIds: ['A'] })
    );
    store.state.editor.views.flow!.positions = { ...VIEW_POSITIONS };
    relationshipSort(store.state);
    relationshipSort(store.state, 'flow');
    expect(getAnchors(relationship, 'flow')).not.toBe(relationship);
    expect(getRoute(relationship, 'flow')).toBeDefined();

    return { store, relationship };
  }

  /** Opening a view is what empties its channel, so a reopened view shows no anchors of the session before. */
  it('is what viewOpen does, so a reopened view starts with no anchors of the session before', () => {
    const { store, relationship } = createSortedStore();

    store.dispatchSync(
      viewOpenAction({ kind: ViewKind.flow, centerIds: ['A'] })
    );

    expect(getAnchors(relationship, 'flow')).toBe(relationship);
    expect(getStubSlots(relationship, 'flow')).toEqual([0, 0]);
    expect(getRoute(relationship, 'flow')).toBeUndefined();
    expect(getRoute(relationship)).toBeDefined();
    expect(getRouteBBox(relationship)).toEqual(
      boxOf(
        [
          ...(getRoute(relationship) ?? []),
          relationship.start,
          relationship.end,
        ],
        PAD
      )
    );
  });

  /** The channel is module-wide and a page may host two editors, so one store's viewOpen leaves the other's view geometry alone. */
  it('leaves the view geometry of another store on the page alone when a view opens', () => {
    const first = createSortedStore();
    const second = createSortedStore();
    const anchors = getAnchors(first.relationship, 'flow');
    const route = getRoute(first.relationship, 'flow');
    const slots = getStubSlots(first.relationship, 'flow');
    const box = getRouteBBox(
      first.relationship,
      RELATIONSHIP_STROKE_WIDTH,
      'flow'
    );

    second.store.dispatchSync(
      viewOpenAction({ kind: ViewKind.flow, centerIds: ['A'] })
    );

    expect(getAnchors(second.relationship, 'flow')).toBe(second.relationship);
    expect(getRoute(second.relationship, 'flow')).toBeUndefined();
    expect(getAnchors(first.relationship, 'flow')).toBe(anchors);
    expect(getRoute(first.relationship, 'flow')).toBe(route);
    expect(getStubSlots(first.relationship, 'flow')).toBe(slots);
    expect(
      getRouteBBox(first.relationship, RELATIONSHIP_STROKE_WIDTH, 'flow')
    ).toEqual(box);
  });
});

describe('the view channel and its readers', () => {
  const unsubscribes: Array<() => void> = [];

  afterEach(() => {
    unsubscribes.splice(0).forEach(unsubscribe => unsubscribe());
  });

  /** A render reading a connector from the view channel, counted each time it runs. */
  function watch(read: () => unknown) {
    let runs = 0;
    unsubscribes.push(
      observer(() => {
        read();
        runs += 1;
      })
    );
    return () => runs;
  }

  it('redraws a reader of the view anchors when a view sort moves them, and not when it does not', async () => {
    const { state, relationship, view } = createScene();
    relationshipSort(state);
    const runs = watch(() => getAnchors(relationship, 'flow'));
    expect(runs()).toBe(1);

    relationshipSort(state, 'flow');
    await flush();
    expect(runs()).toBe(2);

    relationshipSort(state, 'flow');
    await flush();
    expect(runs()).toBe(2);

    view.positions.B = { x: 6_000, y: -3_000 };
    relationshipSort(state, 'flow');
    await flush();
    expect(runs()).toBe(3);
    expect(getAnchors(relationship, 'flow').end.x).toBe(6_000);
  });

  it('redraws a reader of the view route and slots the same way', async () => {
    const { state, relationship, view } = createScene();
    relationshipSort(state, 'flow');
    const route = watch(() => getRoute(relationship, 'flow'));
    const slots = watch(() => getStubSlots(relationship, 'flow'));

    relationshipSort(state, 'flow');
    await flush();
    expect(route()).toBe(1);
    expect(slots()).toBe(1);

    view.positions.B = { x: 5_600, y: -2_600 };
    relationshipSort(state, 'flow');
    await flush();
    expect(route()).toBe(2);
    expect(slots()).toBe(2);
  });

  it('leaves a reader of the view channel alone while the document sorts', async () => {
    const { state, relationship } = createScene();
    relationshipSort(state, 'flow');
    const runs = watch(() => getAnchors(relationship, 'flow'));

    state.collections.tableEntities.B.ui.x = 900;
    relationshipSort(state);
    await flush();

    expect(runs()).toBe(1);
    expect(relationship.end.x).toBe(900);
  });

  it('wakes every reader of a connector the view channel forgets, and no reader of another', async () => {
    const { state, relationship } = createScene();
    const other = createScene();
    relationshipSort(state, 'flow');
    relationshipSort(other.state, 'flow');
    const runs = watch(() => getAnchors(relationship, 'flow'));
    const otherRuns = watch(() => getAnchors(other.relationship, 'flow'));

    clearSortChannel([relationship], 'flow');
    await flush();

    expect(runs()).toBe(2);
    expect(otherRuns()).toBe(1);
    expect(getAnchors(relationship, 'flow')).toBe(relationship);
    expect(getAnchors(other.relationship, 'flow')).not.toBe(other.relationship);
  });
});
