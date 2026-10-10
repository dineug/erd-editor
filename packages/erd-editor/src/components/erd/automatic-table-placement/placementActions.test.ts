import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { toPlacementActions } from '@/components/erd/automatic-table-placement/placementActions';
import {
  getScrollToCenter,
  getViewTransform,
} from '@/components/erd/minimap/minimapGeometry';
import { scrollToAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableGroupAction,
  changeTableNameAction,
  moveToTableAction,
} from '@/engine/modules/table/atom.actions';
import { addTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import { getContentRect } from '@/konva/scene/contentBounds';
import { getTableRect, unionRect } from '@/konva/scene/metrics';
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
