import { afterEach, describe, expect, it, vi } from 'vitest';

import { unselectAllAction } from '@/engine/modules/editor/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  createReplicationStore,
  ReplicationStore,
} from '@/engine/replication-store';
import { Tag } from '@/engine/tag';

const DAY = 24 * 60 * 60 * 1000;

const addTable = (id: string) =>
  addTableAction({ id, ui: { x: 200, y: 100, zIndex: 2 } });

const stores: ReplicationStore[] = [];

function make(): ReplicationStore {
  const store = createReplicationStore({
    toWidth: (text: string) => text.length * 10,
  });
  stores.push(store);
  return store;
}

function parse(store: ReplicationStore) {
  return JSON.parse(store.value);
}

/** Let the schema GC promise chain settle. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

function createTableJson(id: string, updateAt: number) {
  return {
    id,
    name: id,
    comment: '',
    columnIds: [],
    seqColumnIds: [],
    ui: {
      x: 200,
      y: 100,
      zIndex: 2,
      widthName: 60,
      widthComment: 60,
      color: '',
    },
    meta: { updateAt, createAt: updateAt },
  };
}

afterEach(() => {
  vi.useRealTimers();
  while (stores.length) {
    const store = stores.pop();
    try {
      store?.destroy();
    } catch {
      // already destroyed by the test
    }
  }
});

describe('createReplicationStore', () => {
  it('starts from an empty v3 document', () => {
    const store = make();
    const json = parse(store);

    expect(json.version).toBe('3.0.0');
    expect(json.doc.tableIds).toEqual([]);
    expect(json.collections.tableEntities).toEqual({});
    expect(Object.isFrozen(store)).toBe(true);
  });

  it('setInitialValue falls back to an empty document for blank input', async () => {
    const store = make();

    store.setInitialValue('   ');
    await settle();

    expect(parse(store).doc.tableIds).toEqual([]);
  });

  it('setInitialValue coerces non-string input to an empty document', async () => {
    const store = make();

    store.setInitialValue(undefined as unknown as string);
    await settle();

    expect(parse(store).doc.tableIds).toEqual([]);
  });

  it('setInitialValue loads a v3 document', async () => {
    const store = make();
    const now = Date.now();

    store.setInitialValue(
      JSON.stringify({
        version: '3.0.0',
        doc: {
          tableIds: ['t1'],
          relationshipIds: [],
          indexIds: [],
          memoIds: [],
        },
        collections: {
          tableEntities: { t1: createTableJson('t1', now) },
        },
      })
    );
    await settle();

    const json = parse(store);
    expect(json.doc.tableIds).toEqual(['t1']);
    expect(json.collections.tableEntities.t1.name).toBe('t1');
  });

  it('garbage collects stale entities that no longer belong to the doc', async () => {
    const store = make();
    const now = Date.now();

    store.setInitialValue(
      JSON.stringify({
        version: '3.0.0',
        doc: {
          tableIds: ['keep'],
          relationshipIds: [],
          indexIds: [],
          memoIds: [],
        },
        collections: {
          tableEntities: {
            keep: createTableJson('keep', now),
            stale: createTableJson('stale', now - 10 * DAY),
          },
        },
      })
    );
    await settle();

    const json = parse(store);
    expect(Object.keys(json.collections.tableEntities)).toEqual(['keep']);
    expect(json.doc.tableIds).toEqual(['keep']);
  });

  it('keeps recently touched entities that are not referenced by the doc', async () => {
    const store = make();
    const now = Date.now();

    store.setInitialValue(
      JSON.stringify({
        version: '3.0.0',
        doc: {
          tableIds: [],
          relationshipIds: [],
          indexIds: [],
          memoIds: [],
        },
        collections: {
          tableEntities: { fresh: createTableJson('fresh', now) },
        },
      })
    );
    await settle();

    expect(Object.keys(parse(store).collections.tableEntities)).toEqual([
      'fresh',
    ]);
  });

  it('dispatchSync applies change actions', () => {
    const store = make();

    store.dispatchSync(addTable('t1'));
    store.dispatchSync([changeTableNameAction({ id: 't1', value: 'users' })]);

    const json = parse(store);
    expect(json.doc.tableIds).toEqual(['t1']);
    expect(json.collections.tableEntities.t1.name).toBe('users');
  });

  it('dispatchSync ignores actions outside of ChangeActionTypes', () => {
    const store = make();
    const before = store.value;

    store.dispatchSync(unselectAllAction());

    expect(store.value).toBe(before);
  });

  it('strips tags before handing actions to the reducers', () => {
    const store = make();

    store.dispatchSync({
      ...addTable('t1'),
      tags: Tag.shared | Tag.following,
      version: 1,
    });

    expect(parse(store).doc.tableIds).toEqual(['t1']);
  });

  it('dispatch defers to a microtask', async () => {
    const store = make();

    store.dispatch(addTable('t1'));
    expect(parse(store).doc.tableIds).toEqual([]);

    await Promise.resolve();
    await Promise.resolve();
    expect(parse(store).doc.tableIds).toEqual(['t1']);
  });

  describe('observers', () => {
    it('notifies change listeners after the debounce window', () => {
      vi.useFakeTimers();
      const store = make();
      const change = vi.fn();
      store.on({ change });

      store.dispatchSync(addTable('t1'));
      expect(change).not.toHaveBeenCalled();

      vi.advanceTimersByTime(250);
      expect(change).toHaveBeenCalledTimes(1);
    });

    it('registers the same listener record only once', () => {
      vi.useFakeTimers();
      const store = make();
      const change = vi.fn();
      const listeners = { change };

      store.on(listeners);
      store.on(listeners);

      store.dispatchSync(addTable('t1'));
      vi.advanceTimersByTime(250);

      expect(change).toHaveBeenCalledTimes(1);
    });

    it('the returned unsubscribe stops notifications', () => {
      vi.useFakeTimers();
      const store = make();
      const change = vi.fn();
      const off = store.on({ change });

      off();
      store.dispatchSync(addTable('t1'));
      vi.advanceTimersByTime(250);

      expect(change).not.toHaveBeenCalled();
    });

    it('a throwing listener does not stop the others', () => {
      vi.useFakeTimers();
      const store = make();
      const boom = vi.fn(() => {
        throw new Error('boom');
      });
      const ok = vi.fn();
      store.on({ change: boom });
      store.on({ change: ok });

      store.dispatchSync(addTable('t1'));
      vi.advanceTimersByTime(250);

      expect(boom).toHaveBeenCalledTimes(1);
      expect(ok).toHaveBeenCalledTimes(1);
    });
  });

  it('destroy detaches subscriptions and observers', () => {
    vi.useFakeTimers();
    const store = make();
    const change = vi.fn();
    store.on({ change });

    store.destroy();
    store.dispatchSync(addTable('t1'));
    vi.advanceTimersByTime(250);

    expect(change).not.toHaveBeenCalled();
    expect(parse(store).doc.tableIds).toEqual([]);
  });
});
