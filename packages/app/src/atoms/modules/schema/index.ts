import { atom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithImmer } from 'jotai-immer';

import { selectedSchemaIdAtom } from '@/atoms/modules/sidebar';
import { getAppDatabaseService } from '@/services/indexeddb';
import { SchemaEntity } from '@/services/indexeddb/modules/schema';
import {
  addSchemaEntityAction,
  deleteSchemaEntityAction,
  dispatch,
  updateSchemaEntityAction,
} from '@/utils/broadcastChannel';

export const schemaEntitiesAtom = atomWithImmer<
  Array<Omit<SchemaEntity, 'value'>>
>([]);

const updateSchemaEntitiesAtom = atom(null, async (get, set) => {
  const service = getAppDatabaseService();
  if (!service) throw new Error('Database service is not initialized');

  const entities = await service.getSchemaEntities();
  entities.sort((a, b) => {
    const nameA = a.name.toLowerCase();
    const nameB = b.name.toLowerCase();
    return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
  });
  set(schemaEntitiesAtom, entities);
});

const addSchemaEntityAtom = atom(
  null,
  async (get, set, entityValue: Pick<SchemaEntity, 'name'>) => {
    const service = getAppDatabaseService();
    if (!service) throw new Error('Database service is not initialized');

    const result = await service.addSchemaEntity(entityValue);

    set(schemaEntitiesAtom, draft => {
      draft.push(result);
    });
    set(selectedSchemaIdAtom, result.id);
    dispatch(addSchemaEntityAction({ value: result }));

    return result;
  }
);

const updateSchemaEntityAtom = atom(
  null,
  async (
    get,
    set,
    payload: {
      id: string;
      entityValue: Partial<{ name: string }>;
    }
  ) => {
    const service = getAppDatabaseService();
    if (!service) throw new Error('Database service is not initialized');

    const { id, entityValue } = payload;
    const entities = get(schemaEntitiesAtom);
    const prev = entities.find(item => item.id === id);

    const update = (newValue?: Partial<{ name: string }>) => {
      set(schemaEntitiesAtom, draft => {
        const value = draft.find(item => item.id === id);
        if (!value || !newValue) return;
        Object.assign(value, newValue);
      });
    };

    update(entityValue);

    try {
      const result = await service.updateSchemaEntity(id, entityValue);

      result ? dispatch(updateSchemaEntityAction(payload)) : update(prev);
      return result;
    } catch (error) {
      update(prev);
      throw error;
    }
  }
);

const deleteSchemaEntityAtom = atom(null, async (get, set, id: string) => {
  const service = getAppDatabaseService();
  if (!service) throw new Error('Database service is not initialized');

  const prev = get(schemaEntitiesAtom);
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
    set(schemaEntitiesAtom, prev);
    throw error;
  }
});

export const useSchemaEntities = () => useAtomValue(schemaEntitiesAtom);
export const useUpdateSchemaEntities = () =>
  useSetAtom(updateSchemaEntitiesAtom);
export const useAddSchemaEntity = () => useSetAtom(addSchemaEntityAtom);
export const useUpdateSchemaEntity = () => useSetAtom(updateSchemaEntityAtom);
export const useDeleteSchemaEntity = () => useSetAtom(deleteSchemaEntityAtom);
