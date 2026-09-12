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
import { tableToObjectPoint } from '@/utils/draw-relationship/calc';
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

/** Where a Focus view stands the two tables, far from the document's corner. */
const VIEW_POSITIONS: Record<string, Point> = {
  A: { x: 5_000, y: -3_000 },
  B: { x: 5_600, y: -3_000 },
};

const PAD = ROUTE_BBOX_REACH + RELATIONSHIP_STROKE_WIDTH;

function boxOf(points: Point[], pad: number): BBox {
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;

  return {
    x,
    y,
    width: Math.max(...xs) + pad - x,
    height: Math.max(...ys) + pad - y,
  };
}

const contains = (outer: BBox, inner: BBox) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/** A and B joined by one connector, both in the document and placed by a Focus view on A. */
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

  const view = createSceneView(ViewKind.focus, ['A']);
  view.positions = { ...VIEW_POSITIONS };
  state.editor.views.focus = view;

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

/** The bounding rect of the boxes the view draws, the area AC-62 measures against. */
function viewBounds(state: RootState): BBox {
  const boxes = ['A', 'B'].map(id =>
    tableToObjectPoint(state, state.collections.tableEntities[id], 'focus')
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
    relationshipSort(state, 'focus');

    const view = getAnchors(relationship, 'focus');
    const document = getAnchors(relationship, 'document');

    expect(document.start).toBe(relationship.start);
    expect(document.end).toBe(relationship.end);
    expect(view).not.toBe(relationship);
    expect(view.start).toMatchObject({
      tableId: 'A',
      x:
        5_000 +
        tableToObjectPoint(state, state.collections.tableEntities.A, 'focus')
          .width,
      y: -3_000 + 28,
      direction: Direction.right,
    });
    expect(view.end).toMatchObject({ tableId: 'B', x: 5_600, y: -3_000 + 28 });
    expect(relationship.start).toMatchObject({ x: 118, y: 28 });
  });

  it('reads the document anchors for a view that has not sorted the connector', () => {
    const { state, relationship } = createScene();
    relationshipSort(state);

    expect(getAnchors(relationship, 'focus')).toBe(relationship);
  });
});

describe('getRouteBBox across the two channels', () => {
  /** AC-62. A view's sort opens the view's epoch, never the document's. */
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

    relationshipSort(state, 'focus');
    expect(getRouteBBox(relationship)).toEqual(routed);
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'document')
    ).toEqual(routed);

    relationshipSort(state);
    relationshipSort(state, 'focus');
    relationshipSort(state);
    expect(getRouteBBox(relationship)).toEqual(routed);
  });

  /** AC-62. The view box is the view route and the view anchors, within the view's boxes plus the reach. */
  it('builds a view box from the view route and the view anchors, inside the view bounds', () => {
    const { state, relationship } = createScene();
    relationshipSort(state);
    relationshipSort(state, 'focus');

    const box = getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'focus');
    const { start, end } = getAnchors(relationship, 'focus');

    expect(box).toEqual(
      boxOf([...(getRoute(relationship, 'focus') ?? []), start, end], PAD)
    );
    expect(
      contains(
        boxOf(
          [viewBounds(state)].flatMap(b => [
            { x: b.x, y: b.y },
            { x: b.x + b.width, y: b.y + b.height },
          ]),
          PAD
        ),
        box
      )
    ).toBe(true);
    // Nowhere near the document's box, which is what a leak would have shown.
    expect(box.x).toBeGreaterThan(4_000);
    expect(getRouteBBox(relationship).x).toBeLessThan(200);
  });

  it('falls back for a view that sorted the connector in an earlier epoch', () => {
    const { state, relationship } = createScene();
    relationshipSort(state);
    relationshipSort(state, 'focus');
    const routed = getRouteBBox(
      relationship,
      RELATIONSHIP_STROKE_WIDTH,
      'focus'
    );

    nextSortEpoch('focus');

    const { start, end } = getAnchors(relationship, 'focus');
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'focus')
    ).toEqual(boxOf([start, end], PAD + MAX_STUB));
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'focus')
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

/** Where a Flow view stands the two tables, on the far side of the document from the Focus view. */
const FLOW_POSITIONS: Record<string, Point> = {
  A: { x: -4_000, y: 2_000 },
  B: { x: -3_400, y: 2_000 },
};

