import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { toPlacementActions } from '@/components/erd/automatic-table-placement/placementActions';
import { TablePlacement } from '@/constants/tablePlacement';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  changeTableGroupAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import { addTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import { getTableRect, type Rect } from '@/konva/scene/metrics';
import {
  createElkLayout,
  createElkLayoutRequest,
  toTablePoints,
} from '@/services/elk-layout';
import type {
  ElkLayoutPoint,
  ElkLayoutRequest,
} from '@/services/elk-layout/elkGraph';

/**
 * ELK is megabytes of script the worker parses before it answers anything, so
 * the first case here pays for the whole realm and every timeout below leaves
 * room for it.
 */
const TIMEOUT = 30_000;

const chain = (placement: ElkLayoutRequest['placement']): ElkLayoutRequest => ({
  placement,
  nodes: [
    { id: 't1', width: 200, height: 100 },
    { id: 't2', width: 200, height: 100 },
    { id: 't3', width: 200, height: 100 },
  ],
  edges: [
    { source: 't1', target: 't2', sourceRow: 0, targetRow: 0 },
    { source: 't2', target: 't3', sourceRow: 0, targetRow: 0 },
  ],
});

const byId = (points: ElkLayoutPoint[]) =>
  new Map(points.map(point => [point.id, point]));

describe('the placement runs in a shared worker', () => {
  it(
    'answers from a realm that has no document of its own',
    async () => {
      const points = await createElkLayout(
        chain(TablePlacement.layeredHorizontal)
      );

      expect(points.map(point => point.id).sort()).toEqual(['t1', 't2', 't3']);
    },
    TIMEOUT
  );

  it(
    'lays a chain left to right, so elk really ran there',
    async () => {
      const placed = byId(
        await createElkLayout(chain(TablePlacement.layeredHorizontal))
      );

      expect(placed.get('t2')!.x).toBeGreaterThan(placed.get('t1')!.x);
      expect(placed.get('t3')!.x).toBeGreaterThan(placed.get('t2')!.x);
    },
    TIMEOUT
  );

  it(
    'lays the same chain top to bottom for the vertical placement',
    async () => {
      const placed = byId(
        await createElkLayout(chain(TablePlacement.layeredVertical))
      );

      expect(placed.get('t2')!.y).toBeGreaterThan(placed.get('t1')!.y);
      expect(placed.get('t3')!.y).toBeGreaterThan(placed.get('t2')!.y);
    },
    TIMEOUT
  );

  it(
    'answers the flow placement from the same worker',
    async () => {
      const points = await createElkLayout(chain(TablePlacement.flow));

      expect(points).toHaveLength(3);
      expect(points.every(point => Number.isFinite(point.x))).toBe(true);
    },
    TIMEOUT
  );
});

const contexts: AppContext[] = [];

afterEach(() => {
  contexts.splice(0).forEach(app => app.store.destroy());
});

/**
 * Two groups, orders' holding a table joined to nothing, a relationship from
 * one group into the other, and two tables in no group, one joined to a group.
 */
function createGroupedDocument(): AppContext {
  const app = createTestAppContext();
  contexts.push(app);
  const tables = ['users', 'profiles', 'orders', 'items', 'audit', 'admins'];

  app.store.dispatchSync(
    ...tables.flatMap((id, index) => [
      addTableAction({ id, ui: { x: index * 40, y: 0, zIndex: 2 } }),
      changeTableNameAction({ id, value: id }),
    ]),
    ...['accounts', 'sales'].map(id =>
      addTableGroupAction({
        id,
        ui: { x: 0, y: 0, width: 10, height: 10, zIndex: 1 },
      })
    ),
    ...[
      ['users', 'accounts'],
      ['profiles', 'accounts'],
      ['orders', 'sales'],
      ['items', 'sales'],
      ['audit', 'sales'],
    ].map(([id, value]) => changeTableGroupAction({ id, value })),
    ...[
      ['users', 'profiles'],
      ['users', 'orders'],
      ['orders', 'items'],
      ['admins', 'users'],
    ].map(([start, end], index) =>
      addRelationshipAction({
        id: `r${index}`,
        relationshipType: 4,
        start: { tableId: start, columnIds: [] },
        end: { tableId: end, columnIds: [] },
      })
    )
  );
  return app;
}

describe('a placement of table groups through the worker', () => {
  for (const placement of [
    TablePlacement.layeredHorizontal,
    TablePlacement.layeredVertical,
    TablePlacement.flow,
  ] as const) {
    it(
      `lands each group's members inside its box and keeps the boxes apart under ${placement}`,
      async () => {
        const app = createGroupedDocument();
        const { store } = app;
        const request = createElkLayoutRequest(store.state, placement);

        const points = toTablePoints(
          store.state,
          request,
          await createElkLayout(request)
        );
        store.dispatchSync(toPlacementActions(store.state, points));

        const { collections } = store.state;
        const boxes = ['accounts', 'sales'].map(id => ({
          id,
          rect: collections.tableGroupEntities[id].ui,
        }));
        const inside = (rect: Rect, box: Rect) =>
          box.x <= rect.x &&
          box.y <= rect.y &&
          rect.x + rect.width <= box.x + box.width &&
          rect.y + rect.height <= box.y + box.height;
        const meets = (a: Rect, b: Rect) =>
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height;

        expect(points).toHaveLength(6);
        expect(meets(boxes[0].rect, boxes[1].rect)).toBe(false);
        for (const id of store.state.doc.tableIds) {
          const table = collections.tableEntities[id];
          const rect = getTableRect(store.state, table);
          for (const box of boxes) {
            expect(
              table.groupId === box.id
                ? inside(rect, box.rect)
                : !meets(rect, box.rect)
            ).toBe(true);
          }
        }
      },
      TIMEOUT
    );
  }

  it(
    'places the group a relationship reaches after the group it leaves, left to right',
    async () => {
      const { store } = createGroupedDocument();
      const request = createElkLayoutRequest(
        store.state,
        TablePlacement.layeredHorizontal
      );

      store.dispatchSync(
        toPlacementActions(
          store.state,
          toTablePoints(store.state, request, await createElkLayout(request))
        )
      );

      const { accounts, sales } = store.state.collections.tableGroupEntities;
      expect(sales.ui.x).toBeGreaterThan(accounts.ui.x + accounts.ui.width);
    },
    TIMEOUT
  );
});
