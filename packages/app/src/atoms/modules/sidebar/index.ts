import { atom, useAtomValue, useSetAtom } from 'jotai';
import { loadable } from 'jotai/utils';

import { collaborativeAtom } from '@/atoms/modules/collaborative';
import { isLeader } from '@/services/collaborative/leader';
import { getAppDatabaseService } from '@/services/indexeddb';
import {
  bridge,
  collaborativeDispatchAction,
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
    dispatch(
      replicationSchemaEntityAction({
        id,
        actions: actions.filter(
          (action: any) =>
            action.type !== 'editor.sharedMouseTracker' &&
            action.type !== 'editor.sharedFocusTracker'
        ),
      })
    );

    // Peers get the unfiltered stream — shared presence is part of the session
    // even though they are noise for the cross-tab replica. Only the tab holding
    // the leadership lock owns the peer connections, so everyone else has to hand
    // the batch over the bridge.
    if (!get(collaborativeAtom)[id]) return;

    const action = collaborativeDispatchAction({ schemaId: id, actions });
    isLeader() ? bridge.emit(action) : dispatch(action);
  }
);

export const useSchemaEntity = () => useAtomValue(schemaEntityAtom);
export const useReplicationSchemaEntity = () =>
  useSetAtom(replicationSchemaEntityAtom);
