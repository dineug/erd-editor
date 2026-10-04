import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { AnyAction, observer } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { flush } from '@/__test-utils__';
import { BracketType, ColumnOption, Database } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { createHistory } from '@/engine/history';
import { pushHistory } from '@/engine/history.actions';
import {
  addIndexAction,
  changeIndexUniqueAction,
  removeIndexAction,
} from '@/engine/modules/index/atom.actions';
import { addIndexColumnAction } from '@/engine/modules/index-column/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { RootState } from '@/engine/state';
import { createStore } from '@/engine/store';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { createSchemaSQL } from '@/utils/schema-sql';
import {
  getAlternateKeyMarks,
  getAlternateKeys,
  getColumnKeys,
  getTableIndexIds,
  getUniqueIndexKeys,
} from '@/utils/tableKeys';

type IndexSpec = {
  id: string;
  unique: boolean;
  columnIds: string[];
  tableId?: string;
};

/** A region table of five columns, id a to e, and the indexes given in order. */
function createState(
  options: Partial<Record<string, number>> = {},
  indexes: IndexSpec[] = []
) {
  const state = {
    ...schemaV3Parser({}),
    editor: {},
    lww: {},
  } as unknown as RootState;
  const columnIds = ['a', 'b', 'c', 'd', 'e'];

  state.collections.tableColumnEntities = Object.fromEntries(
    columnIds.map(id => [
      id,
      createColumn({
        id,
        tableId: 'region',
        name: `col_${id}`,
        options: options[id] ?? 0,
      }),
    ])
  );
  const table = createTable({ id: 'region', name: 'region', columnIds });
  state.collections.tableEntities = { region: table };
  state.doc.tableIds = ['region'];

  for (const { id, unique, columnIds, tableId = 'region' } of indexes) {
    const index = createIndex({ id, tableId, unique });

    columnIds.forEach(columnId => {
      const indexColumn = createIndexColumn({
        id: `${id}-${columnId}`,
        indexId: id,
        columnId,
      });
      index.indexColumnIds.push(indexColumn.id);
      state.collections.indexColumnEntities[indexColumn.id] = indexColumn;
    });

    state.collections.indexEntities[id] = index;
    state.doc.indexIds.push(id);
  }

  return { state, table };
}

describe('getColumnKeys', () => {
  it('lists the primary key and then each unique column in column order', () => {
    const { state, table } = createState({
      a: ColumnOption.primaryKey,
      b: ColumnOption.primaryKey | ColumnOption.unique,
      d: ColumnOption.unique,
    });

    expect(getColumnKeys(state, table)).toEqual([
      {
        id: 'primaryKey:region',
        kind: 'primaryKey',
        name: 'PK_region',
        columnIds: ['a', 'b'],
      },
      {
        id: 'unique:b',
        kind: 'unique',
        name: 'UQ_region_col_b',
        columnIds: ['b'],
      },
      {
        id: 'unique:d',
        kind: 'unique',
        name: 'UQ_region_col_d',
        columnIds: ['d'],
      },
    ]);
  });

  it('names the keys after the table part of an unquoted dotted name, as the DDL does', () => {
    const { state, table } = createState({
      a: ColumnOption.primaryKey,
      b: ColumnOption.unique,
    });
    table.name = 'sales.region';

    expect(getColumnKeys(state, table).map(({ name }) => name)).toEqual([
      'PK_region',
      'UQ_region_col_b',
    ]);

    state.settings.bracketType = BracketType.doubleQuote;

    expect(getColumnKeys(state, table).map(({ name }) => name)).toEqual([
      'PK_sales.region',
      'UQ_sales.region_col_b',
    ]);
  });

  it('gives the primary key the name each database writes for a dotted table', () => {
    const cases = [
      [Database.MSSQL, 'PK_region'],
      [Database.Oracle, 'PK_region'],
      [Database.Databricks, 'PK_sales.region'],
      [Database.Snowflake, 'PK_sales.region'],
    ] as const;

    for (const [database, name] of cases) {
      const { state, table } = createState({
        a: ColumnOption.primaryKey,
        b: ColumnOption.unique,
      });
      table.name = 'sales.region';
      state.settings.database = database;

      const [primaryKey, unique] = getColumnKeys(state, table);

      expect(primaryKey.name).toBe(name);
      expect(unique.name).toBe(name.replace('PK_', 'UQ_') + '_col_b');
      expect(createSchemaSQL(state)).toContain(name);
    }
  });

  it('lists nothing for a table whose columns declare no key', () => {
    const { state, table } = createState({ a: ColumnOption.notNull });

    expect(getColumnKeys(state, table)).toEqual([]);
  });
});

