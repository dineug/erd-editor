import { describe, expect, expectTypeOf, it } from 'vite-plus/test';

import type { ReplicationChange, ReplicationStore } from '@/engine';
import * as engine from '@/engine';
import { createReplicationStore as createFromModule } from '@/engine/replication-store';

describe('engine barrel', () => {
  it('re-exports createReplicationStore from the replication-store module', () => {
    expect(engine.createReplicationStore).toBe(createFromModule);
    expect(typeof engine.createReplicationStore).toBe('function');
  });

  it('exposes only the replication store surface', () => {
    expect(Object.keys(engine).sort()).toEqual(['createReplicationStore']);
  });

  it('creates a working replication store through the barrel', () => {
    const store = engine.createReplicationStore({
      toWidth: text => text.length * 10,
    });

    store.setInitialValue('');
    const initial = JSON.parse(store.value);

    expect(initial.version).toBe('3.0.0');
    expect(initial.doc.memoIds).toEqual([]);

    store.dispatchSync({
      type: 'memo.add',
      payload: { id: 'm1', ui: { x: 1, y: 2, zIndex: 3 } },
    });

    expect(JSON.parse(store.value).doc.memoIds).toEqual(['m1']);

    store.dispatchSync({ type: 'memo.remove', payload: { id: 'm1' } });

    expect(JSON.parse(store.value).collections.memoEntities).toEqual({});
    expect(
      JSON.parse(store.runtimeValue).collections.memoEntities
    ).toHaveProperty('m1');

    store.destroy();
  });

  it('types the file form and the runtime value as read-only strings', () => {
    expectTypeOf<ReplicationStore['value']>().toEqualTypeOf<string>();
    expectTypeOf<ReplicationStore['runtimeValue']>().toEqualTypeOf<string>();
    expectTypeOf<ReplicationChange>().toEqualTypeOf<{
      value: string;
      changed: boolean;
    }>();
  });

  it('ignores non-change actions dispatched through the barrel store', () => {
    const store = engine.createReplicationStore({
      toWidth: text => text.length,
    });
    store.setInitialValue('{}');

    store.dispatchSync({
      type: 'memo.changeZIndex',
      payload: { id: 'm1', zIndex: 9 },
    });

    expect(JSON.parse(store.value).collections.memoEntities).toEqual({});

    store.destroy();
  });
});
