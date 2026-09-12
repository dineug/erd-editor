import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import { CanvasType, Direction, Show } from '@/constants/schema';
import {
  ShowMode,
  ViewKind,
  VisualizationMode,
} from '@/engine/modules/editor/state';
import {
  changeVisualizationModeAction,
  viewChangeShowModeAction,
  viewCloseAction,
  viewMoveTableAction,
  viewOpenAction,
  viewScrollToAction,
  viewSetCentersAction,
  viewSetLayoutAction,
  viewStreamZoomLevelAction,
} from '@/engine/modules/editor/view.actions';
import { removeRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { hooks } from '@/engine/modules/relationship/hooks';
import {
  changeCanvasTypeAction,
  changeShowAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  moveTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  changeColumnNameAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import type { RxStore } from '@/engine/rx-store';
import { attachActionTag, Tag } from '@/engine/tag';
import { Point } from '@/internal-types';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { getAnchors, getRoute } from '@/utils/draw-relationship';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { relationshipSort } from '@/utils/draw-relationship/sort';

vi.mock('@/utils/draw-relationship/sort', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/utils/draw-relationship/sort')>();
  return { ...actual, relationshipSort: vi.fn(actual.relationshipSort) };
});

const FOCUSED_POSITIONS: Record<string, Point> = {
  t1: { x: 5_000, y: -3_000 },
  t2: { x: 5_600, y: -3_000 },
};

const FLOW_POSITIONS: Record<string, Point> = {
  t1: { x: 1_000, y: 1_000 },
  t2: { x: 1_600, y: 1_000 },
  t3: { x: 2_200, y: 1_000 },
};

const stores: RxStore[] = [];

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
/** Both sort hooks throttle at 5 ms, trailing only. */
const settle = () => tick(50);

/** How many sorts each source has had since the count was last cleared. */
const sorts = (source: GeometrySource) =>
  vi
    .mocked(relationshipSort)
    .mock.calls.filter(([, given]) => (given ?? 'document') === source).length;

const clearSorts = () => vi.mocked(relationshipSort).mockClear();

afterEach(() => {
  stores.splice(0).forEach(store => store.destroy());
  clearSorts();
});

/**
 * t1 joined to t2, and t3 on its own with a column, so a view standing on t1
 * shows the first two and an edit to t3 is an edit outside the view.
 */
function createScene(): RxStore {
  const { store } = createTestAppContext();
  stores.push(store);
  const { state } = store;

  for (const [id, x] of [
    ['t1', 0],
    ['t2', 600],
    ['t3', 1_200],
  ] as const) {
    state.collections.tableEntities[id] = createTable({
      id,
      name: id,
      ui: { x, y: 0 },
      columnIds: [`c-${id}`],
    });
    state.collections.tableColumnEntities[`c-${id}`] = createColumn({
      id: `c-${id}`,
      tableId: id,
      name: `c-${id}`,
    });
    state.doc.tableIds.push(id);
  }
  state.collections.relationshipEntities.r12 = createRelationship({
    id: 'r12',
    start: { tableId: 't1', columnIds: ['c-t1'] },
    end: { tableId: 't2', columnIds: ['c-t2'] },
  });
  state.doc.relationshipIds.push('r12');

  return store;
}

const relationshipOf = (store: RxStore) =>
  store.state.collections.relationshipEntities.r12;

async function openFocused(store: RxStore) {
  store.dispatchSync(
    changeCanvasTypeAction({ value: CanvasType.visualization }),
    changeVisualizationModeAction({ value: VisualizationMode.flow }),
    viewOpenAction({ kind: ViewKind.flow, centerIds: ['t1'] }),
    viewSetLayoutAction({ kind: ViewKind.flow, positions: FOCUSED_POSITIONS })
  );
  await settle();
  clearSorts();
}

async function openFlow(store: RxStore) {
  store.dispatchSync(
    changeCanvasTypeAction({ value: CanvasType.visualization }),
    changeVisualizationModeAction({ value: VisualizationMode.flow }),
    viewOpenAction({ kind: ViewKind.flow }),
    viewSetLayoutAction({ kind: ViewKind.flow, positions: FLOW_POSITIONS })
  );
  await settle();
  clearSorts();
}

const shared = attachActionTag.bind(null, Tag.shared);

describe('the view sort hook registration', () => {
  it('subscribes to every layout action of the document, the key flag and the view actions', () => {
    const [documentPattern] = hooks[2];
    const [viewPattern, effect] = hooks[3];

    expect(typeof effect).toBe('function');
    expect(viewPattern.map(String)).toEqual([
      ...documentPattern.map(String),
      'column.changePrimaryKey',
      'editor.viewOpen',
      'editor.viewClose',
      'editor.viewScrollTo',
      'editor.viewStreamScrollTo',
      'editor.viewChangeZoomLevel',
      'editor.viewStreamZoomLevel',
      'editor.viewMoveTable',
      'editor.viewSetLayout',
      'editor.viewChangeShowMode',
      'editor.viewSetCenters',
    ]);
  });
});

describe('the view sort hook on the view actions', () => {
  /** AC-57. Each of the four runs one view sort and no document sort. */
  it.each([
    [
      'viewMoveTable',
      () => viewMoveTableAction({ ids: ['t2'], movementX: 10, movementY: 0 }),
    ],
    [
      'viewSetLayout',
      () =>
        viewSetLayoutAction({
          kind: ViewKind.flow,
          positions: { t1: { x: 7_000, y: 0 }, t2: { x: 7_600, y: 0 } },
        }),
    ],
    [
      'viewChangeShowMode',
      () => viewChangeShowModeAction({ value: ShowMode.allFields }),
    ],
    ['viewSetCenters', () => viewSetCentersAction({ tableIds: ['t2'] })],
  ])('%s runs one view sort and no document sort', async (_, action) => {
    const store = createScene();
    await openFocused(store);

    store.dispatchSync(action());
    await settle();

    expect(sorts('flow')).toBe(1);
    expect(sorts('document')).toBe(0);
  });

  it('sorts the view once it opens, at the points it then places', async () => {
    const store = createScene();

    store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.visualization }),
      changeVisualizationModeAction({ value: VisualizationMode.flow })
    );
    store.dispatchSync(
      viewOpenAction({ kind: ViewKind.flow, centerIds: ['t1'] })
    );
    expect(sorts('flow')).toBe(0);
    await settle();
    expect(sorts('flow')).toBe(1);
    expect(getAnchors(relationshipOf(store), 'flow').start.x).toBeLessThan(
      1_000
    );

    store.dispatchSync(
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: FOCUSED_POSITIONS,
      })
    );
    await settle();

    expect(sorts('flow')).toBe(2);
    expect(
      getAnchors(relationshipOf(store), 'flow').start.x
    ).toBeGreaterThanOrEqual(5_000);
    expect(sorts('document')).toBe(0);
  });

  /** AC-66. The window is 5 ms, trailing only. */
  it('collapses a burst into one trailing view sort', async () => {
    const store = createScene();
    await openFocused(store);

    store.dispatchSync(viewSetCentersAction({ tableIds: ['t2'] }));
    store.dispatchSync(viewSetCentersAction({ tableIds: ['t1'] }));
    store.dispatchSync(viewSetCentersAction({ tableIds: ['t2'] }));
    expect(sorts('flow')).toBe(0);
    await settle();

    expect(sorts('flow')).toBe(1);
  });

  it('does not sort for a scroll or a zoom of the view', async () => {
    const store = createScene();
    await openFocused(store);

    store.dispatchSync(
      viewScrollToAction({ originX: 40, originY: 60 }),
      viewStreamZoomLevelAction({ value: -0.2 })
    );
    await settle();

    expect(sorts('flow')).toBe(0);
    expect(sorts('document')).toBe(0);
  });

  it('does not sort while no view is open', async () => {
    const store = createScene();
    await openFocused(store);

    store.dispatchSync(viewCloseAction({ kind: ViewKind.flow }));
    await settle();
    expect(sorts('flow')).toBe(0);

    store.dispatchSync(viewSetCentersAction({ tableIds: ['t2'] }));
    await settle();

    expect(sorts('flow')).toBe(0);
  });
});