describe('getUniqueIndexKeys', () => {
  it('lists every unique index of the table in list order, over the columns still in it', () => {
    const { state, table } = createState({}, [
      { id: 'i1', unique: true, columnIds: ['d', 'e'] },
      { id: 'i2', unique: false, columnIds: ['a'] },
      { id: 'i3', unique: true, columnIds: ['gone', 'b'] },
      { id: 'i4', unique: true, columnIds: ['a'], tableId: 'other' },
      { id: 'i5', unique: true, columnIds: [] },
    ]);

    expect(getUniqueIndexKeys(state, table)).toEqual([
      { indexId: 'i1', columnIds: ['d', 'e'] },
      { indexId: 'i3', columnIds: ['b'] },
      { indexId: 'i5', columnIds: [] },
    ]);
  });
});

describe('getAlternateKeys', () => {
  it('keys the unique indexes of the table over two columns or more', () => {
    const { state, table } = createState({}, [
      { id: 'i1', unique: false, columnIds: ['a', 'b'] },
      { id: 'i2', unique: true, columnIds: ['c', 'b'] },
      { id: 'i3', unique: true, columnIds: ['d'] },
      { id: 'i4', unique: true, columnIds: ['a', 'b'], tableId: 'other' },
    ]);

    expect(getAlternateKeys(state, table)).toEqual([
      { indexId: 'i2', columnIds: ['c', 'b'] },
    ]);
  });

  it('keeps only the columns still in the table, and no key left with one', () => {
    const { state, table } = createState({}, [
      { id: 'i1', unique: true, columnIds: ['gone', 'b'] },
      { id: 'i2', unique: true, columnIds: ['a', 'gone', 'e'] },
      { id: 'i3', unique: true, columnIds: [] },
    ]);

    expect(getAlternateKeys(state, table)).toEqual([
      { indexId: 'i2', columnIds: ['a', 'e'] },
    ]);
  });

  it('orders the keys by where their columns stand, never by the index list', () => {
    const { state, table } = createState({}, [
      { id: 'i1', unique: true, columnIds: ['d', 'e'] },
      { id: 'i2', unique: true, columnIds: ['b', 'e'] },
      { id: 'i3', unique: true, columnIds: ['b', 'c', 'a'] },
      { id: 'i4', unique: true, columnIds: ['b', 'c'] },
      { id: 'z9', unique: true, columnIds: ['a', 'd'] },
      { id: 'z0', unique: true, columnIds: ['a', 'd'] },
    ]);

    expect(getAlternateKeys(state, table).map(key => key.indexId)).toEqual([
      'z0',
      'z9',
      'i4',
      'i3',
      'i2',
      'i1',
    ]);
  });
});

describe('getTableIndexIds', () => {
  it('lists the indexes of each table in the order of the list', () => {
    const { state } = createState({}, [
      { id: 'i1', unique: true, columnIds: ['a', 'b'] },
      { id: 'i2', unique: false, columnIds: ['a'], tableId: 'other' },
      { id: 'i3', unique: false, columnIds: ['c'] },
    ]);

    expect(getTableIndexIds(state, 'region')).toEqual(['i1', 'i3']);
    expect(getTableIndexIds(state, 'other')).toEqual(['i2']);
    expect(getTableIndexIds(state, 'none')).toEqual([]);
  });

  it('reads the list once for every table it answers', () => {
    const { state } = createState(
      {},
      Array.from({ length: 40 }, (_, index) => ({
        id: `i${index}`,
        unique: true,
        columnIds: ['a', 'b'],
        tableId: `t${index % 20}`,
      }))
    );
    let reads = 0;
    state.doc.indexIds = new Proxy([...state.doc.indexIds], {
      get(target, p, receiver) {
        if (typeof p === 'string' && /^\d+$/.test(p)) reads++;
        return Reflect.get(target, p, receiver);
      },
    });

    for (let index = 0; index < 20; index++) {
      expect(getTableIndexIds(state, `t${index}`)).toEqual([
        `i${index}`,
        `i${index + 20}`,
      ]);
    }
    expect(reads).toBe(40);
  });

  it('groups again after the list or the entities are replaced', () => {
    const { state } = createState({}, [
      { id: 'i1', unique: true, columnIds: ['a', 'b'] },
      { id: 'i2', unique: true, columnIds: ['a'], tableId: 'other' },
    ]);
    expect(getTableIndexIds(state, 'region')).toEqual(['i1']);

    state.doc.indexIds = ['i2'];
    expect(getTableIndexIds(state, 'region')).toEqual([]);

    state.collections.indexEntities = {
      i2: createIndex({ id: 'i2', tableId: 'region' }),
    };
    expect(getTableIndexIds(state, 'region')).toEqual(['i2']);
  });
});

