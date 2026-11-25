import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { toPlacementActions } from '@/components/erd/automatic-table-placement/placementActions';
import {
  getScrollToCenter,
  getViewTransform,
} from '@/components/erd/minimap/minimapGeometry';
import {
  addMemoAction,
  changeMemoGroupAction,
  moveToMemoAction,
} from '@/engine/modules/memo/atom.actions';
import { scrollToAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableGroupAction,
  changeTableNameAction,
  moveToTableAction,
} from '@/engine/modules/table/atom.actions';
import { addTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import { getContentRect } from '@/konva/scene/contentBounds';
import { getMemoRect, getTableRect, unionRect } from '@/konva/scene/metrics';
import { padRect } from '@/utils/tableGroup';

const contexts: AppContext[] = [];

afterEach(() => {
  contexts.splice(0).forEach(app => app.store.destroy());
});

/** users and posts in group g1, tags in none, and an empty group far off. */
function createApp(): AppContext {
  const app = createTestAppContext();
  contexts.push(app);
  app.store.dispatchSync(
    ...['users', 'posts', 'tags'].flatMap((id, index) => [
      addTableAction({ id, ui: { x: index * 400, y: 0, zIndex: 2 } }),
      changeTableNameAction({ id, value: id }),
    ]),
    addTableGroupAction({
      id: 'g1',
      ui: { x: -24, y: -52, width: 900, height: 300, zIndex: 1 },
    }),
    addTableGroupAction({
      id: 'empty',
      ui: { x: 3_000, y: 3_000, width: 100, height: 100, zIndex: 1 },
    }),
    changeTableGroupAction({ id: 'users', value: 'g1' }),
    changeTableGroupAction({ id: 'posts', value: 'g1' })
  );
  return app;
}

const POINTS = [
  { id: 'users', x: 1_000, y: 1_000 },
  { id: 'posts', x: 1_000, y: 1_400 },
  { id: 'tags', x: 1_600, y: 1_000 },
];

describe('toPlacementActions', () => {
  it('moves each table to its point and wraps each group with members round where they land', () => {
    const { store } = createApp();
    const { collections } = store.state;
    const at = (id: string, x: number, y: number) => ({
      ...getTableRect(store.state, collections.tableEntities[id]),
      x,
      y,
    });

    const actions = toPlacementActions(store.state, POINTS);

    expect(actions.slice(0, 4)).toEqual([
      ...POINTS.map(moveToTableAction),
      {
        type: 'tableGroup.resize',
        payload: {
          id: 'g1',
          ...padRect(
            unionRect(at('users', 1_000, 1_000), at('posts', 1_000, 1_400))
          ),
        },
      },
    ]);
  });

  it('centres the view on the box the tables and groups fill once they land, the empty group included', () => {
    const { store } = createApp();

    const actions = toPlacementActions(store.state, POINTS);
    store.dispatchSync(actions.slice(0, -1));
    const content = getContentRect(store.state)!;
    const origin = getScrollToCenter(getViewTransform(store.state), {
      x: content.x + content.width / 2,
      y: content.y + content.height / 2,
    });

    expect(actions.at(-1)).toEqual(
      scrollToAction({ originX: origin.x, originY: origin.y })
    );
    expect(
      store.state.collections.tableGroupEntities['empty'].ui
    ).toMatchObject({ x: 3_000, y: 3_000, width: 100, height: 100 });
  });

  it('lands as one undo entry, the groups put back with the tables', () => {
    const { store } = createApp();
    const before = { ...store.state.collections.tableGroupEntities['g1'].ui };
    const cursor = store.history.cursor;

    store.dispatchSync(toPlacementActions(store.state, POINTS));
    expect(store.history.cursor).toBe(cursor + 1);
    store.undo();

    expect(store.state.collections.tableGroupEntities['g1'].ui).toEqual(before);
    expect(store.state.collections.tableEntities['users'].ui).toMatchObject({
      x: 0,
      y: 0,
    });
  });

  it('centres nothing on a document drawing nothing', () => {
    const app = createTestAppContext();
    contexts.push(app);

    expect(toPlacementActions(app.store.state, [])).toEqual([]);
  });
});

describe('toPlacementActions with member memos', () => {
  /** createApp's document, with note in g1 at 100, 400 and loose in no group. */
  function createMemoApp(): AppContext {
    const app = createApp();
    app.store.dispatchSync(
      addMemoAction({ id: 'note', ui: { x: 100, y: 400, zIndex: 3 } }),
      changeMemoGroupAction({ id: 'note', value: 'g1' }),
      addMemoAction({ id: 'loose', ui: { x: 2_000, y: 0, zIndex: 3 } })
    );
    return app;
  }

  const memoMoves = (actions: ReturnType<typeof toPlacementActions>) =>
    actions.filter(({ type }) => type === 'memo.moveTo');

  it('moves a member memo the layout did not place by the shift of its tables corner, a loose one left', () => {
    const { store } = createMemoApp();

    // users and posts start at 0, 0 and 400, 0, and their corner lands at 1000, 1000.
    expect(memoMoves(toPlacementActions(store.state, POINTS))).toEqual([
      moveToMemoAction({ id: 'note', x: 1_100, y: 1_400 }),
    ]);
  });

  it('moves a memo the layout placed to its point, and rides no memo twice', () => {
    const { store } = createMemoApp();
    const placed = [{ id: 'note', x: 50, y: 60 }];

    expect(
      memoMoves(toPlacementActions(store.state, POINTS, 'document', placed))
    ).toEqual([moveToMemoAction({ id: 'note', x: 50, y: 60 })]);
  });

  it('wraps the group round its memo where it lands, centres on it and undoes it with the tables', () => {
    const { store } = createMemoApp();
    const { collections } = store.state;
    const at = (x: number, y: number) => ({
      ...getMemoRect(collections.memoEntities['note']),
      x,
      y,
    });
    const table = (id: string, x: number, y: number) => ({
      ...getTableRect(store.state, collections.tableEntities[id]),
      x,
      y,
    });
    const cursor = store.history.cursor;

    const actions = toPlacementActions(store.state, POINTS);
    store.dispatchSync(actions.slice(0, -1));
    const content = getContentRect(store.state)!;
    const origin = getScrollToCenter(getViewTransform(store.state), {
      x: content.x + content.width / 2,
      y: content.y + content.height / 2,
    });

    expect(collections.tableGroupEntities['g1'].ui).toMatchObject(
      padRect(
        [
          table('users', 1_000, 1_000),
          table('posts', 1_000, 1_400),
          at(1_100, 1_400),
        ].reduce(unionRect)
      )
    );
    expect(actions.at(-1)).toEqual(
      scrollToAction({ originX: origin.x, originY: origin.y })
    );
    expect(store.history.cursor).toBe(cursor + 1);
    store.undo();
    expect(collections.memoEntities['note'].ui).toMatchObject({
      x: 100,
      y: 400,
    });
  });
});
