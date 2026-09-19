import { describe, expect, it } from 'vite-plus/test';

import {
  NICKNAME_MAX_LENGTH,
  participantName,
  readNickname,
  readParticipants,
} from '@/services/collaborative/participants';

describe('readNickname', () => {
  it('trims a nickname and caps it at the input limit', () => {
    expect(readNickname('  Ann  ')).toBe('Ann');
    expect(readNickname('x'.repeat(NICKNAME_MAX_LENGTH + 10))).toHaveLength(
      NICKNAME_MAX_LENGTH
    );
  });

  it('keeps an empty nickname apart from a missing one', () => {
    expect(readNickname('')).toBe('');
    expect(readNickname(undefined)).toBeUndefined();
    expect(readNickname(42)).toBeUndefined();
  });
});

describe('readParticipants', () => {
  it('keeps the well-formed entries and normalizes their nicknames', () => {
    expect(
      readParticipants([
        { peerId: 'host-1', role: 'host', nickname: ' Hana ' },
        { peerId: 'guest-1', role: 'guest' },
        { peerId: 'guest-2', role: 'admin' },
        { role: 'guest', nickname: 'no id' },
        'guest-3',
        null,
      ])
    ).toEqual([
      { peerId: 'host-1', role: 'host', nickname: 'Hana' },
      { peerId: 'guest-1', role: 'guest', nickname: undefined },
    ]);
  });

  it('reads anything but a list as an empty one', () => {
    expect(readParticipants({ peerId: 'host-1', role: 'host' })).toEqual([]);
    expect(readParticipants(null)).toEqual([]);
  });
});

describe('participantName', () => {
  it('shows the nickname a participant chose', () => {
    expect(participantName({ role: 'guest', nickname: 'Ann' })).toBe('Ann');
  });

  it('falls back to the role for a blank or missing nickname', () => {
    expect(participantName({ role: 'host', nickname: '  ' })).toBe('Host');
    expect(participantName({ role: 'guest' })).toBe('Guest');
  });
});
