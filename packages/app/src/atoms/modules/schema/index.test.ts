import * as Sentry from '@sentry/react';
import { createStore } from 'jotai';
import { DateTime } from 'luxon';
import { act } from 'react';
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
  usePurgeExpiredTrash,
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
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

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

const trashedDaysAgo = (id: string, days: number) =>
  entity({
    id,
    name: id,
    deletedAt: DateTime.now().minus({ days }).toMillis(),
  });

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

  describe('the 30-day trash purge', () => {
    it('deletes what the loaded list has had in the trash for 30 days, and tells the other tabs', async () => {
      const expired = trashedDaysAgo('expired', 31);
      const expiring = trashedDaysAgo('expiring', 29);
      const kept = entity({ id: 'kept' });
      const deleted: string[] = [];
      service.getSchemaEntities = async () => [expired, expiring, kept];
      service.deleteSchemaEntity = async id => {
        deleted.push(id);
      };
      const { result } = renderHook(useUpdateSchemaEntities, store);

      await result.current();

      expect(deleted).toEqual(['expired']);
      expect(store.get(schemaEntitiesAtom)).toEqual([expiring, kept]);
      expect(postMessage).toHaveBeenCalledTimes(1);
      expect(postMessage).toHaveBeenCalledWith({
        type: 'deleteSchemaEntity',
        payload: { id: 'expired' },
      });
    });

    it('lets two tabs purge the same schema at once', async () => {
      const expired = trashedDaysAgo('expired', 31);
      const rows = new Map([[expired.id, expired]]);
      service.getSchemaEntities = async () => Array.from(rows.values());
      service.deleteSchemaEntity = async id => {
        rows.delete(id);
      };
      const tabs = [store, createStore()];
      const loads = tabs.map(tab => renderHook(useUpdateSchemaEntities, tab));

      await Promise.all(loads.map(({ result }) => result.current()));

      expect(rows.size).toBe(0);
      for (const tab of tabs) {
        expect(tab.get(schemaEntitiesAtom)).toEqual([]);
      }
      expect(postMessage).toHaveBeenCalledTimes(2);
      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('puts back a schema whose purge failed, and reports it', async () => {
      const expired = trashedDaysAgo('expired', 31);
      service.getSchemaEntities = async () => [expired];
      service.deleteSchemaEntity = fail;
      const { result } = renderHook(useUpdateSchemaEntities, store);

      const reasons = await collectUnhandledRejections(async () => {
        await expect(result.current()).resolves.toBeUndefined();
      });

      expect(reasons).toEqual([]);
      expect(store.get(schemaEntitiesAtom)).toEqual([expired]);
      expect(postMessage).not.toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(FAILURE);
    });

    describe('in a tab left open', () => {
      const local = (month: number, day: number, hour: number, minute = 0) =>
        DateTime.local(2026, month, day, hour, minute).toMillis();
      const advance = (ms: number) =>
        act(async () => {
          await vi.advanceTimersByTimeAsync(ms);
        });
      let deleted: string[];

      beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
        vi.setSystemTime(local(9, 20, 12));
        deleted = [];
        service.deleteSchemaEntity = async id => {
          deleted.push(id);
        };
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('purges on the first tick of a new day, and on no tick before it', async () => {
        // Due at 18:00 today, after the purge this tab last ran.
        store.set(schemaEntitiesAtom, [
          entity({ id: 'due', deletedAt: local(8, 21, 18) }),
        ]);
        const { unmount } = renderHook(usePurgeExpiredTrash, store);

        await advance(12 * HOUR - MINUTE);
        expect(deleted).toEqual([]);

        await advance(MINUTE);
        expect(deleted).toEqual(['due']);
        expect(store.get(schemaEntitiesAtom)).toEqual([]);
        unmount();
      });

      it('purges when the tab is shown again, not when it is hidden', async () => {
        store.set(schemaEntitiesAtom, [
          entity({ id: 'due', deletedAt: local(8, 21, 12, 30) }),
        ]);
        const { unmount } = renderHook(usePurgeExpiredTrash, store);
        const visibility = vi.spyOn(document, 'visibilityState', 'get');
        const changeVisibility = (state: DocumentVisibilityState) =>
          act(() => {
            visibility.mockReturnValue(state);
            document.dispatchEvent(new Event('visibilitychange'));
          });

        await advance(HOUR);
        changeVisibility('hidden');
        expect(deleted).toEqual([]);

        changeVisibility('visible');
        expect(deleted).toEqual(['due']);
        unmount();
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
