import { omit } from 'es-toolkit';
import { atom, useAtomValue, useSetAtom, useStore } from 'jotai';
import { atomWithImmer } from 'jotai-immer';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useMemo } from 'react';

import {
  collaborativeAtom,
  useStopSession,
} from '@/atoms/modules/collaborative';
import { selectedSchemaIdAtom } from '@/atoms/modules/sidebar';
import { getAppDatabaseService } from '@/services/indexeddb';
import { SchemaEntity } from '@/services/indexeddb/modules/schema';
import {
  addSchemaEntityAction,
  deleteSchemaEntityAction,
  dispatch,
  updateSchemaEntityAction,
} from '@/utils/broadcastChannel';
import { useSettleReported } from '@/utils/reportError';
import { sortSchemaEntities } from '@/utils/schemaList';
import { isTrashExpired } from '@/utils/trash';

type SchemaListEntity = Omit<SchemaEntity, 'value'>;
type EntityValue = Partial<
  Pick<SchemaEntity, 'name' | 'updateAt' | 'deletedAt'>
>;

const MINUTE = 60_000;

const isTrashed = (entity: SchemaListEntity) =>
  typeof entity.deletedAt === 'number';

/** Every schema this tab knows of, trash included, in no particular order. */
export const schemaEntitiesAtom = atomWithImmer<Array<SchemaListEntity>>([]);

/** The sidebar list: schemas outside the trash, newest edit first. */
export const schemaListAtom = atom(get =>
  sortSchemaEntities(
    get(schemaEntitiesAtom).filter(entity => !isTrashed(entity))
  )
);

/** The open schema's list entry, which follows renames from any tab. */
export const selectedSchemaListEntityAtom = atom(get => {
  const id = get(selectedSchemaIdAtom);
  return id ? get(schemaListAtom).find(entity => entity.id === id) : undefined;
});

/** The trash, most recently deleted first. */
export const trashedSchemaEntitiesAtom = atom(get =>
  get(schemaEntitiesAtom)
    .filter(isTrashed)
    .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
);

/**
 * The time the list's date groups and relative labels are read against, taken
 * again every minute and whenever the tab comes back into view, so an open tab
 * rolls over at midnight.
 */
export const nowAtom = atom(Date.now());
nowAtom.onMount = setNow => {
  const tick = () => setNow(Date.now());
  const timer = window.setInterval(tick, MINUTE);

  tick();
  document.addEventListener('visibilitychange', tick);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', tick);
  };
};

/** Loads the list, then purges what it finds has sat in the trash for 30 days. */
const updateSchemaEntitiesAtom = atom(null, async (get, set) => {
  const service = getAppDatabaseService();
  if (!service) throw new Error('Database service is not initialized');

  const entities = await service.getSchemaEntities();
  set(schemaEntitiesAtom, entities);
  await set(purgeExpiredTrashAtom);
});

const addSchemaEntityAtom = atom(
  null,
  async (get, set, entityValue: Pick<SchemaEntity, 'name'>) => {
    const service = getAppDatabaseService();
    if (!service) throw new Error('Database service is not initialized');

    const result = await service.addSchemaEntity(entityValue);
    const entity = omit(result, ['value']);

    set(schemaEntitiesAtom, draft => {
      draft.push(entity);
    });
    set(selectedSchemaIdAtom, result.id);
    dispatch(addSchemaEntityAction({ value: entity }));

    return result;
  }
);

const duplicateSchemaEntityAtom = atom(null, async (get, set, id: string) => {
  const service = getAppDatabaseService();
  if (!service) throw new Error('Database service is not initialized');

  const source = get(schemaEntitiesAtom).find(item => item.id === id);
  if (!source) return;

  const result = await service.duplicateSchemaEntity(id, {
    name: `${source.name} copy`,
  });
  if (!result) return;

  const entity = omit(result, ['value']);

  set(schemaEntitiesAtom, draft => {
    draft.push(entity);
  });
  set(selectedSchemaIdAtom, result.id);
  dispatch(addSchemaEntityAction({ value: entity }));

  return result;
});

const updateSchemaEntityAtom = atom(
  null,
  async (
    get,
    set,
    payload: {
      id: string;
      entityValue: EntityValue;
    }
  ) => {
    const service = getAppDatabaseService();
    if (!service) throw new Error('Database service is not initialized');

    const { id, entityValue } = payload;
    const prev = get(schemaEntitiesAtom).find(item => item.id === id);
    const keys = Object.keys(entityValue) as Array<keyof EntityValue>;

    set(schemaEntitiesAtom, draft => {
      const value = draft.find(item => item.id === id);
      if (value) Object.assign(value, entityValue);
    });

    // Puts back exactly the fields this update set, taking away the ones the
    // entity did not have, and leaves the rest to whatever changed them since.
    const rollback = () => {
      set(schemaEntitiesAtom, draft => {
        const value = draft.find(item => item.id === id);
        if (!value || !prev) return;

        for (const key of keys) {
          key in prev
            ? Object.assign(value, { [key]: prev[key] })
            : Reflect.deleteProperty(value, key);
        }
      });
    };

    try {
      const result = await service.updateSchemaEntity(id, entityValue);

      result ? dispatch(updateSchemaEntityAction(payload)) : rollback();
      return result;
    } catch (error) {
      rollback();
      throw error;
    }
  }
);

