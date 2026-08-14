import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vitest';

import { OrderType } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import { addIndexAction } from '@/engine/modules/index/atom.actions';
import {
  addIndexColumnAction,
  changeIndexColumnOrderTypeAction,
  moveIndexColumnAction,
  removeIndexColumnAction,
} from '@/engine/modules/index-column/atom.actions';
import { createStore, Store } from '@/engine/store';

function setup() {
  const clock = new Clock();
  const store = createStore({ toWidth: text => text.length * 10, clock });
  return { store, clock };
}

const at = (action: AnyAction, version: number): AnyAction => ({
  ...action,
  version,
});

const selectIndex = (store: Store, id: string) =>
  query(store.state.collections).collection('indexEntities').selectById(id);

const selectIndexColumn = (store: Store, id: string) =>
  query(store.state.collections)
    .collection('indexColumnEntities')
    .selectById(id);

function withIndex() {
  const { store, clock } = setup();
  store.dispatchSync(at(addIndexAction({ id: 'idx1', tableId: 't1' }), 1));
  return { store, clock };
}

describe('addIndexColumn', () => {
  it('creates the index on demand and appends to both id lists', () => {
    const { store } = setup();

    store.dispatchSync(
      at(
        addIndexColumnAction({
          id: 'ic1',
          indexId: 'idx1',
          tableId: 't1',
          columnId: 'c1',
        }),
        1
      )
    );

    expect(selectIndex(store, 'idx1')).toMatchObject({
      id: 'idx1',
      tableId: 't1',
      indexColumnIds: ['ic1'],
      seqIndexColumnIds: ['ic1'],
    });
    expect(selectIndexColumn(store, 'ic1')).toMatchObject({
      id: 'ic1',
      indexId: 'idx1',
      columnId: 'c1',
      orderType: OrderType.ASC,
    });
    expect(store.state.lww.ic1).toEqual(['indexColumnEntities', 1, -1, {}]);
    // the index is only created in the collection, never registered in the doc
    expect(store.state.doc.indexIds).toEqual([]);
  });

  it('appends in dispatch order', () => {
    const { store } = withIndex();

    for (const [i, id] of ['ic1', 'ic2', 'ic3'].entries()) {
      store.dispatchSync(
        at(
          addIndexColumnAction({
            id,
            indexId: 'idx1',
            tableId: 't1',
            columnId: `c${i}`,
          }),
          1
        )
      );
    }

    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual([
      'ic1',
      'ic2',
      'ic3',
    ]);
    expect(selectIndex(store, 'idx1')?.seqIndexColumnIds).toEqual([
      'ic1',
      'ic2',
      'ic3',
    ]);
  });

  it('does not duplicate an id that is already registered', () => {
    const { store } = withIndex();
    const add = addIndexColumnAction({
      id: 'ic1',
      indexId: 'idx1',
      tableId: 't1',
      columnId: 'c1',
    });

    store.dispatchSync(at(add, 1));
    store.dispatchSync(
      at({ ...add, payload: { ...add.payload, columnId: 'c2' } }, 2)
    );

    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual(['ic1']);
    expect(selectIndex(store, 'idx1')?.seqIndexColumnIds).toEqual(['ic1']);
    // addOne keeps the first entity
    expect(selectIndexColumn(store, 'ic1')?.columnId).toBe('c1');
    expect(store.state.lww.ic1[1]).toBe(2);
  });

  it('restores the sequence position when an id is re-added after a remove', () => {
    const { store } = withIndex();
    const add = (id: string, columnId: string, version: number) =>
      store.dispatchSync(
        at(
          addIndexColumnAction({
            id,
            indexId: 'idx1',
            tableId: 't1',
            columnId,
          }),
          version
        )
      );

    add('ic1', 'c1', 1);
    add('ic2', 'c2', 1);
    store.dispatchSync(
      at(
        removeIndexColumnAction({
          id: 'ic1',
          indexId: 'idx1',
          tableId: 't1',
        }),
        2
      )
    );
    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual(['ic2']);
    expect(selectIndex(store, 'idx1')?.seqIndexColumnIds).toEqual([
      'ic1',
      'ic2',
    ]);

    add('ic1', 'c1', 3);

    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual(['ic1', 'ic2']);
    expect(selectIndex(store, 'idx1')?.seqIndexColumnIds).toEqual([
      'ic1',
      'ic2',
    ]);
  });

  it('skips the registration when a newer remove already won', () => {
    const { store } = withIndex();

    store.dispatchSync(
      at(
        removeIndexColumnAction({ id: 'ic1', indexId: 'idx1', tableId: 't1' }),
        5
      )
    );
    store.dispatchSync(
      at(
        addIndexColumnAction({
          id: 'ic1',
          indexId: 'idx1',
          tableId: 't1',
          columnId: 'c1',
        }),
        3
      )
    );

    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual([]);
    expect(selectIndexColumn(store, 'ic1')).toBeDefined();
    expect(store.state.lww.ic1).toEqual(['indexColumnEntities', 3, 5, {}]);
  });

  it('falls back to the clock version', () => {
    const { store, clock } = withIndex();
    clock.merge(8);

    store.dispatchSync(
      addIndexColumnAction({
        id: 'ic1',
        indexId: 'idx1',
        tableId: 't1',
        columnId: 'c1',
      })
    );

    expect(store.state.lww.ic1[1]).toBe(8);
  });
});

