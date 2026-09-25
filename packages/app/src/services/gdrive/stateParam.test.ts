import { describe, expect, it } from 'vite-plus/test';

import {
  isStateForAccount,
  parseDriveState,
} from '@/services/gdrive/stateParam';

const state = (value: unknown) => JSON.stringify(value);

describe('parseDriveState', () => {
  it('is null without a state', () => {
    expect(parseDriveState(null)).toBeNull();
  });

  it('opens the first of the ids, keeping every id and resource key', () => {
    expect(
      parseDriveState(
        state({
          action: 'open',
          ids: ['file-a', 'file-b'],
          resourceKeys: { 'file-a': '0-key_a' },
          userId: '1234567890',
        })
      )
    ).toEqual({
      action: 'open',
      fileId: 'file-a',
      ids: ['file-a', 'file-b'],
      resourceKeys: { 'file-a': '0-key_a' },
      userId: '1234567890',
    });
  });

  it('reads an open without resource keys or user as empty and null', () => {
    expect(parseDriveState(state({ action: 'open', ids: ['file-a'] }))).toEqual(
      {
        action: 'open',
        fileId: 'file-a',
        ids: ['file-a'],
        resourceKeys: {},
        userId: null,
      }
    );
  });

  it('creates in the folder Drive names', () => {
    expect(
      parseDriveState(
        state({
          action: 'create',
          folderId: 'folder-1',
          folderResourceKey: 'folder-key',
          userId: '42',
        })
      )
    ).toEqual({
      action: 'create',
      folderId: 'folder-1',
      folderResourceKey: 'folder-key',
      userId: '42',
    });
  });

  it('reads no folder when none is named', () => {
    expect(parseDriveState(state({ action: 'create' }))).toEqual({
      action: 'create',
      folderId: null,
      folderResourceKey: null,
      userId: null,
    });
  });

  it.each([
    ['not JSON', '{action:open'],
    ['JSON that is not an object', state(['open'])],
    ['null', 'null'],
    ['an unknown action', state({ action: 'share', ids: ['a'] })],
    ['an open without ids', state({ action: 'open' })],
    ['an open with no id', state({ action: 'open', ids: [] })],
    ['an id with a slash', state({ action: 'open', ids: ['a/b'] })],
    ['an id that is not a string', state({ action: 'open', ids: [7] })],
    ['an id too long', state({ action: 'open', ids: ['a'.repeat(257)] })],
    [
      'resource keys that are a list',
      state({ action: 'open', ids: ['a'], resourceKeys: ['k'] }),
    ],
    [
      'a resource key that is not a string',
      state({ action: 'open', ids: ['a'], resourceKeys: { a: 1 } }),
    ],
    [
      'a resource key for a malformed id',
      state({ action: 'open', ids: ['a'], resourceKeys: { 'a b': 'k' } }),
    ],
    ...['0-a\nb', '0-a,b/c', '0-a/b', '0-a b', '0-ключ', 'k'.repeat(257)].map(
      key => [
        `the resource key ${JSON.stringify(key.slice(0, 12))}`,
        state({ action: 'open', ids: ['a'], resourceKeys: { a: key } }),
      ]
    ),
    ['a malformed folder', state({ action: 'create', folderId: '../x' })],
    [
      'an empty folder key',
      state({ action: 'create', folderId: 'f', folderResourceKey: '' }),
    ],
    [
      'a folder key with a comma',
      state({ action: 'create', folderId: 'f', folderResourceKey: '0-a,b/c' }),
    ],
    ['a user id that is not a string', state({ action: 'create', userId: 5 })],
    ['a user id with spaces', state({ action: 'create', userId: 'a b' })],
  ])('refuses %s', (_label, raw) => {
    expect(parseDriveState(raw)).toBe('invalid');
  });
});

describe('isStateForAccount', () => {
  it('matches the user id Drive sent with the signed-in sub', () => {
    const open = parseDriveState(
      state({ action: 'open', ids: ['a'], userId: 'sub-1' })
    );
    if (!open || open === 'invalid') throw new Error('unparsed');

    expect(isStateForAccount(open, 'sub-1')).toBe(true);
    expect(isStateForAccount(open, 'sub-2')).toBe(false);
  });

  it('fits any account when Drive sent no user id', () => {
    const create = parseDriveState(state({ action: 'create' }));
    if (!create || create === 'invalid') throw new Error('unparsed');

    expect(isStateForAccount(create, 'anyone')).toBe(true);
  });
});
