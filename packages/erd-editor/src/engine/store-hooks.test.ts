import { query } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, ColumnUIKey, Direction } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  initialLoadJsonAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { hooks as relationshipHooks } from '@/engine/modules/relationship/hooks';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { hooks as tableHooks } from '@/engine/modules/table/hooks';
import {
  addColumnAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { hooks as tableColumnHooks } from '@/engine/modules/table-column/hooks';
import { createStore, Store } from '@/engine/store';
import { createHooks } from '@/engine/store-hooks';
import { bHas } from '@/utils/bit';

const settle = () => new Promise(resolve => setTimeout(resolve, 40));

function setup() {
  const store = createStore({
    toWidth: text => text.length * 10,
    clock: new Clock(),
  });
  const hooks = createHooks(store);
  return { store, hooks };
}

const column = (store: Store, id: string) =>
  query(store.state.collections)
    .collection('tableColumnEntities')
    .selectById(id);

function seedTable(store: Store) {
  store.dispatchSync(
    addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 1 } })
  );
  store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));
}

describe('createHooks', () => {
  it('runs the primary-key hook that forces notNull on', async () => {
    const { store, hooks } = setup();
    seedTable(store);

    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true })
    );
    expect(bHas(column(store, 'c1')!.options, ColumnOption.primaryKey)).toBe(
      true
    );
    expect(bHas(column(store, 'c1')!.options, ColumnOption.notNull)).toBe(
      false
    );

    await settle();

    expect(bHas(column(store, 'c1')!.options, ColumnOption.notNull)).toBe(true);

    hooks.destroy();
  });

  it('leaves a non primary-key column untouched', async () => {
    const { store, hooks } = setup();
    seedTable(store);

    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: false })
    );
    await settle();

    expect(bHas(column(store, 'c1')!.options, ColumnOption.notNull)).toBe(
      false
    );

    hooks.destroy();
  });

  it('marks foreign-key columns when a relationship is added', async () => {
    const { store, hooks } = setup();
    seedTable(store);
    store.dispatchSync(addColumnAction({ id: 'c2', tableId: 't1' }));

    store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't1', columnIds: ['c2'] },
      })
    );
    await settle();

    expect(bHas(column(store, 'c2')!.ui.keys, ColumnUIKey.foreignKey)).toBe(
      true
    );
    expect(bHas(column(store, 'c1')!.ui.keys, ColumnUIKey.foreignKey)).toBe(
      false
    );

    hooks.destroy();
  });

  it('anchors a relationship it adds before the task that added it ends', async () => {
    // An entity is created with both ends at the origin, and the frame after
    // the add would draw it there if the sort waited for a timer.
    const { store, hooks } = setup();
    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 1 } }),
      addTableAction({ id: 't2', ui: { x: 600, y: 0, zIndex: 2 } })
    );

    store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: [] },
        end: { tableId: 't2', columnIds: [] },
      })
    );
    for (let index = 0; index < 5; index++) await Promise.resolve();

    const { start, end } = store.state.collections.relationshipEntities.r1;
    expect(start.direction).toBe(Direction.right);
    expect(end).toMatchObject({ x: 600, direction: Direction.left });

    hooks.destroy();
  });

  it('ignores actions no hook subscribed to', async () => {
    const { store, hooks } = setup();
    seedTable(store);
    const before = column(store, 'c1')!.options;

    store.dispatchSync(
      addTableAction({ id: 't2', ui: { x: 0, y: 0, zIndex: 1 } })
    );
    await settle();

    expect(column(store, 'c1')!.options).toBe(before);

    hooks.destroy();
  });

  it('destroy unsubscribes the store so later actions no longer reach the hooks', async () => {
    const { store, hooks } = setup();
    seedTable(store);

    hooks.destroy();

    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true })
    );
    await settle();

    expect(bHas(column(store, 'c1')!.options, ColumnOption.primaryKey)).toBe(
      true
    );
    expect(bHas(column(store, 'c1')!.options, ColumnOption.notNull)).toBe(
      false
    );
  });

  it('wakes on a load only the hooks settleLoad writes for at once', () => {
    // A replica measures its changes from the load settleLoad leaves, so a new
    // hook on a load joins it, or a pan on a stale file reads as an edit.
    const onLoad = (type: string) =>
      [...tableHooks, ...tableColumnHooks, ...relationshipHooks]
        .filter(([pattern]) => pattern.map(String).includes(type))
        .map(([, hook]) => hook.name);
    const settled = [
      'recalculateTableWidthHook',
      'validationForeignKeyHook',
      'identificationHook',
      'startRelationshipHook',
    ];

    expect(onLoad(initialLoadJsonAction.type)).toEqual(settled);
    expect(onLoad(loadJsonAction.type)).toEqual(settled);
  });

  it('destroy is safe to call twice', () => {
    const { hooks } = setup();

    hooks.destroy();
    expect(() => hooks.destroy()).not.toThrow();
  });
});
