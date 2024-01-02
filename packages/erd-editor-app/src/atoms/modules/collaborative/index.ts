import { atom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithImmer } from 'jotai-immer';

import { getAppDatabaseService } from '@/services/indexeddb';
import {
  dispatch,
  startSessionAction,
  stopSessionAction,
} from '@/utils/broadcastChannel';

type SchemaId = string;
type RoomId = string;
type SecretKey = string;

type Token = [RoomId, SecretKey];
type CollaborativeState = Record<SchemaId, Token>;

export const collaborativeAtom = atomWithImmer<CollaborativeState>({});

const updateCollaborativeSessionAllAtom = atom(null, async (get, set) => {
  const service = getAppDatabaseService();
  if (!service) throw new Error('Database service is not initialized');

  const sessions = await service.collaborativeSessionAll();
  set(collaborativeAtom, sessions);
});

const startSessionAtom = atom(null, async (get, set, schemaId: string) => {
  const service = getAppDatabaseService();
  if (!service) throw new Error('Database service is not initialized');

  const { roomId, secretKey } =
    await service.collaborativeStartSession(schemaId);

  set(collaborativeAtom, draft => {
    draft[schemaId] = [roomId, secretKey];
  });
  dispatch(startSessionAction({ schemaId, roomId, secretKey }));
});

const stopSessionAtom = atom(null, async (get, set, schemaId: string) => {
  const service = getAppDatabaseService();
  if (!service) throw new Error('Database service is not initialized');

  await service.collaborativeStopSession(schemaId);

  set(collaborativeAtom, draft => {
    Reflect.deleteProperty(draft, schemaId);
  });
  dispatch(stopSessionAction({ schemaId }));
});

export const useCollaborativeMap = () => useAtomValue(collaborativeAtom);
export const useUpdateCollaborativeSessionAll = () =>
  useSetAtom(updateCollaborativeSessionAllAtom);
export const useStartSession = () => useSetAtom(startSessionAtom);
export const useStopSession = () => useSetAtom(stopSessionAtom);
