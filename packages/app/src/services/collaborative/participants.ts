import { isPlainObject } from 'es-toolkit';

import { Role } from '@/services/collaborative/room';

export const NICKNAME_MAX_LENGTH = 30;

/** How long a peer waits for the typing to settle before re-announcing a nickname. */
export const NICKNAME_ANNOUNCE_DELAY = 500;

export type Participant = {
  peerId: string;
  role: Role;
  nickname?: string;
};

/**
 * Undefined only for a peer that sent no nickname at all, which is how a build
 * from before the participants list tells itself apart from one left blank.
 */
export function readNickname(value: unknown): string | undefined {
  return typeof value === 'string'
    ? value.trim().slice(0, NICKNAME_MAX_LENGTH)
    : undefined;
}

/** Keeps the well-formed entries of a list another peer sent. */
export function readParticipants(value: unknown): Participant[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap(item => {
    if (!isPlainObject(item) || typeof item.peerId !== 'string') return [];
    if (item.role !== Role.host && item.role !== Role.guest) return [];

    return [
      {
        peerId: item.peerId,
        role: item.role,
        nickname: readNickname(item.nickname),
      },
    ];
  });
}

export const participantName = ({
  role,
  nickname,
}: Pick<Participant, 'role' | 'nickname'>) =>
  nickname?.trim() || (role === Role.host ? 'Host' : 'Guest');
