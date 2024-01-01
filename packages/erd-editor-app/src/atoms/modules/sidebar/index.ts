import { atom, useAtomValue, useSetAtom } from 'jotai';
import { loadable } from 'jotai/utils';

import { getAppDatabaseService } from '@/services/indexeddb';
import {
  dispatch,
  replicationSchemaEntityAction,
} from '@/utils/broadcastChannel';

export const selectedSchemaIdAtom = atom<string | null>(null);

const asyncSchemaEntityAtom = atom(async get => {
  const id = get(selectedSchemaIdAtom);
  const service = getAppDatabaseService();

  if (!service) throw new Error('Database service is not initialized');
  if (!id) throw new Error('not found selected schema id');

  const result = await service.getSchemaEntity(id);
  if (!result) throw new Error('not found schema entity');

  return result;
});

const schemaEntityAtom = loadable(asyncSchemaEntityAtom);

const replicationSchemaEntityAtom = atom(
  null,
  async (
    get,
    set,
    {
      id,
      actions,
    }: {
      id: string;
      actions: any;
    }
  ) => {
    const service = getAppDatabaseService();
    if (!service) throw new Error('Database service is not initialized');

    service.replicationSchemaEntity(id, actions);
    dispatch(replicationSchemaEntityAction({ id, actions }));
  }
);

export const useSchemaEntity = () => useAtomValue(schemaEntityAtom);
export const useReplicationSchemaEntity = () =>
  useSetAtom(replicationSchemaEntityAtom);