describe('removeIndexColumn', () => {
  it('unregisters the id but keeps the entity and the sequence', () => {
    const { store } = withIndex();
    store.dispatchSync(
      at(
        addIndexColumnAction({
          id: 'ic1',
          indexId: 'idx1',
          tableId: 't1',
          columnId: 'c1',
        }),
        1
      )
    );

    store.dispatchSync(
      at(
        removeIndexColumnAction({ id: 'ic1', indexId: 'idx1', tableId: 't1' }),
        2
      )
    );

    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual([]);
    expect(selectIndex(store, 'idx1')?.seqIndexColumnIds).toEqual(['ic1']);
    expect(selectIndexColumn(store, 'ic1')).toBeDefined();
    expect(store.state.lww.ic1).toEqual(['indexColumnEntities', 1, 2, {}]);
  });

  it('is a no-op for an id that is not registered', () => {
    const { store } = withIndex();

    store.dispatchSync(
      at(
        removeIndexColumnAction({
          id: 'ghost',
          indexId: 'idx1',
          tableId: 't1',
        }),
        2
      )
    );

    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual([]);
    expect(store.state.lww.ghost).toEqual(['indexColumnEntities', -1, 2, {}]);
  });

  it('creates the index on demand when it is unknown', () => {
    const { store } = setup();

    store.dispatchSync(
      at(
        removeIndexColumnAction({ id: 'ic1', indexId: 'idx9', tableId: 't9' }),
        1
      )
    );

    expect(selectIndex(store, 'idx9')).toMatchObject({
      id: 'idx9',
      tableId: 't9',
      indexColumnIds: [],
    });
  });

  it('ignores a remove that is older than the add', () => {
    const { store } = withIndex();
    store.dispatchSync(
      at(
        addIndexColumnAction({
          id: 'ic1',
          indexId: 'idx1',
          tableId: 't1',
          columnId: 'c1',
        }),
        5
      )
    );

    store.dispatchSync(
      at(
        removeIndexColumnAction({ id: 'ic1', indexId: 'idx1', tableId: 't1' }),
        3
      )
    );

    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual(['ic1']);
  });

  it('falls back to the clock version', () => {
    const { store, clock } = withIndex();
    clock.merge(6);

    store.dispatchSync(
      removeIndexColumnAction({ id: 'ic1', indexId: 'idx1', tableId: 't1' })
    );

    expect(store.state.lww.ic1[2]).toBe(6);
  });
});

describe('moveIndexColumn', () => {
  function withColumns(ids: string[]) {
    const { store, clock } = withIndex();
    for (const [i, id] of ids.entries()) {
      store.dispatchSync(
        at(
          addIndexColumnAction({
            id,
            indexId: 'idx1',
            tableId: 't1',
            columnId: `c${i}`,
          }),
          1
        )
      );
    }
    return { store, clock };
  }

  it('does nothing when the id equals the target', () => {
    const { store } = withColumns(['ic1', 'ic2']);

    store.dispatchSync(
      moveIndexColumnAction({
        id: 'ic1',
        indexId: 'idx1',
        tableId: 't1',
        targetId: 'ic1',
      })
    );

    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual(['ic1', 'ic2']);
  });

  it('does nothing when the moved id is not registered', () => {
    const { store } = withColumns(['ic1', 'ic2']);

    store.dispatchSync(
      moveIndexColumnAction({
        id: 'ghost',
        indexId: 'idx1',
        tableId: 't1',
        targetId: 'ic1',
      })
    );

    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual(['ic1', 'ic2']);
  });

  it('does nothing when the target id is not registered', () => {
    const { store } = withColumns(['ic1', 'ic2']);

    store.dispatchSync(
      moveIndexColumnAction({
        id: 'ic1',
        indexId: 'idx1',
        tableId: 't1',
        targetId: 'ghost',
      })
    );

    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual(['ic1', 'ic2']);
  });

  it('creates the index on demand before bailing out', () => {
    const { store } = setup();

    store.dispatchSync(
      moveIndexColumnAction({
        id: 'ic1',
        indexId: 'idx9',
        tableId: 't9',
        targetId: 'ic2',
      })
    );

    expect(selectIndex(store, 'idx9')).toMatchObject({
      id: 'idx9',
      tableId: 't9',
      indexColumnIds: [],
    });
  });

  it('moves a column down so that it lands after the target', () => {
    const { store } = withColumns(['ic1', 'ic2', 'ic3']);

    store.dispatchSync(
      moveIndexColumnAction({
        id: 'ic1',
        indexId: 'idx1',
        tableId: 't1',
        targetId: 'ic3',
      })
    );

    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual([
      'ic2',
      'ic3',
      'ic1',
    ]);
    expect(selectIndex(store, 'idx1')?.seqIndexColumnIds).toEqual([
      'ic2',
      'ic3',
      'ic1',
    ]);
  });

  it('moves a column up so that it lands before the target', () => {
    const { store } = withColumns(['ic1', 'ic2', 'ic3']);

    store.dispatchSync(
      moveIndexColumnAction({
        id: 'ic3',
        indexId: 'idx1',
        tableId: 't1',
        targetId: 'ic1',
      })
    );

    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual([
      'ic3',
      'ic1',
      'ic2',
    ]);
    expect(selectIndex(store, 'idx1')?.seqIndexColumnIds).toEqual([
      'ic3',
      'ic1',
      'ic2',
    ]);
  });

  it('leaves the sequence untouched when the ids are missing from it', () => {
    const { store } = withColumns(['ic1', 'ic2']);
    selectIndex(store, 'idx1')?.seqIndexColumnIds.splice(0);

    store.dispatchSync(
      moveIndexColumnAction({
        id: 'ic1',
        indexId: 'idx1',
        tableId: 't1',
        targetId: 'ic2',
      })
    );

    expect(selectIndex(store, 'idx1')?.indexColumnIds).toEqual(['ic2', 'ic1']);
    expect(selectIndex(store, 'idx1')?.seqIndexColumnIds).toEqual([]);
  });

  it('does not record any lww version', () => {
    const { store } = withColumns(['ic1', 'ic2']);
    const before = [...store.state.lww.ic1];

    store.dispatchSync(
      moveIndexColumnAction({
        id: 'ic1',
        indexId: 'idx1',
        tableId: 't1',
        targetId: 'ic2',
      })
    );

    expect([...store.state.lww.ic1]).toEqual(before);
  });
});

