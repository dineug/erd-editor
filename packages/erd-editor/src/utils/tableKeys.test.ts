import { schemaV3Parser } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { ColumnOption } from '@/constants/schema';
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
import {
  getAlternateKeyMarks,
  getAlternateKeys,
  getColumnKeys,
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

  it('lists nothing for a table whose columns declare no key', () => {
    const { state, table } = createState({ a: ColumnOption.notNull });

    expect(getColumnKeys(state, table)).toEqual([]);
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