const moveSchemaEntityToTrashAtom = atom(null, async (get, set, id: string) => {
  if (get(selectedSchemaIdAtom) === id) {
    set(selectedSchemaIdAtom, null);
  }

  return await set(updateSchemaEntityAtom, {
    id,
    entityValue: { deletedAt: Date.now() },
  });
});

const restoreSchemaEntityAtom = atom(null, async (get, set, id: string) => {
  return await set(updateSchemaEntityAtom, {
    id,
    entityValue: { deletedAt: null },
  });
});

const deleteSchemaEntityAtom = atom(null, async (get, set, id: string) => {
  const service = getAppDatabaseService();
  if (!service) throw new Error('Database service is not initialized');

  const prev = get(schemaEntitiesAtom).find(item => item.id === id);
  const selectedSchemaId = get(selectedSchemaIdAtom);

  set(schemaEntitiesAtom, draft => {
    const index = draft.findIndex(item => item.id === id);
    if (index === -1) return;
    draft.splice(index, 1);
  });

  try {
    await service.deleteSchemaEntity(id);
    if (selectedSchemaId === id) {
      set(selectedSchemaIdAtom, null);
    }
    dispatch(deleteSchemaEntityAction({ id }));
  } catch (error) {
    if (prev) {
      set(schemaEntitiesAtom, draft => {
        draft.push(prev);
      });
    }
    throw error;
  }
});

const emptyTrashAtom = atom(null, async (get, set) => {
  const ids = get(trashedSchemaEntitiesAtom).map(entity => entity.id);
  await Promise.all(ids.map(id => set(deleteSchemaEntityAtom, id)));
});

/**
 * Deletes for good what has sat in the trash for 30 days, the way Delete
 * permanently does. Tabs purging at once are harmless: deleting a missing row
 * resolves, and the other tabs drop an id they no longer list without a word.
 */
const purgeExpiredTrashAtom = atom(null, async (get, set) => {
  const now = DateTime.now();
  const ids = get(trashedSchemaEntitiesAtom)
    .filter(entity => isTrashExpired(entity.deletedAt, now))
    .map(entity => entity.id);

  await Promise.all(ids.map(id => set(deleteSchemaEntityAtom, id)));
});

export const useSchemaEntities = () => useAtomValue(schemaListAtom);
export const useSelectedSchemaListEntity = () =>
  useAtomValue(selectedSchemaListEntityAtom);
export const useTrashedSchemaEntities = () =>
  useAtomValue(trashedSchemaEntitiesAtom);
// Callers fire these and forget them, so a failure is reported rather than
// rejected, after the actions that show a change early have rolled it back.
export const useUpdateSchemaEntities = () =>
  useSettleReported(useSetAtom(updateSchemaEntitiesAtom));
export const useAddSchemaEntity = () =>
  useSettleReported(useSetAtom(addSchemaEntityAtom));
export const useDuplicateSchemaEntity = () =>
  useSettleReported(useSetAtom(duplicateSchemaEntityAtom));
export const useUpdateSchemaEntity = () =>
  useSettleReported(useSetAtom(updateSchemaEntityAtom));
export const useRestoreSchemaEntity = () =>
  useSettleReported(useSetAtom(restoreSchemaEntityAtom));
export const useDeleteSchemaEntity = () =>
  useSettleReported(useSetAtom(deleteSchemaEntityAtom));
export const useEmptyTrash = () =>
  useSettleReported(useSetAtom(emptyTrashAtom));

/** Moves a schema to the trash, ending its collaboration session if one is running. */
export const useMoveSchemaEntityToTrash = () => {
  const store = useStore();
  const moveToTrash = useSetAtom(moveSchemaEntityToTrashAtom);
  const stopSession = useStopSession();

  return useSettleReported(
    useCallback(
      async (id: string) => {
        const result = await moveToTrash(id);

        if (result && store.get(collaborativeAtom)[id]) {
          await stopSession(id);
        }
        return result;
      },
      [store, moveToTrash, stopSession]
    )
  );
};

export const useNow = () => {
  const now = useAtomValue(nowAtom);
  return useMemo(() => DateTime.fromMillis(now), [now]);
};

/**
 * Purges the trash on the first tick of now in each new day and whenever the
 * tab is shown again. Loading the list purges it first, so the run on mount,
 * before the list is in, finds nothing.
 */
export const usePurgeExpiredTrash = () => {
  const purge = useSettleReported(useSetAtom(purgeExpiredTrashAtom));
  const today = useNow().toISODate();

  useEffect(() => {
    purge();
  }, [today, purge]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') purge();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [purge]);
};