describe('the view sort hook on the document actions', () => {
  /** AC-66. An edit to a table the view does not show leaves the view alone. */
  it('does not sort the view for an edit outside what it shows, and does for one inside', async () => {
    const store = createScene();
    await openFocused(store);

    store.dispatchSync(
      shared(changeColumnNameAction({ id: 'c-t3', tableId: 't3', value: 'x' }))
    );
    await settle();
    expect(sorts('flow')).toBe(0);
    expect(sorts('document')).toBe(1);

    store.dispatchSync(
      shared(changeColumnNameAction({ id: 'c-t2', tableId: 't2', value: 'y' }))
    );
    await settle();
    expect(sorts('flow')).toBe(1);
    expect(sorts('document')).toBe(2);
  });

  /**
   * AC-12. A narrowed view opens on the key rows, so a remote key flag on a shown table
   * adds a row to its box; the document sort never sees the flag, the view's does.
   */
  it('sorts the view for a remote key flag on a table it shows, which the document sort ignores', async () => {
    const store = createScene();
    const { state } = store;
    state.collections.tableColumnEntities['c-t2-b'] = createColumn({
      id: 'c-t2-b',
      tableId: 't2',
      name: 'c-t2-b',
    });
    state.collections.tableEntities.t2.columnIds.push('c-t2-b');
    await openFocused(store);
    const relationship = relationshipOf(store);
    const before = getAnchors(relationship, 'flow').end.y;

    store.dispatchSync(
      shared(
        changeColumnPrimaryKeyAction({
          id: 'c-t2-b',
          tableId: 't2',
          value: true,
        })
      )
    );
    await settle();

    expect(sorts('flow')).toBe(1);
    expect(sorts('document')).toBe(0);
    expect(getAnchors(relationship, 'flow').end).toMatchObject({
      x: 5_600,
      direction: Direction.left,
    });
    expect(getAnchors(relationship, 'flow').end.y).toBeGreaterThan(before);
  });

  it('does not sort the view for a key flag on a table outside it', async () => {
    const store = createScene();
    await openFocused(store);

    store.dispatchSync(
      shared(
        changeColumnPrimaryKeyAction({ id: 'c-t3', tableId: 't3', value: true })
      )
    );
    await settle();

    expect(sorts('flow')).toBe(0);
  });

  it('does not sort the view for a table added outside it', async () => {
    const store = createScene();
    await openFocused(store);

    store.dispatchSync(
      shared(addTableAction({ id: 't4', ui: { x: 0, y: 900, zIndex: 9 } }))
    );
    await settle();

    expect(sorts('flow')).toBe(0);
    expect(sorts('document')).toBe(1);
  });

  it('does not sort the view for a show bit, which a view never reads', async () => {
    const store = createScene();
    await openFocused(store);

    store.dispatchSync(
      shared(changeShowAction({ show: Show.tableComment, value: false }))
    );
    await settle();

    expect(sorts('flow')).toBe(0);
    expect(sorts('document')).toBe(1);
  });

  /** AC-13. A neighbour leaving the view is a change to what it shows, though its id has already left. */
  it('sorts the view when a connector it showed is removed', async () => {
    const store = createScene();
    await openFocused(store);
    expect(getRoute(relationshipOf(store), 'flow')).toBeDefined();

    store.dispatchSync(shared(removeRelationshipAction({ id: 'r12' })));
    await settle();

    expect(sorts('flow')).toBe(1);
    expect(store.state.doc.relationshipIds).toEqual([]);
  });

  /** AC-55. A remote move re-sorts the document onto the entity and the view into its channel. */
  it('keeps the entity on the document while a remote move re-sorts both', async () => {
    const store = createScene();
    await openFocused(store);
    const relationship = relationshipOf(store);

    store.dispatchSync(
      shared(moveTableAction({ ids: ['t2'], movementX: 100, movementY: 0 }))
    );
    await settle();

    expect(sorts('document')).toBe(1);
    expect(sorts('flow')).toBe(1);
    // The entity sits on t2's document left edge, where the move put it, and
    // the view's end stays on the left edge of the box the view placed.
    expect(store.state.collections.tableEntities.t2.ui.x).toBe(700);
    expect(relationship.end).toMatchObject({
      x: 700,
      direction: Direction.left,
    });
    expect(getAnchors(relationship, 'flow').end).toMatchObject({
      x: 5_600,
      direction: Direction.left,
    });
    expect(getAnchors(relationship, 'flow').end.y).toBeLessThan(-2_900);
  });
});

