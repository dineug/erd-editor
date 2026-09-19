import * as Sentry from '@sentry/react';
import { createStore } from 'jotai';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vite-plus/test';

import { collectUnhandledRejections } from '@/__test-utils__/rejections';
import { renderHook } from '@/__test-utils__/renderHook';
import {
  schemaEntitiesAtom,
  useAddSchemaEntity,
  useDeleteSchemaEntity,
  useDuplicateSchemaEntity,
  useEmptyTrash,
  useMoveSchemaEntityToTrash,
  useRestoreSchemaEntity,
  useUpdateSchemaEntities,
  useUpdateSchemaEntity,
} from '@/atoms/modules/schema';
import { selectedSchemaIdAtom } from '@/atoms/modules/sidebar';
import type { AppDatabaseService } from '@/services/indexeddb/appDatabaseService';
import type { SchemaEntity } from '@/services/indexeddb/modules/schema';

const service = vi.hoisted(() => ({}) as Partial<AppDatabaseService>);

vi.mock('@/services/indexeddb', () => ({
  getAppDatabaseService: () => service,
}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));

const CREATED = Date.UTC(2026, 8, 1, 9);
const FAILURE = new Error('IndexedDB is gone');

type Store = ReturnType<typeof createStore>;
type ListEntity = Omit<SchemaEntity, 'value'>;

const entity = (extra: Partial<ListEntity> = {}): ListEntity => ({
  id: 'schema-1',
  name: 'Orders',
  createAt: CREATED,
  updateAt: CREATED,
  ...extra,
});

// Plain functions rather than mocks, which would settle the promise they
// return and so hide a rejection nobody handled.
async function fail(): Promise<never> {
  throw FAILURE;
}

function listed(store: Store, id = 'schema-1') {
  return store.get(schemaEntitiesAtom).find(item => item.id === id);
}

