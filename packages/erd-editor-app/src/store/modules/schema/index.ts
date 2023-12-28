import { atom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithImmer } from 'jotai-immer';

import { getAppDatabaseService } from '@/services/indexeddb';
import { SchemaEntity } from '@/services/indexeddb/modules/schema';
import { selectedSchemaIdAtom } from '@/store/modules/sidebar';

const schemaEntitiesAtom = atomWithImmer<Array<Omit<SchemaEntity, 'value'>>>(
  []
);

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

    return result;
  }
);

const updateSchemaEntityAtom = atom(
  null,
  async (
    get,
    set,
    {
      id,
      entityValue,
    }: {
      id: string;
      entityValue: Partial<{ name: string; value: string }>;
    }
  ) => {
    const service = getAppDatabaseService();
    if (!service) throw new Error('Database service is not initialized');

    set(schemaEntitiesAtom, draft => {
      const value = draft.find(item => item.id === id);
      if (!value) return;
      Object.assign(value, entityValue);
    });

    return await service.updateSchemaEntity(id, entityValue);
  }
);

const deleteSchemaEntityAtom = atom(null, async (get, set, id: string) => {
  const service = getAppDatabaseService();
  if (!service) throw new Error('Database service is not initialized');

  set(schemaEntitiesAtom, draft => {
    const index = draft.findIndex(item => item.id === id);
    if (index === -1) return;
    draft.splice(index, 1);
  });

  const selectedSchemaId = get(selectedSchemaIdAtom);
  if (selectedSchemaId === id) {
    set(selectedSchemaIdAtom, null);
  }

  await service.deleteSchemaEntity(id);
});

export const useSchemaEntities = () => useAtomValue(schemaEntitiesAtom);
export const useUpdateSchemaEntities = () =>
  useSetAtom(updateSchemaEntitiesAtom);
export const useAddSchemaEntity = () => useSetAtom(addSchemaEntityAtom);
export const useUpdateSchemaEntity = () => useSetAtom(updateSchemaEntityAtom);
export const useDeleteSchemaEntity = () => useSetAtom(deleteSchemaEntityAtom);
