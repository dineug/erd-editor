import { atom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import { withImmer } from 'jotai-immer';

import { getAppDatabaseService } from '@/services/indexeddb';

type SchemaId = string;
type RoomId = string;
type SecretKey = string;

type Token = [RoomId, SecretKey];
type CollaborativeState = Record<SchemaId, Token>;

const storage = createJSONStorage<CollaborativeState>(
  () => globalThis.sessionStorage
);
const collaborativeStorageAtom = atomWithStorage('@collaborative', {}, storage);
const collaborativeAtom = withImmer(collaborativeStorageAtom);

const startSessionAtom = atom(null, async (get, set, schemaId: string) => {
  const service = getAppDatabaseService();
  if (!service) throw new Error('Database service is not initialized');

  const { roomId, secretKey } =
    await service.collaborativeStartSession(schemaId);

  set(collaborativeAtom, draft => {
    draft[schemaId] = [roomId, secretKey];
  });
});

const stopSessionAtom = atom(null, async (get, set, schemaId: string) => {
  const service = getAppDatabaseService();
  if (!service) throw new Error('Database service is not initialized');

  await service.collaborativeStopSession(schemaId);

  set(collaborativeAtom, draft => {
    Reflect.deleteProperty(draft, schemaId);
  });
});

export const useCollaborativeMap = () => useAtomValue(collaborativeAtom);
export const useStartSession = () => useSetAtom(startSessionAtom);
export const useStopSession = () => useSetAtom(stopSessionAtom);