describe('the view sort hook across the tab', () => {
  it('sorts the view a move names, whichever view the redirect would reach', async () => {
    const store = createScene();
    await openFlow(store);

    store.dispatchSync(
      viewMoveTableAction({
        ids: ['t1'],
        movementX: 10,
        movementY: 0,
        kind: ViewKind.flow,
      })
    );
    await settle();

    expect(store.state.editor.views.flow!.positions.t1.x).toBe(1_010);
    expect(sorts('flow')).toBe(1);
    expect(sorts('document')).toBe(0);
  });

  /**
   * A Flow view is kept across tabs and left alone while its tab is away: no
   * scene draws it there, and the return stands it back on its landing, which
   * is a layout of the view and sorts it whole.
   */
  it('leaves a Flow view alone while its tab is away, and sorts it on the layout its return stands it on', async () => {
    const store = createScene();
    await openFlow(store);
    const relationship = relationshipOf(store);
    store.dispatchSync(changeCanvasTypeAction({ value: CanvasType.ERD }));
    await settle();
    clearSorts();

    store.dispatchSync(
      shared(changeColumnNameAction({ id: 'c-t1', tableId: 't1', value: 'x' })),
      shared(moveTableAction({ ids: ['t1'], movementX: 10, movementY: 0 }))
    );
    await settle();
    expect(sorts('flow')).toBe(0);
    expect(sorts('document')).toBe(1);
    expect(getAnchors(relationship, 'flow').start.y).toBe(1_000 + 21);

    store.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.visualization })
    );
    await settle();
    expect(sorts('flow')).toBe(0);

    store.dispatchSync(
      viewSetLayoutAction({ kind: ViewKind.flow, positions: FLOW_POSITIONS })
    );
    await settle();

    expect(sorts('flow')).toBe(1);
    expect(sorts('document')).toBe(1);
    expect(getAnchors(relationship, 'flow').start.y).toBe(1_000 + 21);
  });
});
