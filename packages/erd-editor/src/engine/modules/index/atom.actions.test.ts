import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { describe, expect, it } from 'vitest';

import { Clock } from '@/engine/clock';
import {
  addIndexAction,
  changeIndexNameAction,
  changeIndexUniqueAction,
  removeIndexAction,
} from '@/engine/modules/index/atom.actions';
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

describe('addIndex', () => {
  it('creates the entity, registers the id and stamps the add version', () => {
    const { store } = setup();

    store.dispatchSync(addIndexAction({ id: 'i1', tableId: 't1' }));

    expect(store.state.doc.indexIds).toEqual(['i1']);
    expect(selectIndex(store, 'i1')).toMatchObject({
      id: 'i1',
      tableId: 't1',
      name: '',
      unique: false,
      indexColumnIds: [],
      seqIndexColumnIds: [],
    });
    expect(store.state.lww.i1).toEqual(['indexEntities', 0, -1, {}]);
  });

  it('falls back to the clock version when the action carries none', () => {
    const { store, clock } = setup();
    clock.merge(7);

    store.dispatchSync(addIndexAction({ id: 'i1', tableId: 't1' }));

    expect(store.state.lww.i1[1]).toBe(7);
  });

  it('prefers the version carried by the action over the clock', () => {
    const { store, clock } = setup();
    clock.merge(9);

    store.dispatchSync(at(addIndexAction({ id: 'i1', tableId: 't1' }), 3));

    expect(store.state.lww.i1[1]).toBe(3);
  });

  it('keeps the first entity and does not duplicate the id on re-add', () => {
    const { store } = setup();

    store.dispatchSync(at(addIndexAction({ id: 'i1', tableId: 't1' }), 1));
    store.dispatchSync(at(addIndexAction({ id: 'i1', tableId: 't2' }), 2));

    expect(store.state.doc.indexIds).toEqual(['i1']);
    expect(selectIndex(store, 'i1')?.tableId).toBe('t1');
    expect(store.state.lww.i1[1]).toBe(2);
  });

  it('does not register the id when a newer remove already won', () => {
    const { store } = setup();

    store.dispatchSync(at(removeIndexAction({ id: 'i1' }), 5));
    store.dispatchSync(at(addIndexAction({ id: 'i1', tableId: 't1' }), 3));

    expect(store.state.doc.indexIds).toEqual([]);
    // the entity itself is still inserted — only the doc registration is skipped
    expect(selectIndex(store, 'i1')).toBeDefined();
    expect(store.state.lww.i1).toEqual(['indexEntities', 3, 5, {}]);
  });
});

describe('removeIndex', () => {
  it('unregisters the id and stamps the remove version', () => {
    const { store } = setup();

    store.dispatchSync(at(addIndexAction({ id: 'i1', tableId: 't1' }), 1));
    store.dispatchSync(at(addIndexAction({ id: 'i2', tableId: 't1' }), 1));
    store.dispatchSync(at(removeIndexAction({ id: 'i1' }), 2));

    expect(store.state.doc.indexIds).toEqual(['i2']);
    expect(store.state.lww.i1).toEqual(['indexEntities', 1, 2, {}]);
  });

  it('is a no-op for an unknown id but still records the tombstone', () => {
    const { store } = setup();

    store.dispatchSync(at(removeIndexAction({ id: 'ghost' }), 4));

    expect(store.state.doc.indexIds).toEqual([]);
    expect(store.state.lww.ghost).toEqual(['indexEntities', -1, 4, {}]);
  });

  it('ignores a remove that is older than the add', () => {
    const { store } = setup();

    store.dispatchSync(at(addIndexAction({ id: 'i1', tableId: 't1' }), 5));
    store.dispatchSync(at(removeIndexAction({ id: 'i1' }), 3));

    expect(store.state.doc.indexIds).toEqual(['i1']);
    expect(store.state.lww.i1).toEqual(['indexEntities', 5, 3, {}]);
  });

  it('falls back to the clock version', () => {
    const { store, clock } = setup();
    store.dispatchSync(addIndexAction({ id: 'i1', tableId: 't1' }));
    clock.merge(6);

    store.dispatchSync(removeIndexAction({ id: 'i1' }));

    expect(store.state.doc.indexIds).toEqual([]);
    expect(store.state.lww.i1[2]).toBe(6);
  });

  it('applies a remove that ties the add version', () => {
    const { store } = setup();

    store.dispatchSync(at(addIndexAction({ id: 'i1', tableId: 't1' }), 5));
    store.dispatchSync(at(removeIndexAction({ id: 'i1' }), 5));

    expect(store.state.doc.indexIds).toEqual([]);
  });
});