/** A Flow view open beside the Focus view of createScene, at its own points. */
function openFlow(state: RootState) {
  const view = createSceneView(ViewKind.flow);
  view.positions = { ...FLOW_POSITIONS };
  state.editor.views.flow = view;
  return view;
}

describe('the three channels', () => {
  const stores: Store[] = [];

  afterEach(() => {
    stores.splice(0).forEach(store => store.destroy());
  });

  /** One connector sorted three ways, each channel holding the anchors and the route of its own layout. */
  it('holds each source the anchors and the route its own sort wrote', () => {
    const { state, relationship } = createScene();
    openFlow(state);
    relationshipSort(state);
    relationshipSort(state, 'flow');
    relationshipSort(state, 'focus');

    const flow = getAnchors(relationship, 'flow');
    const focus = getAnchors(relationship, 'focus');

    expect(relationship.start).toMatchObject({ x: 118, y: 28 });
    expect(flow.start.x).toBeGreaterThan(-4_000);
    expect(flow.start.x).toBeLessThan(-3_400);
    expect(flow.end).toMatchObject({ x: -3_400, y: 2_000 + 28 });
    expect(focus.start.x).toBeGreaterThan(5_000);
    expect(focus.end).toMatchObject({ x: 5_600, y: -3_000 + 28 });
    expect(flow).not.toBe(focus);

    expect(getRoute(relationship, 'flow')).toBeDefined();
    expect(getRoute(relationship, 'focus')).toBeDefined();
    expect(getRoute(relationship, 'flow')).not.toEqual(
      getRoute(relationship, 'focus')
    );
    expect(getRouteBBox(relationship).x).toBeLessThan(200);
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'flow').x
    ).toBeLessThan(-3_000);
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'focus').x
    ).toBeGreaterThan(4_000);
  });

  /** AC-62 across the kinds. A sort of one view opens that view's epoch and no other. */
  it('retires a route box by the epoch of its own channel alone', () => {
    const { state, relationship } = createScene();
    openFlow(state);
    relationshipSort(state);
    relationshipSort(state, 'flow');
    relationshipSort(state, 'focus');
    const document = getRouteBBox(relationship);
    const flow = getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'flow');
    const focus = getRouteBBox(
      relationship,
      RELATIONSHIP_STROKE_WIDTH,
      'focus'
    );

    nextSortEpoch('flow');

    const { start, end } = getAnchors(relationship, 'flow');
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'flow')
    ).toEqual(boxOf([start, end], PAD + MAX_STUB));
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'flow')
    ).not.toEqual(flow);
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'focus')
    ).toEqual(focus);
    expect(getRouteBBox(relationship)).toEqual(document);
  });

  it('empties one view channel and leaves the other as it stood', () => {
    const { state, relationship } = createScene();
    openFlow(state);
    relationshipSort(state, 'flow');
    relationshipSort(state, 'focus');
    const flowAnchors = getAnchors(relationship, 'flow');
    const flowRoute = getRoute(relationship, 'flow');
    const flowSlots = getStubSlots(relationship, 'flow');

    clearSortChannel([relationship], 'focus');

    expect(getAnchors(relationship, 'focus')).toBe(relationship);
    expect(getRoute(relationship, 'focus')).toBeUndefined();
    expect(getAnchors(relationship, 'flow')).toBe(flowAnchors);
    expect(getRoute(relationship, 'flow')).toBe(flowRoute);
    expect(getStubSlots(relationship, 'flow')).toBe(flowSlots);
  });

  /** AC-63 per kind. Opening or closing a view of one kind empties that kind's channel and no other. */
  it('is emptied by viewOpen and viewClose of its own kind alone', () => {
    const store = createStore({
      toWidth: text => text.length * 10,
      clock: new Clock(),
    });
    stores.push(store);
    store.state.settings.show = 0;
    createScene(store.state);
    const relationship = store.state.collections.relationshipEntities.ab;
    store.dispatchSync(
      viewOpenAction({ kind: ViewKind.flow }),
      viewOpenAction({ kind: ViewKind.focus, centerIds: ['A'] })
    );
    store.state.editor.views.flow!.positions = { ...FLOW_POSITIONS };
    store.state.editor.views.focus!.positions = { ...VIEW_POSITIONS };
    relationshipSort(store.state, 'flow');
    relationshipSort(store.state, 'focus');
    const flowRoute = getRoute(relationship, 'flow');
    expect(flowRoute).toBeDefined();
    expect(getRoute(relationship, 'focus')).toBeDefined();

    store.dispatchSync(viewCloseAction({ kind: ViewKind.focus }));

    expect(getAnchors(relationship, 'focus')).toBe(relationship);
    expect(getRoute(relationship, 'focus')).toBeUndefined();
    expect(getRoute(relationship, 'flow')).toBe(flowRoute);
    expect(getAnchors(relationship, 'flow')).not.toBe(relationship);

    relationshipSort(store.state, 'flow');
    store.dispatchSync(
      viewOpenAction({ kind: ViewKind.focus, centerIds: ['A'] })
    );
    store.state.editor.views.focus!.positions = { ...VIEW_POSITIONS };
    relationshipSort(store.state, 'focus');
    const focusRoute = getRoute(relationship, 'focus');
    expect(focusRoute).toBeDefined();

    store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));

    expect(getRoute(relationship, 'flow')).toBeUndefined();
    expect(getAnchors(relationship, 'flow')).toBe(relationship);
    expect(getRoute(relationship, 'focus')).toBe(focusRoute);
  });
});

