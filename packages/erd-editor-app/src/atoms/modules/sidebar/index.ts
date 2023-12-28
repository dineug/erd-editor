import { atom, useAtomValue, useSetAtom } from 'jotai';
import { loadable } from 'jotai/utils';

import { getAppDatabaseService } from '@/services/indexeddb';

export const selectedSchemaIdAtom = atom<string | null>(null);

const asyncSchemaEntityAtom = atom(async get => {
  const service = getAppDatabaseService();
  if (!service) throw new Error('Database service is not initialized');

  const id = get(selectedSchemaIdAtom);
  if (!id) throw new Error('not found selected schema id');

  const result = await service.getSchemaEntity(id);
  if (!result) throw new Error('not found schema entity');

  return result;
});

const schemaEntityAtom = loadable(asyncSchemaEntityAtom);

const updateSchemaEntityValueAtom = atom(
  null,
  async (
    get,
    set,
    {
      id,
      value,
    }: {
      id: string;
      value: string;
    }
  ) => {
    const service = getAppDatabaseService();
    if (!service) throw new Error('Database service is not initialized');

    return await service.updateSchemaEntity(id, { value });
  }
);

export const useSchemaEntity = () => useAtomValue(schemaEntityAtom);
export const useUpdateSchemaEntityValue = () =>
  useSetAtom(updateSchemaEntityValueAtom);