describe('schema list actions', () => {
  let store: Store;
  let consoleError: MockInstance;
  let postMessage: MockInstance;

  beforeEach(() => {
    store = createStore();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    postMessage = vi.spyOn(BroadcastChannel.prototype, 'postMessage');
    for (const key of Object.keys(service)) {
      Reflect.deleteProperty(service, key);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(Sentry.captureException).mockClear();
  });

  describe('a failed update', () => {
    it('takes a trash mark the entity never had away again', async () => {
      const original = entity();
      store.set(schemaEntitiesAtom, [original]);
      store.set(selectedSchemaIdAtom, original.id);
      service.updateSchemaEntity = fail;
      const { result } = renderHook(useMoveSchemaEntityToTrash, store);

      const reasons = await collectUnhandledRejections(async () => {
        await expect(result.current(original.id)).resolves.toBeUndefined();
      });

      expect(reasons).toEqual([]);
      expect(listed(store)).toEqual(original);
      expect(listed(store)).not.toHaveProperty('deletedAt');
      expect(postMessage).not.toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(FAILURE);
      expect(consoleError).toHaveBeenCalledWith(FAILURE);
    });

    it('puts back the trash mark a failed restore cleared', async () => {
      const trashed = entity({ deletedAt: CREATED + 1 });
      store.set(schemaEntitiesAtom, [trashed]);
      service.updateSchemaEntity = fail;
      const { result } = renderHook(useRestoreSchemaEntity, store);

      await expect(result.current(trashed.id)).resolves.toBeUndefined();

      expect(listed(store)).toEqual(trashed);
    });

    it('puts back a name the store refused, without an error', async () => {
      const original = entity();
      store.set(schemaEntitiesAtom, [original]);
      service.updateSchemaEntity = async () => false;
      const { result } = renderHook(useUpdateSchemaEntity, store);

      await expect(
        result.current({ id: original.id, entityValue: { name: 'Sales' } })
      ).resolves.toBe(false);

      expect(listed(store)).toEqual(original);
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('leaves a field another tab changed meanwhile as it now is', async () => {
      const original = entity();
      const edited = CREATED + 60_000;
      let reject: (error: Error) => void = () => {};
      store.set(schemaEntitiesAtom, [original]);
      service.updateSchemaEntity = () =>
        new Promise<boolean>((_, fail) => {
          reject = fail;
        });
      const { result } = renderHook(useUpdateSchemaEntity, store);

      const renaming = result.current({
        id: original.id,
        entityValue: { name: 'Sales' },
      });
      expect(listed(store)?.name).toBe('Sales');
      store.set(schemaEntitiesAtom, draft => {
        draft[0].updateAt = edited;
      });
      reject(FAILURE);
      await renaming;

      expect(listed(store)).toEqual({ ...original, updateAt: edited });
    });

    it('keeps an update that went through and tells the other tabs', async () => {
      const original = entity();
      store.set(schemaEntitiesAtom, [original]);
      service.updateSchemaEntity = async () => true;
      const { result } = renderHook(useUpdateSchemaEntity, store);

      await result.current({ id: original.id, entityValue: { name: 'Sales' } });

      expect(listed(store)).toEqual({ ...original, name: 'Sales' });
      expect(postMessage).toHaveBeenCalledWith({
        type: 'updateSchemaEntity',
        payload: { id: original.id, entityValue: { name: 'Sales' } },
      });
    });
  });

  describe('a new schema', () => {
    it('tells the other tabs of its list entry, not its document', async () => {
      const added: SchemaEntity = { ...entity(), value: '{"doc":{}}' };
      service.addSchemaEntity = async () => added;
      const { result } = renderHook(useAddSchemaEntity, store);

      await expect(result.current({ name: 'Orders' })).resolves.toEqual(added);

      expect(listed(store)).toEqual(entity());
      expect(store.get(selectedSchemaIdAtom)).toBe(added.id);
      expect(postMessage).toHaveBeenCalledWith({
        type: 'addSchemaEntity',
        payload: { value: entity() },
      });
    });

    it('does the same for a copy', async () => {
      store.set(schemaEntitiesAtom, [entity()]);
      const copy: SchemaEntity = {
        ...entity({ id: 'schema-2', name: 'Orders copy' }),
        value: '{"doc":{}}',
      };
      service.duplicateSchemaEntity = async () => copy;
      const { result } = renderHook(useDuplicateSchemaEntity, store);

      await result.current('schema-1');

      expect(listed(store, 'schema-2')).toEqual(
        entity({ id: 'schema-2', name: 'Orders copy' })
      );
      expect(postMessage).toHaveBeenCalledWith({
        type: 'addSchemaEntity',
        payload: { value: entity({ id: 'schema-2', name: 'Orders copy' }) },
      });
    });
  });

  describe('a failure the caller fires and forgets', () => {
    const actions: Array<
      [string, () => (...args: any[]) => Promise<unknown>, unknown[]]
    > = [
      ['loading the list', useUpdateSchemaEntities, []],
      ['adding a schema', useAddSchemaEntity, [{ name: 'Blog' }]],
      ['duplicating a schema', useDuplicateSchemaEntity, ['schema-1']],
      ['deleting a schema', useDeleteSchemaEntity, ['schema-1']],
      ['emptying the trash', useEmptyTrash, []],
    ];

    it.each(actions)(
      'settles %s and reports it',
      async (_, useAction, args) => {
        store.set(schemaEntitiesAtom, [entity({ deletedAt: CREATED })]);
        service.getSchemaEntities = fail;
        service.addSchemaEntity = fail;
        service.duplicateSchemaEntity = fail;
        service.deleteSchemaEntity = fail;
        const { result } = renderHook(useAction, store);

        const reasons = await collectUnhandledRejections(async () => {
          await expect(result.current(...args)).resolves.toBeUndefined();
        });

        expect(reasons).toEqual([]);
        expect(Sentry.captureException).toHaveBeenCalledWith(FAILURE);
      }
    );

    it('puts a schema whose delete failed back in the list', async () => {
      const trashed = entity({ deletedAt: CREATED });
      store.set(schemaEntitiesAtom, [trashed]);
      service.deleteSchemaEntity = fail;
      const { result } = renderHook(useEmptyTrash, store);

      await result.current();

      expect(store.get(schemaEntitiesAtom)).toEqual([trashed]);
      expect(postMessage).not.toHaveBeenCalled();
    });
  });
});