describe('clearSortChannel', () => {
  const stores: Store[] = [];

  afterEach(() => {
    stores.splice(0).forEach(store => store.destroy());
  });

  /** AC-63. Anchors, slots, routes and the epoch of one channel go, and the other channel keeps its own. */
  it('empties the view anchors, slots, routes and epoch, and leaves the document channel', () => {
    const { state, relationship } = createScene();
    relationshipSort(state);
    relationshipSort(state, 'focus');
    relationshipSort(state, 'focus');
    const documentBox = getRouteBBox(relationship);
    expect(getStubSlots(relationship, 'focus')).not.toBe(
      getStubSlots(relationship)
    );

    clearSortChannel([relationship], 'focus');

    expect(getAnchors(relationship, 'focus')).toBe(relationship);
    expect(getStubSlots(relationship, 'focus')).toEqual([0, 0]);
    expect(getRoute(relationship, 'focus')).toBeUndefined();
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'focus')
    ).toEqual(boxOf([relationship.start, relationship.end], PAD + MAX_STUB));
    expect(getRoute(relationship)).toBeDefined();
    expect(getRouteBBox(relationship)).toEqual(documentBox);

    // A route written after the clearing is stamped current, so it stands
    // until the next sort opens, exactly as in a fresh channel.
    const points = [
      { x: 5_200, y: -2_972 },
      { x: 5_500, y: -2_972 },
    ];
    setRoute(relationship, points, 'focus');
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'focus')
    ).toEqual(boxOf([...points, relationship.start, relationship.end], PAD));
    nextSortEpoch('focus');
    expect(
      getRouteBBox(relationship, RELATIONSHIP_STROKE_WIDTH, 'focus')
    ).toEqual(boxOf([relationship.start, relationship.end], PAD + MAX_STUB));
  });

  it('empties the document channel by default', () => {
    const { state, relationship } = createScene();
    relationshipSort(state);
    relationshipSort(state, 'focus');
    const viewRoute = getRoute(relationship, 'focus');

    clearSortChannel([relationship]);

    expect(getRoute(relationship)).toBeUndefined();
    expect(getRoute(relationship, 'focus')).toBe(viewRoute);
  });

  /**
   * A store with the scene, a Focus view open on A at the view points, and
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
      viewOpenAction({ kind: ViewKind.focus, centerIds: ['A'] })
    );
    store.state.editor.views.focus!.positions = { ...VIEW_POSITIONS };
    relationshipSort(store.state);
    relationshipSort(store.state, 'focus');
    expect(getAnchors(relationship, 'focus')).not.toBe(relationship);
    expect(getRoute(relationship, 'focus')).toBeDefined();

    return { store, relationship };
  }

  /** AC-63. Opening a view is what empties its channel, so a reopened view shows no anchors of the session before. */
  it('is what viewOpen does, so a reopened view starts with no anchors of the session before', () => {
    const { store, relationship } = createSortedStore();

    store.dispatchSync(
      viewOpenAction({ kind: ViewKind.focus, centerIds: ['A'] })
    );

    expect(getAnchors(relationship, 'focus')).toBe(relationship);
    expect(getStubSlots(relationship, 'focus')).toEqual([0, 0]);
    expect(getRoute(relationship, 'focus')).toBeUndefined();
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
    const anchors = getAnchors(first.relationship, 'focus');
    const route = getRoute(first.relationship, 'focus');
    const slots = getStubSlots(first.relationship, 'focus');
    const box = getRouteBBox(
      first.relationship,
      RELATIONSHIP_STROKE_WIDTH,
      'focus'
    );

    second.store.dispatchSync(
      viewOpenAction({ kind: ViewKind.focus, centerIds: ['A'] })
    );

    expect(getAnchors(second.relationship, 'focus')).toBe(second.relationship);
    expect(getRoute(second.relationship, 'focus')).toBeUndefined();
    expect(getAnchors(first.relationship, 'focus')).toBe(anchors);
    expect(getRoute(first.relationship, 'focus')).toBe(route);
    expect(getStubSlots(first.relationship, 'focus')).toBe(slots);
    expect(
      getRouteBBox(first.relationship, RELATIONSHIP_STROKE_WIDTH, 'focus')
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
    const runs = watch(() => getAnchors(relationship, 'focus'));
    expect(runs()).toBe(1);

    relationshipSort(state, 'focus');
    await flush();
    expect(runs()).toBe(2);

    relationshipSort(state, 'focus');
    await flush();
    expect(runs()).toBe(2);

    view.positions.B = { x: 6_000, y: -3_000 };
    relationshipSort(state, 'focus');
    await flush();
    expect(runs()).toBe(3);
    expect(getAnchors(relationship, 'focus').end.x).toBe(6_000);
  });

  it('redraws a reader of the view route and slots the same way', async () => {
    const { state, relationship, view } = createScene();
    relationshipSort(state, 'focus');
    const route = watch(() => getRoute(relationship, 'focus'));
    const slots = watch(() => getStubSlots(relationship, 'focus'));

    relationshipSort(state, 'focus');
    await flush();
    expect(route()).toBe(1);
    expect(slots()).toBe(1);

    view.positions.B = { x: 5_600, y: -2_600 };
    relationshipSort(state, 'focus');
    await flush();
    expect(route()).toBe(2);
    expect(slots()).toBe(2);
  });

  it('leaves a reader of the view channel alone while the document sorts', async () => {
    const { state, relationship } = createScene();
    relationshipSort(state, 'focus');
    const runs = watch(() => getAnchors(relationship, 'focus'));

    state.collections.tableEntities.B.ui.x = 900;
    relationshipSort(state);
    await flush();

    expect(runs()).toBe(1);
    expect(relationship.end.x).toBe(900);
  });

  it('leaves a reader of one view channel alone while the other view sorts', async () => {
    const { state, relationship, view } = createScene();
    openFlow(state);
    relationshipSort(state, 'flow');
    relationshipSort(state, 'focus');
    const flowRuns = watch(() => getAnchors(relationship, 'flow'));
    const focusRuns = watch(() => getRoute(relationship, 'focus'));

    view.positions.B = { x: 6_000, y: -3_000 };
    relationshipSort(state, 'focus');
    await flush();

    expect(focusRuns()).toBe(2);
    expect(flowRuns()).toBe(1);
    expect(getAnchors(relationship, 'focus').end.x).toBe(6_000);
    expect(getAnchors(relationship, 'flow').end.x).toBe(-3_400);
  });

  it('wakes every reader of a connector the view channel forgets, and no reader of another', async () => {
    const { state, relationship } = createScene();
    const other = createScene();
    relationshipSort(state, 'focus');
    relationshipSort(other.state, 'focus');
    const runs = watch(() => getAnchors(relationship, 'focus'));
    const otherRuns = watch(() => getAnchors(other.relationship, 'focus'));

    clearSortChannel([relationship], 'focus');
    await flush();

    expect(runs()).toBe(2);
    expect(otherRuns()).toBe(1);
    expect(getAnchors(relationship, 'focus')).toBe(relationship);
    expect(getAnchors(other.relationship, 'focus')).not.toBe(
      other.relationship
    );
  });
});
