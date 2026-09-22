import { AnyAction, compositionActionsFlat } from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { ColumnOption, RelationshipType } from '@/constants/schema';
import { actions as rootActions } from '@/engine/actions';
import { Clock } from '@/engine/clock';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  actions$,
  addRelationshipAction$,
} from '@/engine/modules/relationship/generator.actions';
import {
  addTableAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { createRxStore, RxStore } from '@/engine/rx-store';
import { createStore, Store } from '@/engine/store';
import { bHas } from '@/utils/bit';

const ids = vi.hoisted(() => ({ next: 0 }));

vi.mock('nanoid', () => ({ nanoid: () => `id-${++ids.next}` }));

type SeedColumn = {
  id: string;
  name: string;
  dataType: string;
  default: string;
  comment: string;
  primaryKey: boolean;
};

const toWidth = (text: string) => text.length * 10;

const idColumn: SeedColumn = {
  id: 'c1',
  name: 'id',
  dataType: 'int',
  default: '0',
  comment: 'pk',
  primaryKey: true,
};
const codeColumn: SeedColumn = {
  id: 'c2',
  name: 'code',
  dataType: 'varchar(8)',
  default: '',
  comment: 'second key',
  primaryKey: true,
};
const nameColumn: SeedColumn = {
  id: 'c3',
  name: 'name',
  dataType: 'text',
  default: 'n/a',
  comment: 'not a key',
  primaryKey: false,
};
const emptyColumn = { name: '', dataType: '', default: '', comment: '' };

function seedTable(
  store: Store | RxStore,
  id: string,
  columns: SeedColumn[] = []
) {
  store.dispatchSync(addTableAction({ id, ui: { x: 0, y: 0, zIndex: 2 } }));

  for (const column of columns) {
    const payload = { id: column.id, tableId: id };
    store.dispatchSync(
      addColumnAction(payload),
      changeColumnPrimaryKeyAction({ ...payload, value: column.primaryKey }),
      changeColumnNameAction({ ...payload, value: column.name }),
      changeColumnDataTypeAction({ ...payload, value: column.dataType }),
      changeColumnDefaultAction({ ...payload, value: column.default }),
      changeColumnCommentAction({ ...payload, value: column.comment })
    );
  }
}

function foreignKeyActions(
  id: string,
  tableId: string,
  column: Omit<SeedColumn, 'id' | 'primaryKey'>
): AnyAction[] {
  const payload = { id, tableId };
  return [
    addColumnAction(payload),
    changeColumnNotNullAction({ ...payload, value: true }),
    changeColumnNameAction({ ...payload, value: column.name }),
    changeColumnDataTypeAction({ ...payload, value: column.dataType }),
    changeColumnDefaultAction({ ...payload, value: column.default }),
    changeColumnCommentAction({ ...payload, value: column.comment }),
  ];
}

function yieldsOf(
  store: Store,
  action: ReturnType<typeof addRelationshipAction$>
) {
  ids.next = 0;
  return [...(action(store.state, store.context) as Iterable<unknown>)];
}

describe('addRelationshipAction$', () => {
  let store: Store;

  beforeEach(() => {
    store = createStore({ toWidth, clock: new Clock() });
  });

  afterEach(() => {
    store.destroy();
  });

  it('yields nothing when the start table is unknown', () => {
    seedTable(store, 't2', [idColumn]);

    expect(
      yieldsOf(
        store,
        addRelationshipAction$('ghost', 't2', RelationshipType.OneN)
      )
    ).toEqual([]);
  });

  it('yields nothing when the end table is unknown', () => {
    seedTable(store, 't1', [idColumn]);

    expect(
      yieldsOf(
        store,
        addRelationshipAction$('t1', 'ghost', RelationshipType.OneN)
      )
    ).toEqual([]);
  });

  it('yields nothing for a removed table that is still kept as a tombstone', () => {
    seedTable(store, 't1', [idColumn]);
    seedTable(store, 't2');
    store.dispatchSync(removeTableAction({ id: 't2' }));

    expect(store.state.collections.tableEntities.t2).toBeDefined();
    expect(
      yieldsOf(store, addRelationshipAction$('t1', 't2', RelationshipType.OneN))
    ).toEqual([]);
  });

  it('copies every primary key of the start table in one array', () => {
    seedTable(store, 't1', [idColumn, nameColumn, codeColumn]);
    seedTable(store, 't2');

    expect(
      yieldsOf(store, addRelationshipAction$('t1', 't2', RelationshipType.OneN))
    ).toEqual([
      [
        ...foreignKeyActions('id-1', 't2', idColumn),
        ...foreignKeyActions('id-2', 't2', codeColumn),
        addRelationshipAction({
          id: 'id-3',
          relationshipType: RelationshipType.OneN,
          start: { tableId: 't1', columnIds: ['c1', 'c2'] },
          end: { tableId: 't2', columnIds: ['id-1', 'id-2'] },
        }),
      ],
    ]);
  });

  it('creates a primary key first and starts the relationship from it', () => {
    seedTable(store, 't1', [nameColumn]);
    seedTable(store, 't2');

    expect(
      yieldsOf(
        store,
        addRelationshipAction$('t1', 't2', RelationshipType.ZeroN)
      )
    ).toEqual([
      [
        addColumnAction({ id: 'id-1', tableId: 't1' }),
        changeColumnPrimaryKeyAction({
          id: 'id-1',
          tableId: 't1',
          value: true,
        }),
        ...foreignKeyActions('id-2', 't2', emptyColumn),
        addRelationshipAction({
          id: 'id-3',
          relationshipType: RelationshipType.ZeroN,
          start: { tableId: 't1', columnIds: ['id-1'] },
          end: { tableId: 't2', columnIds: ['id-2'] },
        }),
      ],
    ]);
  });

  it('copies onto the start table when it is also the end table', () => {
    seedTable(store, 't1', [idColumn]);

    expect(
      yieldsOf(
        store,
        addRelationshipAction$('t1', 't1', RelationshipType.OneOnly)
      )
    ).toEqual([
      [
        ...foreignKeyActions('id-1', 't1', idColumn),
        addRelationshipAction({
          id: 'id-2',
          relationshipType: RelationshipType.OneOnly,
          start: { tableId: 't1', columnIds: ['c1'] },
          end: { tableId: 't1', columnIds: ['id-1'] },
        }),
      ],
    ]);
  });

  it('creates the primary key on a self relationship without one as well', () => {
    seedTable(store, 't1');

    const flat = compositionActionsFlat(store.state, store.context, [
      addRelationshipAction$('t1', 't1', RelationshipType.OneN),
    ]);

    expect(flat.map(({ type }) => type)).toEqual([
      'column.add',
      'column.changePrimaryKey',
      'column.add',
      'column.changeNotNull',
      'column.changeName',
      'column.changeDataType',
      'column.changeDefault',
      'column.changeComment',
      'relationship.add',
    ]);
    const [primaryKey, foreignKey] = flat
      .filter(({ type }) => type === 'column.add')
      .map(({ payload }) => payload);
    expect(primaryKey.tableId).toBe('t1');
    expect(foreignKey.tableId).toBe('t1');
    expect(flat[flat.length - 1].payload).toMatchObject({
      start: { tableId: 't1', columnIds: [primaryKey.id] },
      end: { tableId: 't1', columnIds: [foreignKey.id] },
    });
  });
});

describe('addRelationshipAction$ through a real store', () => {
  const stores: RxStore[] = [];

  function createRxTestStore(): RxStore {
    const rxStore = createRxStore({ toWidth, clock: new Clock() });
    stores.push(rxStore);
    return rxStore;
  }

  function dispatchCountingBatches(rxStore: RxStore, action: unknown) {
    const batches: AnyAction[][] = [];
    const unsubscribe = rxStore.subscribe(actions => batches.push(actions));
    rxStore.dispatchSync(action as any);
    unsubscribe();
    return batches;
  }

  function relationshipsOf(rxStore: RxStore) {
    const { doc, collections } = rxStore.state;
    return doc.relationshipIds.map(id => collections.relationshipEntities[id]);
  }

  function columnOf(rxStore: RxStore, id: string) {
    return rxStore.state.collections.tableColumnEntities[id];
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    while (stores.length) {
      stores.pop()?.destroy();
    }
  });

  it('records one batch and one history entry when the start table has a key', () => {
    const rxStore = createRxTestStore();
    seedTable(rxStore, 't1', [idColumn, codeColumn]);
    seedTable(rxStore, 't2');
    vi.advanceTimersByTime(300);
    const size = rxStore.history.size;

    const batches = dispatchCountingBatches(
      rxStore,
      addRelationshipAction$('t1', 't2', RelationshipType.OneN)
    );

    expect(batches).toHaveLength(1);
    expect(rxStore.history.size).toBe(size + 1);

    const [relationship] = relationshipsOf(rxStore);
    expect(relationship.relationshipType).toBe(RelationshipType.OneN);
    expect(relationship.start).toMatchObject({
      tableId: 't1',
      columnIds: ['c1', 'c2'],
    });
    expect(relationship.end.tableId).toBe('t2');
    expect(rxStore.state.collections.tableEntities.t2.columnIds).toEqual(
      relationship.end.columnIds
    );

    const [idCopy, codeCopy] = relationship.end.columnIds.map(id =>
      columnOf(rxStore, id)
    );
    expect(idCopy).toMatchObject({
      tableId: 't2',
      name: 'id',
      dataType: 'int',
      default: '0',
      comment: 'pk',
    });
    expect(codeCopy).toMatchObject({
      tableId: 't2',
      name: 'code',
      dataType: 'varchar(8)',
      default: '',
      comment: 'second key',
    });
    for (const column of [idCopy, codeCopy]) {
      expect(bHas(column.options, ColumnOption.notNull)).toBe(true);
      expect(bHas(column.options, ColumnOption.primaryKey)).toBe(false);
    }

    vi.advanceTimersByTime(300);
    expect(rxStore.history.size).toBe(size + 1);

    rxStore.undo();

    expect(rxStore.state.doc.relationshipIds).toEqual([]);
    expect(rxStore.state.collections.tableEntities.t2.columnIds).toEqual([]);
  });

  it('records one batch and one history entry when it creates the key', () => {
    const rxStore = createRxTestStore();
    seedTable(rxStore, 't1', [nameColumn]);
    seedTable(rxStore, 't2');
    vi.advanceTimersByTime(300);
    const size = rxStore.history.size;

    const batches = dispatchCountingBatches(
      rxStore,
      addRelationshipAction$('t1', 't2', RelationshipType.ZeroOne)
    );

    expect(batches).toHaveLength(1);
    expect(rxStore.history.size).toBe(size + 1);

    const [relationship] = relationshipsOf(rxStore);
    const [primaryKeyId] = relationship.start.columnIds;
    expect(relationship.start.columnIds).toHaveLength(1);
    expect(rxStore.state.collections.tableEntities.t1.columnIds).toEqual([
      'c3',
      primaryKeyId,
    ]);
    expect(
      bHas(columnOf(rxStore, primaryKeyId).options, ColumnOption.primaryKey)
    ).toBe(true);

    const [foreignKeyId] = relationship.end.columnIds;
    expect(columnOf(rxStore, foreignKeyId)).toMatchObject({
      tableId: 't2',
      ...emptyColumn,
    });
    expect(
      bHas(columnOf(rxStore, foreignKeyId).options, ColumnOption.notNull)
    ).toBe(true);

    vi.advanceTimersByTime(300);
    expect(rxStore.history.size).toBe(size + 1);

    rxStore.undo();

    expect(rxStore.state.doc.relationshipIds).toEqual([]);
    expect(rxStore.state.collections.tableEntities.t1.columnIds).toEqual([
      'c3',
    ]);
    expect(rxStore.state.collections.tableEntities.t2.columnIds).toEqual([]);

    rxStore.redo();

    expect(rxStore.state.doc.relationshipIds).toEqual([relationship.id]);
    expect(rxStore.state.collections.tableEntities.t1.columnIds).toEqual([
      'c3',
      primaryKeyId,
    ]);
  });

  it('dispatches nothing and records no history for an unknown table', () => {
    const rxStore = createRxTestStore();
    seedTable(rxStore, 't1', [idColumn]);
    vi.advanceTimersByTime(300);
    const size = rxStore.history.size;

    const batches = dispatchCountingBatches(
      rxStore,
      addRelationshipAction$('t1', 'ghost', RelationshipType.OneN)
    );

    expect(batches).toEqual([]);
    expect(rxStore.history.size).toBe(size);
    expect(rxStore.state.doc.relationshipIds).toEqual([]);
  });
});

describe('relationship/generator.actions registry', () => {
  it('exposes the relationship generator through actions$', () => {
    expect(Object.keys(actions$)).toEqual(['addRelationshipAction$']);
    expect(actions$.addRelationshipAction$).toBe(addRelationshipAction$);
  });

  it('reaches the root action registry beside the atom action it wraps', () => {
    expect(
      Object.keys(rootActions).filter(key => key.startsWith('addRelationship'))
    ).toEqual(['addRelationshipAction', 'addRelationshipAction$']);
    expect(rootActions.addRelationshipAction$).toBe(addRelationshipAction$);
    expect(rootActions.addRelationshipAction).toBe(addRelationshipAction);
  });
});
