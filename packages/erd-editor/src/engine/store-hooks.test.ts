import { query } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption, ColumnUIKey } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
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

  it('destroy is safe to call twice', () => {
    const { hooks } = setup();

    hooks.destroy();
    expect(() => hooks.destroy()).not.toThrow();
  });
});
