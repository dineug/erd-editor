import { describe, expect, it } from 'vite-plus/test';

import {
  addMapColumn,
  createMapStore,
  seedMapTable,
} from '@/__test-utils__/mapColumnsSeed';
import { removeColumnAction } from '@/engine/modules/table-column/atom.actions';
import {
  CURRENT_KEY_ID,
  findColumnKey,
  getCandidateKeys,
  toCurrentKey,
} from '@/utils/map-columns/candidateKeys';

const tableOf = (store: ReturnType<typeof createMapStore>, id: string) =>
  store.state.collections.tableEntities[id];

describe('getCandidateKeys', () => {
  it('lists the primary key in column order, then each unique column', () => {
    const store = createMapStore();
    seedMapTable(store, 'p', 'orders', [
      { id: 'code', primaryKey: true },
      { id: 'email', unique: true },
      { id: 'id', primaryKey: true },
      { id: 'sku', unique: true },
      { id: 'note' },
    ]);

    expect(getCandidateKeys(store.state, tableOf(store, 'p'))).toEqual([
      { id: 'primaryKey:p', kind: 'primaryKey', columnIds: ['code', 'id'] },
      { id: 'unique:email', kind: 'unique', columnIds: ['email'] },
      { id: 'unique:sku', kind: 'unique', columnIds: ['sku'] },
    ]);
  });

  it('keeps one key over the same columns, the primary key over a unique column', () => {
    const store = createMapStore();
    seedMapTable(store, 'p', 'users', [
      { id: 'id', primaryKey: true, unique: true },
      { id: 'email', unique: true },
    ]);

    expect(getCandidateKeys(store.state, tableOf(store, 'p'))).toEqual([
      { id: 'primaryKey:p', kind: 'primaryKey', columnIds: ['id'] },
      { id: 'unique:email', kind: 'unique', columnIds: ['email'] },
    ]);
  });

  it('keeps a unique column that is one column of a composite primary key', () => {
    const store = createMapStore();
    seedMapTable(store, 'p', 'users', [
      { id: 'tenant', primaryKey: true, unique: true },
      { id: 'id', primaryKey: true },
    ]);

    expect(
      getCandidateKeys(store.state, tableOf(store, 'p')).map(({ id }) => id)
    ).toEqual(['primaryKey:p', 'unique:tenant']);
  });

  it('lists unique columns alone on a table without a primary key, and nothing on one without keys', () => {
    const store = createMapStore();
    seedMapTable(store, 'p', 'vehicle', [{ id: 'vin', unique: true }]);
    seedMapTable(store, 'q', 'log', [{ id: 'line' }]);

    expect(getCandidateKeys(store.state, tableOf(store, 'p'))).toEqual([
      { id: 'unique:vin', kind: 'unique', columnIds: ['vin'] },
    ]);
    expect(getCandidateKeys(store.state, tableOf(store, 'q'))).toEqual([]);
  });

  it('reads the table as it stands, a column removed from it gone from its keys', () => {
    const store = createMapStore();
    seedMapTable(store, 'p', 'users', [
      { id: 'id', primaryKey: true },
      { id: 'code', primaryKey: true },
    ]);
    store.dispatchSync(removeColumnAction({ id: 'code', tableId: 'p' }));
    addMapColumn(store, 'p', { id: 'email', unique: true });

    expect(getCandidateKeys(store.state, tableOf(store, 'p'))).toEqual([
      { id: 'primaryKey:p', kind: 'primaryKey', columnIds: ['id'] },
      { id: 'unique:email', kind: 'unique', columnIds: ['email'] },
    ]);
  });
});

describe('findColumnKey', () => {
  it('finds a key by its id, a unique column the candidates leave out included', () => {
    const store = createMapStore();
    seedMapTable(store, 'p', 'users', [
      { id: 'id', primaryKey: true, unique: true },
    ]);
    const table = tableOf(store, 'p');

    expect(
      findColumnKey(store.state, table, 'primaryKey:p')?.columnIds
    ).toEqual(['id']);
    expect(findColumnKey(store.state, table, 'unique:id')?.columnIds).toEqual([
      'id',
    ]);
    expect(findColumnKey(store.state, table, 'unique:ghost')).toBeUndefined();
  });
});

describe('toCurrentKey', () => {
  it('names the stored columns as they are, on a list of its own', () => {
    const columnIds = ['a', 'b', 'a'];
    const key = toCurrentKey(columnIds);

    expect(key).toEqual({
      id: CURRENT_KEY_ID,
      kind: 'current',
      columnIds: ['a', 'b', 'a'],
    });
    expect(key.columnIds).not.toBe(columnIds);
  });
});
