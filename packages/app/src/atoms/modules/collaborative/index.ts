import { atom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { atomWithImmer } from 'jotai-immer';
import { useEffect } from 'react';

import {
  collaborativeHostService,
  Participant,
} from '@/services/collaborative';
import { getAppDatabaseService } from '@/services/indexeddb';
import {
  bridge,
  collaborativeParticipantsRequestAction,
  dispatch,
  dispatchAll,
  startSessionAction,
  stopSessionAction,
} from '@/utils/broadcastChannel';
import { useSettleReported } from '@/utils/reportError';

type SchemaId = string;
type RoomId = string;
type SecretKey = string;

type Token = [RoomId, SecretKey];
type CollaborativeState = Record<SchemaId, Token>;
type ParticipantsState = Record<SchemaId, Participant[]>;

const EMPTY_PARTICIPANTS: Participant[] = [];

export const nicknameStorageAtom = atomWithStorage<string>('@nickname', '');

export const collaborativeAtom = atomWithImmer<CollaborativeState>({});

/** The guests of each live session, as the leader tab last published them. */
export const collaborativeParticipantsAtom = atomWithImmer<ParticipantsState>(
  {}
);

const setCollaborativeParticipantsAtom = atom(
  null,
  (get, set, payload: { schemaId: SchemaId; participants: Participant[] }) => {
    const { schemaId, participants } = payload;

    set(collaborativeParticipantsAtom, draft => {
      if (participants.length) {
        draft[schemaId] = participants;
      } else {
        Reflect.deleteProperty(draft, schemaId);
      }
    });
  }
);

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
  set(collaborativeParticipantsAtom, draft => {
    Reflect.deleteProperty(draft, schemaId);
  });
  dispatch(stopSessionAction({ schemaId }));
});

export const useCollaborativeMap = () => useAtomValue(collaborativeAtom);
export const useUpdateCollaborativeSessionAll = () =>
  useSettleReported(useSetAtom(updateCollaborativeSessionAllAtom));
export const useStartSession = () =>
  useSettleReported(useSetAtom(startSessionAtom));
export const useStopSession = () =>
  useSettleReported(useSetAtom(stopSessionAtom));
export const useCollaborativeParticipants = (schemaId: SchemaId) =>
  useAtomValue(collaborativeParticipantsAtom)[schemaId] ?? EMPTY_PARTICIPANTS;

/**
 * Drives the main-thread collaboration host. The service elects one tab to own the
 * peer connections, so mounting this in more than one place is harmless — the
 * sessions themselves are only ever opened once per browser.
 */
export const useCollaborativeHost = () => {
  const collaborativeMap = useAtomValue(collaborativeAtom);
  const nickname = useAtomValue(nicknameStorageAtom);
  const setParticipants = useSetAtom(setCollaborativeParticipantsAtom);

  useEffect(() => {
    collaborativeHostService.start();
    const unsubscribe = bridge.on({
      collaborativeParticipants: ({ payload }) => setParticipants(payload),
    });
    // Only the leader has the connections; this asks it for what it holds.
    // Posted to this tab too, in case this tab is the leader.
    dispatchAll(collaborativeParticipantsRequestAction());

    return () => {
      collaborativeHostService.stop();
      unsubscribe();
    };
  }, [setParticipants]);

  useEffect(() => {
    collaborativeHostService.setSessions(collaborativeMap);
  }, [collaborativeMap]);

  useEffect(() => {
    collaborativeHostService.setNickname(nickname);
  }, [nickname]);
};
