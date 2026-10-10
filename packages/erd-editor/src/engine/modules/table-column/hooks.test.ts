import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import { ColumnOption, ColumnUIKey } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  initialLoadJsonAction,
  loadJsonAction,
} from '@/engine/modules/editor/atom.actions';
import {
  addRelationshipAction,
  changeRelationshipColumnsAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import {
  addTableAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  removeColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import { hooks } from '@/engine/modules/table-column/hooks';
import type { RxStore } from '@/engine/rx-store';
import { createStore, Store } from '@/engine/store';
import { bHas } from '@/utils/bit';

const HookIndex = {
  changeColumnNotNull: 0,
  validationForeignKey: 1,
} as const;

const settle = () => new Promise(resolve => setTimeout(resolve, 40));
/** The microtasks a dispatch queues and the ones those queue, with no task between. */
const microtasks = async () => {
  for (let index = 0; index < 5; index++) await Promise.resolve();
};

type Runner = {
  store: Store;
  send: (index: number, action: AnyAction) => void;
  /** How many times the hook at an index has read the state, once per run. */
  runs: (index: number) => number;
  destroy: () => void;
};

const runners: Runner[] = [];
const rxStores: RxStore[] = [];

function setup(): Runner {
  const store = createStore({
    toWidth: text => text.length * 10,
    clock: new Clock(),
  });
  const subjects = hooks.map(() => new Subject<AnyAction>());
  const reads = hooks.map(() => vi.fn(() => store.state));
  const subscriptions = hooks.map(([, effect], index) =>
    effect(subjects[index], reads[index], store.context)
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
    runs: index => reads[index].mock.calls.length,
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
  rxStores.splice(0).forEach(store => store.destroy());
});

describe('table-column hooks registration', () => {
  it('registers two hooks against their trigger actions', () => {
    expect(hooks).toHaveLength(2);
    expect(hooks.map(([pattern]) => pattern.map(String))).toEqual([
      [String(changeColumnPrimaryKeyAction)],
      [
        'relationship.add',
        'relationship.remove',
        'relationship.changeColumns',
        'column.add',
        'column.remove',
        'table.add',
        'table.remove',
      ],
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

describe('validationForeignKeyHook as a relationship is added', () => {
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
      HookIndex.validationForeignKey,
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

describe('validationForeignKeyHook as a relationship is removed', () => {
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
      HookIndex.validationForeignKey,
      removeRelationshipAction({ id: 'r1' })
    );
    await settle();

    expect(isForeignKey(store, 'c2')).toBe(true);
  });

  it('ignores an unknown relationship id', async () => {
    const runner = setup();
    addTable(runner.store, 't1', ['c1']);

    runner.send(
      HookIndex.validationForeignKey,
      removeRelationshipAction({ id: 'ghost' })
    );
    await settle();

    expect(isForeignKey(runner.store, 'c1')).toBe(false);
  });
});

describe('the foreign key flags a load writes', () => {
  /** The document as it stands, as a file saving it would hold it. */
  const toValue = ({ state }: Store) =>
    JSON.stringify({
      version: '3.0.0',
      settings: state.settings,
      doc: state.doc,
      collections: state.collections,
    });

  it.each([
    ['loadJson', loadJsonAction],
    ['initialLoadJson', initialLoadJsonAction],
  ])(
    'repairs stale and missing foreign-key flags before %s returns',
    (_, load) => {
      const { store } = setup();
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
      // Corrupt the flags the way a hand-edited document could.
      column(store, 'c3').ui.keys =
        column(store, 'c3').ui.keys & ~ColumnUIKey.foreignKey;
      column(store, 'c2').ui.keys =
        column(store, 'c2').ui.keys | ColumnUIKey.foreignKey;

      store.dispatchSync(load({ value: toValue(store) }));

      expect(isForeignKey(store, 'c3')).toBe(true);
      expect(isForeignKey(store, 'c2')).toBe(false);
    }
  );

  it('preserves the primaryKey bit while clearing a stale foreignKey bit', () => {
    const { store } = setup();
    addTable(store, 't1', ['c1']);
    store.dispatchSync(
      changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true })
    );
    column(store, 'c1').ui.keys =
      column(store, 'c1').ui.keys | ColumnUIKey.foreignKey;

    store.dispatchSync(loadJsonAction({ value: toValue(store) }));

    expect(column(store, 'c1').ui.keys).toBe(ColumnUIKey.primaryKey);
  });

  it('wakes no foreign key hook, whose read would find nothing left to write', async () => {
    const runner = setup();
    addTable(runner.store, 't1', ['c1']);
    await settle();
    const before = runner.runs(HookIndex.validationForeignKey);

    runner.store.dispatchSync(
      initialLoadJsonAction({ value: toValue(runner.store) })
    );
    await settle();

    expect(runner.runs(HookIndex.validationForeignKey)).toBe(before);
  });
});

describe('validationForeignKeyHook reading the document whole', () => {
  const relate = (id: string, startColumnId: string, endColumnId: string) =>
    addRelationshipAction({
      id,
      relationshipType: 4,
      start: { tableId: 't1', columnIds: [startColumnId] },
      end: { tableId: 't2', columnIds: [endColumnId] },
    });

  const remap = (id: string, startColumnId: string, endColumnId: string) =>
    changeRelationshipColumnsAction({
      id,
      start: { tableId: 't1', columnIds: [startColumnId] },
      end: { tableId: 't2', columnIds: [endColumnId] },
    });

  /**
   * A store whose dispatches take the next version, as an editor's do, so a
   * table or column removed and added back lands in its table again.
   */
  function createVersionedStore() {
    const { store } = createTestAppContext();
    rxStores.push(store);
    const isKey = (id: string) =>
      bHas(
        store.state.collections.tableColumnEntities[id].ui.keys,
        ColumnUIKey.foreignKey
      );
    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 0, y: 0, zIndex: 1 } }),
      addColumnAction({ id: 'p1', tableId: 't1' }),
      addColumnAction({ id: 'p2', tableId: 't1' }),
      addTableAction({ id: 't2', ui: { x: 600, y: 0, zIndex: 2 } }),
      addColumnAction({ id: 'c1', tableId: 't2' })
    );
    return { store, isKey };
  }

  it('keeps a column two relationships end on a foreign key once one of them is removed', async () => {
    const { store } = setup();
    addTable(store, 't1', ['p1', 'p2']);
    addTable(store, 't2', ['shared']);
    store.dispatchSync(
      relate('r1', 'p1', 'shared'),
      relate('r2', 'p2', 'shared')
    );
    await settle();

    store.dispatchSync(removeRelationshipAction({ id: 'r1' }));
    await settle();

    expect(isForeignKey(store, 'shared')).toBe(true);
  });

  it('moves the flag with a remap, off the column left behind and onto the new one', async () => {
    const { store } = setup();
    addTable(store, 't1', ['p1']);
    addTable(store, 't2', ['old', 'new']);
    store.dispatchSync(relate('r1', 'p1', 'old'));
    await settle();

    store.dispatchSync(remap('r1', 'p1', 'new'));
    await settle();

    expect(isForeignKey(store, 'old')).toBe(false);
    expect(isForeignKey(store, 'new')).toBe(true);
  });

  it('keeps a shared end column a foreign key through a remap onto a new column and its undo', async () => {
    // The undo of such a remap removes the new column and puts the lists back
    // in one batch; reading one relationship's ends at a time, a peer cleared
    // the column the other relationship still ended on.
    const { store, isKey } = createVersionedStore();
    store.dispatchSync(relate('r1', 'p1', 'c1'), relate('r2', 'p2', 'c1'));
    await settle();

    store.dispatchSync(
      addColumnAction({ id: 'new', tableId: 't2' }),
      remap('r1', 'p1', 'new')
    );
    await settle();
    expect([isKey('c1'), isKey('new')]).toEqual([true, true]);

    store.undo();
    await settle();

    expect(store.state.collections.tableEntities.t2.columnIds).toEqual(['c1']);
    expect(
      store.state.collections.relationshipEntities.r1.end.columnIds
    ).toEqual(['c1']);
    expect(isKey('c1')).toBe(true);
  });

  it('marks a column a relationship came to end on while it was out of its table once it is back', async () => {
    // A peer's relationship can reach a column another peer has just removed,
    // whose undo then brings the column back under it.
    const { store, isKey } = createVersionedStore();
    store.dispatchSync(removeColumnAction({ id: 'c1', tableId: 't2' }));
    store.dispatchSync(relate('r1', 'p1', 'c1'));
    await settle();
    expect(isKey('c1')).toBe(false);

    store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't2' }));
    await settle();

    expect(isKey('c1')).toBe(true);
  });

  it('marks the columns of a table a relationship ends on once the table is back', async () => {
    const { store, isKey } = createVersionedStore();
    store.dispatchSync(removeTableAction({ id: 't2' }));
    store.dispatchSync(relate('r1', 'p1', 'c1'));
    await settle();
    expect(isKey('c1')).toBe(false);

    store.dispatchSync(
      addTableAction({ id: 't2', ui: { x: 600, y: 0, zIndex: 2 } })
    );
    await settle();

    expect(isKey('c1')).toBe(true);
  });

  it('clears the flag of a column taken out of its table while a relationship still ends on it', async () => {
    // The removed column stays in the file until the next load; a bit kept
    // as it was hung on whether a peer heard the removal before the link.
    const { store } = setup();
    addTable(store, 't1', ['p1']);
    addTable(store, 't2', ['c1']);
    store.dispatchSync(relate('r1', 'p1', 'c1'));
    await settle();
    expect(isForeignKey(store, 'c1')).toBe(true);

    store.dispatchSync(removeColumnAction({ id: 'c1', tableId: 't2' }));
    await settle();

    expect(store.state.doc.relationshipIds).toEqual(['r1']);
    expect(isForeignKey(store, 'c1')).toBe(false);
  });

  it('clears the flags of the columns of a removed table while a relationship still ends on them', async () => {
    const { store } = setup();
    addTable(store, 't1', ['p1']);
    addTable(store, 't2', ['c1']);
    store.dispatchSync(relate('r1', 'p1', 'c1'));
    await settle();

    store.dispatchSync(removeTableAction({ id: 't2' }));
    await settle();

    expect(store.state.doc.relationshipIds).toEqual(['r1']);
    expect(isForeignKey(store, 'c1')).toBe(false);
  });

  it('marks only the column a relationship ends on in its own end table', async () => {
    const { store } = setup();
    addTable(store, 't1', ['p1']);
    addTable(store, 't2', ['c1']);
    store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't2', columnIds: ['c1'] },
        end: { tableId: 't1', columnIds: ['c1'] },
      })
    );
    await settle();

    expect(isForeignKey(store, 'c1')).toBe(false);
  });

  it('reads the document once for a paste of five hundred columns, in the microtask after it', async () => {
    const runner = setup();
    const { store } = runner;
    addTable(store, 't1', ['p1']);
    await settle();
    const before = runner.runs(HookIndex.validationForeignKey);
    const columnIds = Array.from({ length: 500 }, (_, index) => `c${index}`);
    const related = columnIds.slice(0, 10);

    store.dispatchSync(
      addTableAction({ id: 't2', ui: { x: 0, y: 0, zIndex: 2 } }),
      ...columnIds.map(id => addColumnAction({ id, tableId: 't2' })),
      ...related.map(id => relate(`r-${id}`, 'p1', id))
    );
    expect(runner.runs(HookIndex.validationForeignKey)).toBe(before);
    await microtasks();

    expect(runner.runs(HookIndex.validationForeignKey)).toBe(before + 1);
    expect(columnIds.filter(id => isForeignKey(store, id))).toEqual(related);
  });
});