describe('alternate key numbers under undo and collaboration', () => {
  const tableId = 'region';

  /** Adds a unique index over the columns given, as the Indexes tab does. */
  const addUniqueIndex = (id: string, columnIds: string[]): AnyAction[] => [
    addIndexAction({ id, tableId }),
    changeIndexUniqueAction({ id, tableId, value: true }),
    ...columnIds.map(columnId =>
      addIndexColumnAction({
        id: `${id}-${columnId}`,
        indexId: id,
        tableId,
        columnId,
      })
    ),
  ];

  function setup() {
    const clock = new Clock();
    const store = createStore({ toWidth: text => text.length, clock });
    store.subscribe(list =>
      list.forEach(action => clock.merge(action.version))
    );
    const history = createHistory({
      notify: () => {},
      dispatch: actions => store.dispatchSync(actions),
      getNextVersion: () => clock.getNextVersion(),
    });
    store.dispatchSync(
      ['a', 'b', 'c', 'd'].map(id => addColumnAction({ id, tableId }))
    );

    const marks = () =>
      getAlternateKeyMarks(
        store.state,
        store.state.collections.tableEntities[tableId]
      );

    return { store, history, marks, push: pushHistory(store, history) };
  }

  it('gives an index back its number when its removal is undone', () => {
    const { store, history, marks, push } = setup();
    store.dispatchSync([
      ...addUniqueIndex('u1', ['a', 'b']),
      ...addUniqueIndex('u2', ['c', 'd']),
    ]);
    const before = marks();

    const remove = removeIndexAction({ id: 'u1' });
    push([remove]);
    store.dispatchSync(remove);
    expect(marks()).toEqual({ c: 'AK1.1', d: 'AK1.2' });

    history.undo();

    expect(store.state.doc.indexIds).toEqual(['u2', 'u1']);
    expect(before).toEqual({
      a: 'AK1.1',
      b: 'AK1.2',
      c: 'AK2.1',
      d: 'AK2.2',
    });
    expect(marks()).toEqual(before);
  });

  it('follows each add and drop that goes through the reducers', () => {
    const { store, marks } = setup();
    store.dispatchSync(
      addColumnAction({ id: 'x', tableId: 'other' }),
      addColumnAction({ id: 'y', tableId: 'other' }),
      ...addUniqueIndex('u1', ['a', 'b'])
    );
    expect(marks()).toEqual({ a: 'AK1.1', b: 'AK1.2' });

    store.dispatchSync(
      addIndexAction({ id: 'o1', tableId: 'other' }),
      ...addUniqueIndex('u2', ['c', 'd'])
    );
    expect(marks()).toEqual({
      a: 'AK1.1',
      b: 'AK1.2',
      c: 'AK2.1',
      d: 'AK2.2',
    });

    store.dispatchSync(removeIndexAction({ id: 'u1' }));
    expect(marks()).toEqual({ c: 'AK1.1', d: 'AK1.2' });
  });

  it('redraws a table on its own keys and on any add or drop, not on another table key', async () => {
    const { store, marks } = setup();
    store.dispatchSync(
      ...addUniqueIndex('u1', ['a', 'b']),
      ...addUniqueIndex('o1', ['x', 'y']).map(action => ({
        ...action,
        payload: { ...action.payload, tableId: 'other' },
      }))
    );
    let runs = 0;
    let seen: Record<string, string> = {};
    const unobserve = observer(() => {
      seen = marks();
      runs++;
    });
    expect(runs).toBe(1);

    store.dispatchSync(
      changeIndexUniqueAction({ id: 'o1', tableId: 'other', value: false })
    );
    await flush();
    expect(runs).toBe(1);

    store.dispatchSync(
      changeIndexUniqueAction({ id: 'u1', tableId, value: false })
    );
    await flush();
    expect(runs).toBe(2);
    expect(seen).toEqual({});

    store.dispatchSync(...addUniqueIndex('u2', ['c', 'd']));
    await flush();
    expect(runs).toBe(3);
    expect(seen).toEqual({ c: 'AK1.1', d: 'AK1.2' });
    unobserve();
  });

  it('numbers the same on two replicas that received the adds in turn', () => {
    const first = setup();
    const second = setup();
    const ua = addUniqueIndex('ua', ['c', 'd']).map(action => ({
      ...action,
      version: 10,
    }));
    const ub = addUniqueIndex('ub', ['a', 'b']).map(action => ({
      ...action,
      version: 11,
    }));

    first.store.dispatchSync([...ua, ...ub]);
    second.store.dispatchSync([...ub, ...ua]);

    expect(first.store.state.doc.indexIds).toEqual(['ua', 'ub']);
    expect(second.store.state.doc.indexIds).toEqual(['ub', 'ua']);
    expect(first.marks()).toEqual(second.marks());
    expect(first.marks()).toEqual({
      a: 'AK1.1',
      b: 'AK1.2',
      c: 'AK2.1',
      d: 'AK2.2',
    });
  });
});

describe('getAlternateKeyMarks', () => {
  it('marks each member with its key and its place in the key', () => {
    const { state, table } = createState({}, [
      { id: 'i1', unique: true, columnIds: ['c', 'a'] },
      { id: 'i2', unique: true, columnIds: ['b', 'a'] },
      { id: 'i3', unique: false, columnIds: ['d', 'e'] },
      { id: 'i4', unique: true, columnIds: ['e'] },
    ]);

    expect(getAlternateKeyMarks(state, table)).toEqual({
      a: 'AK1.2,AK2.2',
      b: 'AK1.1',
      c: 'AK2.1',
    });
  });

  it('marks nothing for a table without a unique index', () => {
    const { state, table } = createState();

    expect(getAlternateKeyMarks(state, table)).toEqual({});
  });
});