describe('changeIndexName', () => {
  it('renames an existing index and records the path version', () => {
    const { store } = setup();

    store.dispatchSync(at(addIndexAction({ id: 'i1', tableId: 't1' }), 1));
    store.dispatchSync(
      at(changeIndexNameAction({ id: 'i1', tableId: 't1', value: 'idx' }), 2)
    );

    expect(selectIndex(store, 'i1')?.name).toBe('idx');
    expect(store.state.lww.i1[3]).toEqual({ name: 2 });
  });

  it('creates the index on demand when it does not exist yet', () => {
    const { store } = setup();

    store.dispatchSync(
      at(changeIndexNameAction({ id: 'i1', tableId: 't9', value: 'idx' }), 1)
    );

    expect(selectIndex(store, 'i1')).toMatchObject({
      id: 'i1',
      tableId: 't9',
      name: 'idx',
    });
    // getOrCreate does not register the id in the document
    expect(store.state.doc.indexIds).toEqual([]);
  });

  it('ignores a rename that is older than the last one', () => {
    const { store } = setup();

    store.dispatchSync(
      at(changeIndexNameAction({ id: 'i1', tableId: 't1', value: 'a' }), 5)
    );
    store.dispatchSync(
      at(changeIndexNameAction({ id: 'i1', tableId: 't1', value: 'b' }), 3)
    );

    expect(selectIndex(store, 'i1')?.name).toBe('a');
    expect(store.state.lww.i1[3]).toEqual({ name: 5 });
  });

  it('applies a rename that ties the last version', () => {
    const { store } = setup();

    store.dispatchSync(
      at(changeIndexNameAction({ id: 'i1', tableId: 't1', value: 'a' }), 5)
    );
    store.dispatchSync(
      at(changeIndexNameAction({ id: 'i1', tableId: 't1', value: 'c' }), 5)
    );

    expect(selectIndex(store, 'i1')?.name).toBe('c');
  });

  it('falls back to the clock version', () => {
    const { store, clock } = setup();
    clock.merge(11);

    store.dispatchSync(
      changeIndexNameAction({ id: 'i1', tableId: 't1', value: 'a' })
    );

    expect(store.state.lww.i1[3]).toEqual({ name: 11 });
  });
});

describe('changeIndexUnique', () => {
  it('flips the unique flag and records the path version', () => {
    const { store } = setup();

    store.dispatchSync(at(addIndexAction({ id: 'i1', tableId: 't1' }), 1));
    store.dispatchSync(
      at(changeIndexUniqueAction({ id: 'i1', tableId: 't1', value: true }), 2)
    );

    expect(selectIndex(store, 'i1')?.unique).toBe(true);
    expect(store.state.lww.i1[3]).toEqual({ unique: 2 });
  });

  it('creates the index on demand when it does not exist yet', () => {
    const { store } = setup();

    store.dispatchSync(
      at(changeIndexUniqueAction({ id: 'i1', tableId: 't7', value: true }), 1)
    );

    expect(selectIndex(store, 'i1')).toMatchObject({
      id: 'i1',
      tableId: 't7',
      unique: true,
    });
  });

  it('ignores a change that is older than the last one', () => {
    const { store } = setup();

    store.dispatchSync(
      at(changeIndexUniqueAction({ id: 'i1', tableId: 't1', value: true }), 5)
    );
    store.dispatchSync(
      at(changeIndexUniqueAction({ id: 'i1', tableId: 't1', value: false }), 3)
    );

    expect(selectIndex(store, 'i1')?.unique).toBe(true);
    expect(store.state.lww.i1[3]).toEqual({ unique: 5 });
  });

  it('falls back to the clock version', () => {
    const { store, clock } = setup();
    clock.merge(4);

    store.dispatchSync(
      changeIndexUniqueAction({ id: 'i1', tableId: 't1', value: true })
    );

    expect(store.state.lww.i1[3]).toEqual({ unique: 4 });
  });

  it('tracks name and unique versions independently', () => {
    const { store } = setup();

    store.dispatchSync(
      at(changeIndexNameAction({ id: 'i1', tableId: 't1', value: 'a' }), 2)
    );
    store.dispatchSync(
      at(changeIndexUniqueAction({ id: 'i1', tableId: 't1', value: true }), 6)
    );

    expect(store.state.lww.i1[3]).toEqual({ name: 2, unique: 6 });
  });
});
