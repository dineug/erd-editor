import { toDocumentJson, toJson } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  ColumnOption,
  ColumnUIKey,
  Direction,
  StartRelationshipType,
} from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  initialLoadJsonAction$,
  loadJsonAction$,
} from '@/engine/modules/editor/generator.actions';
import { createRxStore } from '@/engine/rx-store';
import { settleDocument } from '@/engine/settle';
import { createStore } from '@/engine/store';
import { bHas } from '@/utils/bit';
import { getRoute } from '@/utils/draw-relationship';

const toWidth = (text: string) => text.length * 10;

/**
 * Two tables a relationship joins, as a file saved without what the editor
 * derives: no width, no column mark, the anchors at the origin and the flags
 * the other way round from what the columns say.
 */
const file = () =>
  JSON.stringify({
    version: '3.0.0',
    doc: {
      tableIds: ['users', 'orders'],
      relationshipIds: ['r1'],
    },
    collections: {
      tableEntities: {
        users: {
          id: 'users',
          name: 'user_accounts',
          comment: '',
          columnIds: ['id'],
          ui: { x: 100, y: 100 },
        },
        orders: {
          id: 'orders',
          name: 'orders',
          comment: 'the orders',
          columnIds: ['user_id', 'stale'],
          ui: { x: 900, y: 400 },
        },
      },
      tableColumnEntities: {
        id: {
          id: 'id',
          tableId: 'users',
          name: 'created_at',
          dataType: 'timestamp',
          default: 'now()',
          comment: 'when',
          options: ColumnOption.primaryKey | ColumnOption.notNull,
        },
        user_id: {
          id: 'user_id',
          tableId: 'orders',
          name: 'user_id',
          dataType: 'INT',
          options: ColumnOption.primaryKey | ColumnOption.notNull,
        },
        stale: {
          id: 'stale',
          tableId: 'orders',
          name: 'stale',
          options: 0,
          ui: { keys: ColumnUIKey.primaryKey | ColumnUIKey.foreignKey },
        },
      },
      relationshipEntities: {
        r1: {
          id: 'r1',
          identification: false,
          startRelationshipType: StartRelationshipType.ring,
          start: { tableId: 'users', columnIds: ['id'], x: 0, y: 0 },
          end: { tableId: 'orders', columnIds: ['user_id'], x: 0, y: 0 },
        },
      },
    },
  });

function loaded() {
  const store = createStore({ toWidth, clock: new Clock() });
  store.dispatchSync(loadJsonAction$(file()));
  return store;
}

describe('settleDocument', () => {
  it('marks each column a primary key exactly while its options say so, the foreign key as a relationship ends on it', () => {
    const { collections } = loaded().state;
    const keys = (id: string) => collections.tableColumnEntities[id].ui.keys;

    expect(keys('id')).toBe(ColumnUIKey.primaryKey);
    expect(keys('user_id')).toBe(
      ColumnUIKey.primaryKey | ColumnUIKey.foreignKey
    );
    expect(keys('stale')).toBe(0);
  });

  it('measures every table and column width with the store own toWidth', () => {
    const { collections } = loaded().state;
    const users = collections.tableEntities.users.ui;
    const orders = collections.tableEntities.orders.ui;
    const column = collections.tableColumnEntities.id.ui;

    expect(users.widthName).toBe(130);
    expect(users.widthComment).toBe(60);
    expect(orders.widthComment).toBe(100);
    expect(column).toMatchObject({
      widthName: 100,
      widthDataType: 90,
      widthDefault: 60,
      widthComment: 60,
    });
  });

  it('anchors each relationship on the borders of its tables', () => {
    const { start, end } = loaded().state.collections.relationshipEntities.r1;

    expect(start).toMatchObject({ direction: Direction.right });
    expect(start.x).toBeGreaterThanOrEqual(100);
    expect(end).toMatchObject({ x: 900, direction: Direction.left });
  });

  it('routes each connector in a store that draws, and none in one that draws nothing', () => {
    const drawn = loaded().state.collections.relationshipEntities.r1;
    expect(getRoute(drawn)?.length).toBeGreaterThan(1);

    const store = createStore({ toWidth, routes: false, clock: new Clock() });
    store.dispatchSync(loadJsonAction$(file()));
    const headless = store.state.collections.relationshipEntities.r1;

    expect(headless.start).toMatchObject({ direction: Direction.right });
    expect(headless.end).toMatchObject({ x: 900, direction: Direction.left });
    expect(getRoute(headless)).toBeUndefined();
  });

  it('reads the flags of each relationship off the columns it ends on', () => {
    const relationship = loaded().state.collections.relationshipEntities.r1;

    expect(relationship.identification).toBe(true);
    expect(relationship.startRelationshipType).toBe(StartRelationshipType.dash);
  });

  it('writes nothing more when it runs again on what it settled', () => {
    const store = loaded();
    const settled = toJson(store.state);

    settleDocument(store.state, store.context);

    expect(toJson(store.state)).toBe(settled);
  });

  it.each([
    ['initialLoadJsonAction$', initialLoadJsonAction$],
    ['loadJsonAction$', loadJsonAction$],
  ])(
    'leaves %s with every derived value in place when it returns, rewritten by no hook after it',
    async (_, load) => {
      const store = createRxStore(
        { toWidth, clock: new Clock() },
        { observable: false }
      );
      store.dispatchSync(load(file()));
      const value = toJson(store.state);
      const saved = toDocumentJson(store.state);
      const column = store.state.collections.tableColumnEntities.user_id;

      expect(bHas(column.ui.keys, ColumnUIKey.primaryKey)).toBe(true);
      expect(column.ui.widthName).toBe(70);

      await new Promise(resolve => setTimeout(resolve, 40));

      expect(toJson(store.state)).toBe(value);
      expect(toDocumentJson(store.state)).toBe(saved);
      store.destroy();
    }
  );
});
