import { describe, expect, it } from 'vite-plus/test';

import { schemaEntitiesAtom } from '@/atoms/modules/schema';
import { store } from '@/store';
import { bridge, deleteSchemaEntityAction } from '@/utils/broadcastChannel';

describe('another tab deleting a schema', () => {
  it('drops it once, however many tabs purged it from the trash', () => {
    const kept = { id: 'kept', name: 'kept', createAt: 1, updateAt: 1 };
    store.set(schemaEntitiesAtom, [
      {
        id: 'expired',
        name: 'expired',
        createAt: 1,
        updateAt: 1,
        deletedAt: 1,
      },
      kept,
    ]);

    bridge.emit(deleteSchemaEntityAction({ id: 'expired' }));
    bridge.emit(deleteSchemaEntityAction({ id: 'expired' }));

    expect(store.get(schemaEntitiesAtom)).toEqual([kept]);
  });
});
