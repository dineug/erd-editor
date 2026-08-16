import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { ColumnOption, ColumnUIKey } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  initialLoadJsonAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import {
  addRelationshipAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { hooks } from '@/engine/modules/table-column/hooks';
import { createStore, Store } from '@/engine/store';
import { bHas } from '@/utils/bit';

const HookIndex = {
  changeColumnNotNull: 0,
  addColumnForeignKey: 1,
  removeColumnForeignKey: 2,
  validationForeignKey: 3,
} as const;

const settle = () => new Promise(resolve => setTimeout(resolve, 40));

type Runner = {
  store: Store;
  send: (index: number, action: AnyAction) => void;
  destroy: () => void;
};

const runners: Runner[] = [];

function setup(): Runner {
  const store = createStore({
    toWidth: text => text.length * 10,
    clock: new Clock(),
  });
  const subjects = hooks.map(() => new Subject<AnyAction>());
  const subscriptions = hooks.map(([, effect], index) =>
    effect(subjects[index], () => store.state, store.context)
  );
  const patterns = hooks.map(([pattern]) => pattern.map(String));

  const unsubscribe = store.subscribe(actions => {
    for (const action of actions) {
      patterns.forEach((types, index) => {
        if (types.includes(action.type)) {
          subjects[index].next(action);
        }
      });
    }
  });

  const runner: Runner = {
    store,
    send: (index, action) => subjects[index].next(action),
    destroy: () => {
      subscriptions.forEach(subscription => subscription.unsubscribe());
      subjects.forEach(subject => subject.complete());
      unsubscribe();
      store.destroy();
    },
  };

  runners.push(runner);
  return runner;
}

function addTable(store: Store, id: string, columnIds: string[] = []) {
  store.dispatchSync(addTableAction({ id, ui: { x: 0, y: 0, zIndex: 1 } }));
  for (const columnId of columnIds) {
    store.dispatchSync(addColumnAction({ id: columnId, tableId: id }));
  }
}

const column = (store: Store, id: string) =>
  query(store.state.collections)
    .collection('tableColumnEntities')
    .selectById(id)!;

const isForeignKey = (store: Store, id: string) =>
  bHas(column(store, id).ui.keys, ColumnUIKey.foreignKey);

afterEach(() => {
  runners.splice(0, runners.length).forEach(runner => runner.destroy());
});

describe('table-column hooks registration', () => {
  it('registers four hooks against their trigger actions', () => {
    expect(hooks).toHaveLength(4);
    expect(hooks.map(([pattern]) => pattern.map(String))).toEqual([
      [String(changeColumnPrimaryKeyAction)],
      [String(addRelationshipAction)],
      [String(removeRelationshipAction)],
      [String(loadJsonAction), String(initialLoadJsonAction)],
    ]);
  });
});

describe('changeColumnNotNullHook', () => {
  it('forces notNull on when a column becomes a primary key', async () => {
    const { store } = setup();
    addTable(store, 't1', ['c1']);

    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true })
    );
    expect(bHas(column(store, 'c1').options, ColumnOption.notNull)).toBe(false);

    await settle();

    expect(bHas(column(store, 'c1').options, ColumnOption.notNull)).toBe(true);
    expect(bHas(column(store, 'c1').options, ColumnOption.primaryKey)).toBe(
      true
    );
  });

  it('leaves a column that was un-set as primary key alone', async () => {
    const { store } = setup();
    addTable(store, 't1', ['c1']);

    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: false })
    );
    await settle();

    expect(column(store, 'c1').options).toBe(0);
  });

  it('is a no-op when the column is already notNull', async () => {
    const { store } = setup();
    addTable(store, 't1', ['c1']);
    store.dispatchSync(
      changeColumnNotNullAction({ tableId: 't1', id: 'c1', value: true })
    );

    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true })
    );
    await settle();

    expect(column(store, 'c1').options).toBe(
      ColumnOption.notNull | ColumnOption.primaryKey
    );
  });

  it('ignores an action for a column that does not exist', async () => {
    const runner = setup();
    addTable(runner.store, 't1', ['c1']);

    runner.send(
      HookIndex.changeColumnNotNull,
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'ghost', value: true })
    );
    await settle();

    expect(
      query(runner.store.state.collections)
        .collection('tableColumnEntities')
        .selectById('ghost')
    ).toBeUndefined();
  });
});