describe('changeIndexColumnOrderType', () => {
  it('creates the index column on demand and records the path version', () => {
    const { store } = setup();

    store.dispatchSync(
      at(
        changeIndexColumnOrderTypeAction({
          id: 'ic1',
          indexId: 'idx1',
          columnId: 'c1',
          value: OrderType.DESC,
        }),
        4
      )
    );

    expect(selectIndexColumn(store, 'ic1')).toMatchObject({
      id: 'ic1',
      indexId: 'idx1',
      columnId: 'c1',
      orderType: OrderType.DESC,
    });
    expect(store.state.lww.ic1).toEqual([
      'indexColumnEntities',
      -1,
      -1,
      { orderType: 4 },
    ]);
    // getOrCreate never touches the owning index
    expect(selectIndex(store, 'idx1')).toBeUndefined();
  });

  it('updates an existing index column', () => {
    const { store } = withIndex();
    store.dispatchSync(
      at(
        addIndexColumnAction({
          id: 'ic1',
          indexId: 'idx1',
          tableId: 't1',
          columnId: 'c1',
        }),
        1
      )
    );

    store.dispatchSync(
      at(
        changeIndexColumnOrderTypeAction({
          id: 'ic1',
          indexId: 'idx1',
          columnId: 'c1',
          value: OrderType.DESC,
        }),
        2
      )
    );

    expect(selectIndexColumn(store, 'ic1')?.orderType).toBe(OrderType.DESC);
    expect(store.state.lww.ic1[3]).toEqual({ orderType: 2 });
  });

  it('ignores a change that is older than the last one', () => {
    const { store } = setup();
    const change = (value: number, version: number) =>
      store.dispatchSync(
        at(
          changeIndexColumnOrderTypeAction({
            id: 'ic1',
            indexId: 'idx1',
            columnId: 'c1',
            value,
          }),
          version
        )
      );

    change(OrderType.DESC, 5);
    change(OrderType.ASC, 3);

    expect(selectIndexColumn(store, 'ic1')?.orderType).toBe(OrderType.DESC);
    expect(store.state.lww.ic1[3]).toEqual({ orderType: 5 });
  });

  it('applies a change that ties the last version', () => {
    const { store } = setup();
    const change = (value: number, version: number) =>
      store.dispatchSync(
        at(
          changeIndexColumnOrderTypeAction({
            id: 'ic1',
            indexId: 'idx1',
            columnId: 'c1',
            value,
          }),
          version
        )
      );

    change(OrderType.DESC, 5);
    change(OrderType.ASC, 5);

    expect(selectIndexColumn(store, 'ic1')?.orderType).toBe(OrderType.ASC);
  });

  it('falls back to the clock version', () => {
    const { store, clock } = setup();
    clock.merge(12);

    store.dispatchSync(
      changeIndexColumnOrderTypeAction({
        id: 'ic1',
        indexId: 'idx1',
        columnId: 'c1',
        value: OrderType.DESC,
      })
    );

    expect(store.state.lww.ic1[3]).toEqual({ orderType: 12 });
  });
});
