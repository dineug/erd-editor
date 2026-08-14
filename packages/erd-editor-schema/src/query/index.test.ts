import { afterEach, describe, expect, it, vi } from 'vitest';

import { type Collections, query } from '@/query';
import { LWW } from '@/v3/schema/lww';
import { Table } from '@/v3/schema/table.entity';

function createTable(id: string, name = id): Table {
  return {
    id,
    name,
    comment: '',
    columnIds: [],
    seqColumnIds: [],
    ui: {
      x: 0,
      y: 0,
      zIndex: 2,
      widthName: 60,
      widthComment: 60,
      color: '',
    },
    meta: { updateAt: 1, createAt: 1 },
  };
}

function createCollections(...tables: Table[]): Collections {
  return {
    tableEntities: tables.reduce<Record<string, Table>>((acc, table) => {
      acc[table.id] = table;
      return acc;
    }, {}),
    tableColumnEntities: {},
    relationshipEntities: {},
    indexEntities: {},
    indexColumnEntities: {},
    memoEntities: {},
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('query', () => {
  it('exposes a collection query per collection key', () => {
    const collections = createCollections(createTable('t1'));
    const root = query(collections);

    expect(root.collection('tableEntities').selectAll()).toHaveLength(1);
    expect(root.collection('memoEntities').selectAll()).toEqual([]);
  });

  it('returns a fresh collection query on each call', () => {
    const collections = createCollections();
    const root = query(collections);

    expect(root.collection('tableEntities')).not.toBe(
      root.collection('tableEntities')
    );
  });
});

describe('CollectionQuery select', () => {
  it('selectById returns the entity or undefined', () => {
    const table = createTable('t1');
    const target = query(createCollections(table)).collection('tableEntities');

    expect(target.selectById('t1')).toBe(table);
    expect(target.selectById('nope')).toBeUndefined();
  });

  it('selectByIds keeps order and drops missing ids', () => {
    const collections = createCollections(
      createTable('t1'),
      createTable('t2'),
      createTable('t3')
    );
    const target = query(collections).collection('tableEntities');

    expect(target.selectByIds(['t3', 'missing', 't1']).map(t => t.id)).toEqual([
      't3',
      't1',
    ]);
    expect(target.selectByIds([])).toEqual([]);
  });

  it('selectEntities returns the live record', () => {
    const collections = createCollections(createTable('t1'));
    const target = query(collections).collection('tableEntities');

    expect(target.selectEntities()).toBe(collections.tableEntities);
  });

  it('selectAll returns every value', () => {
    const collections = createCollections(createTable('t1'), createTable('t2'));
    const target = query(collections).collection('tableEntities');

    expect(target.selectAll().map(t => t.id)).toEqual(['t1', 't2']);
  });
});

describe('CollectionQuery mutation', () => {
  it('setOne writes through to the source collection and is chainable', () => {
    const collections = createCollections();
    const target = query(collections).collection('tableEntities');
    const table = createTable('t1');

    expect(target.setOne(table)).toBe(target);
    expect(collections.tableEntities.t1).toBe(table);
  });

  it('setOne overwrites an existing entity', () => {
    const collections = createCollections(createTable('t1', 'old'));
    const target = query(collections).collection('tableEntities');

    target.setOne(createTable('t1', 'new'));

    expect(collections.tableEntities.t1.name).toBe('new');
  });

  it('setMany writes every entity', () => {
    const collections = createCollections();
    const target = query(collections).collection('tableEntities');

    target.setMany([createTable('t1'), createTable('t2')]);

    expect(Object.keys(collections.tableEntities)).toEqual(['t1', 't2']);
  });

  it('setAll detaches from the source collection because removeAll rebinds it', () => {
    const collections = createCollections(createTable('old'));
    const target = query(collections).collection('tableEntities');

    target.setAll([createTable('t1')]);

    expect(target.selectAll().map(t => t.id)).toEqual(['t1']);
    expect(Object.keys(collections.tableEntities)).toEqual(['old']);
  });

  it('addOne skips an existing id', () => {
    const collections = createCollections(createTable('t1', 'old'));
    const target = query(collections).collection('tableEntities');

    target.addOne(createTable('t1', 'new'));

    expect(collections.tableEntities.t1.name).toBe('old');
  });

  it('addMany only inserts missing ids', () => {
    const collections = createCollections(createTable('t1', 'old'));
    const target = query(collections).collection('tableEntities');

    target.addMany([createTable('t1', 'new'), createTable('t2')]);

    expect(collections.tableEntities.t1.name).toBe('old');
    expect(collections.tableEntities.t2).toBeDefined();
  });

  it('removeOne deletes only a known id', () => {
    const collections = createCollections(createTable('t1'), createTable('t2'));
    const target = query(collections).collection('tableEntities');

    target.removeOne('t1').removeOne('missing');

    expect(Object.keys(collections.tableEntities)).toEqual(['t2']);
  });

  it('removeMany deletes every listed id', () => {
    const collections = createCollections(
      createTable('t1'),
      createTable('t2'),
      createTable('t3')
    );
    const target = query(collections).collection('tableEntities');

    target.removeMany(['t1', 't3']);

    expect(Object.keys(collections.tableEntities)).toEqual(['t2']);
  });

  it('removeAll empties the query view without touching the source', () => {
    const collections = createCollections(createTable('t1'));
    const target = query(collections).collection('tableEntities');

    expect(target.removeAll()).toBe(target);
    expect(target.selectAll()).toEqual([]);
    expect(Object.keys(collections.tableEntities)).toEqual(['t1']);
  });
});

describe('CollectionQuery update', () => {
  it('updateOne applies the recipe and refreshes updateAt', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const collections = createCollections(createTable('t1', 'old'));
    const target = query(collections).collection('tableEntities');

    target.updateOne('t1', table => {
      table.name = 'new';
    });

    expect(collections.tableEntities.t1.name).toBe('new');
    expect(collections.tableEntities.t1.meta.updateAt).toBe(1700000000000);
    expect(collections.tableEntities.t1.meta.createAt).toBe(1);
  });

  it('updateOne is a no-op for an unknown id', () => {
    const collections = createCollections();
    const target = query(collections).collection('tableEntities');
    const recipe = vi.fn();

    expect(target.updateOne('missing', recipe)).toBe(target);
    expect(recipe).not.toHaveBeenCalled();
  });

  it('updateMany applies the recipe to every known id', () => {
    const collections = createCollections(createTable('t1'), createTable('t2'));
    const target = query(collections).collection('tableEntities');
    const recipe = vi.fn(table => {
      table.comment = 'done';
    });

    target.updateMany(['t1', 't2', 'missing'], recipe);

    expect(recipe).toHaveBeenCalledTimes(2);
    expect(collections.tableEntities.t1.comment).toBe('done');
    expect(collections.tableEntities.t2.comment).toBe('done');
  });
});

describe('CollectionQuery getOrCreate', () => {
  it('returns the existing entity without calling the factory', () => {
    const table = createTable('t1');
    const target = query(createCollections(table)).collection('tableEntities');
    const recipe = vi.fn(createTable);

    expect(target.getOrCreate('t1', recipe)).toBe(table);
    expect(recipe).not.toHaveBeenCalled();
  });

  it('creates, stores and returns a new entity', () => {
    const collections = createCollections();
    const target = query(collections).collection('tableEntities');
    const recipe = vi.fn((id: string) => createTable(id));

    const created = target.getOrCreate('t1', recipe);

    expect(recipe).toHaveBeenCalledWith('t1');
    expect(created.id).toBe('t1');
    expect(collections.tableEntities.t1).toBe(created);
  });
});

describe('CollectionQuery lww operators', () => {
  it('addOperator tags the tuple with the collection key', () => {
    const lww: LWW = {};
    const target = query(createCollections()).collection('tableEntities');
    const recipe = vi.fn();

    expect(target.addOperator(lww, 1, 't1', recipe)).toBe(target);
    expect(lww.t1).toEqual(['tableEntities', 1, -1, {}]);
    expect(recipe).toHaveBeenCalledTimes(1);
  });

  it('removeOperator tags the tuple with the collection key', () => {
    const lww: LWW = {};
    const target = query(createCollections()).collection('memoEntities');
    const recipe = vi.fn();

    expect(target.removeOperator(lww, 2, 'm1', recipe)).toBe(target);
    expect(lww.m1).toEqual(['memoEntities', -1, 2, {}]);
    expect(recipe).toHaveBeenCalledTimes(1);
  });

  it('replaceOperator records the path version', () => {
    const lww: LWW = {};
    const target = query(createCollections()).collection('tableEntities');
    const recipe = vi.fn();

    expect(target.replaceOperator(lww, 3, 't1', 'name', recipe)).toBe(target);
    expect(lww.t1).toEqual(['tableEntities', -1, -1, { name: 3 }]);
    expect(recipe).toHaveBeenCalledTimes(1);
  });
});