describe('addColumnForeignKeyHook', () => {
  it('marks the end columns of a new relationship as foreign keys', async () => {
    const { store } = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2', 'c3']);

    store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't2', columnIds: ['c2', 'c3'] },
      })
    );
    await settle();

    expect(isForeignKey(store, 'c2')).toBe(true);
    expect(isForeignKey(store, 'c3')).toBe(true);
    expect(isForeignKey(store, 'c1')).toBe(false);
  });

  it('ignores a relationship that is not registered in the document', async () => {
    const runner = setup();
    addTable(runner.store, 't1', ['c1']);
    addTable(runner.store, 't2', ['c2']);

    runner.send(
      HookIndex.addColumnForeignKey,
      addRelationshipAction({
        id: 'unregistered',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't2', columnIds: ['c2'] },
      })
    );
    await settle();

    expect(isForeignKey(runner.store, 'c2')).toBe(false);
  });
});

describe('removeColumnForeignKeyHook', () => {
  it('clears the foreign-key flag once the relationship is gone', async () => {
    const { store } = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't2', columnIds: ['c2'] },
      })
    );
    await settle();
    expect(isForeignKey(store, 'c2')).toBe(true);

    store.dispatchSync(removeRelationshipAction({ id: 'r1' }));
    await settle();

    expect(store.state.doc.relationshipIds).toEqual([]);
    expect(isForeignKey(store, 'c2')).toBe(false);
  });

  it('keeps the flag while the relationship is still registered', async () => {
    const runner = setup();
    const { store } = runner;
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't2', columnIds: ['c2'] },
      })
    );
    await settle();

    runner.send(
      HookIndex.removeColumnForeignKey,
      removeRelationshipAction({ id: 'r1' })
    );
    await settle();

    expect(isForeignKey(store, 'c2')).toBe(true);
  });

  it('ignores an unknown relationship id', async () => {
    const runner = setup();
    addTable(runner.store, 't1', ['c1']);

    runner.send(
      HookIndex.removeColumnForeignKey,
      removeRelationshipAction({ id: 'ghost' })
    );
    await settle();

    expect(isForeignKey(runner.store, 'c1')).toBe(false);
  });
});

describe('validationForeignKeyHook', () => {
  it('repairs stale and missing foreign-key flags on load', async () => {
    const runner = setup();
    const { store } = runner;
    addTable(store, 't1', ['c1', 'c2']);
    addTable(store, 't2', ['c3']);
    store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't2', columnIds: ['c3'] },
      })
    );
    await settle();

    // Corrupt the flags the way a hand-edited document could.
    column(store, 'c3').ui.keys =
      column(store, 'c3').ui.keys & ~ColumnUIKey.foreignKey;
    column(store, 'c2').ui.keys =
      column(store, 'c2').ui.keys | ColumnUIKey.foreignKey;

    runner.send(HookIndex.validationForeignKey, loadJsonAction({ value: '' }));
    await settle();

    expect(isForeignKey(store, 'c3')).toBe(true);
    expect(isForeignKey(store, 'c2')).toBe(false);
  });

  it('preserves the primaryKey bit while clearing a stale foreignKey bit', async () => {
    const runner = setup();
    const { store } = runner;
    addTable(store, 't1', ['c1']);
    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true })
    );
    column(store, 'c1').ui.keys =
      column(store, 'c1').ui.keys | ColumnUIKey.foreignKey;

    runner.send(HookIndex.validationForeignKey, loadJsonAction({ value: '' }));
    await settle();

    expect(column(store, 'c1').ui.keys).toBe(ColumnUIKey.primaryKey);
  });

  it('runs for initialLoadJson dispatched through the store', async () => {
    const { store } = setup();
    addTable(store, 't1', ['c1']);
    addTable(store, 't2', ['c2']);
    store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't2', columnIds: ['c2'] },
      })
    );
    column(store, 'c1').ui.keys =
      column(store, 'c1').ui.keys | ColumnUIKey.foreignKey;

    const value = JSON.stringify({
      version: '3.0.0',
      settings: store.state.settings,
      doc: store.state.doc,
      collections: store.state.collections,
    });

    store.dispatchSync(initialLoadJsonAction({ value }));
    await settle();

    expect(isForeignKey(store, 'c1')).toBe(false);
    expect(isForeignKey(store, 'c2')).toBe(true);
  });
});
