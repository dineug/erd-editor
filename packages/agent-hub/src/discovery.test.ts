import { describe, expect, it } from 'vite-plus/test';

import { type LockFile, selectHub } from '@/discovery';
import { type LockRecord, serializeLock } from '@/lock';

type LockInit = Partial<LockRecord> & { pid: number; mtimeMs?: number };

function lock({ pid, mtimeMs = 1000, ...fields }: LockInit): LockFile {
  const record: LockRecord = {
    pipe: `/home/me/.erd-editor/ide/${pid}.sock`,
    workspaceFolders: [],
    documents: [],
    ide: 'vscode',
    version: '2.9.0',
    protocolVersion: 1,
    token: `token-${pid}`,
    hub: true,
    ...fields,
  };
  return { pid, raw: serializeLock(record), mtimeMs };
}

const alive = () => true;

function pick(locks: LockFile[], target: string, platform = 'linux') {
  return selectHub(locks, target, platform, alive);
}

function selectedPid(result: ReturnType<typeof selectHub>) {
  return result.selected.kind === 'headless'
    ? null
    : result.selected.candidate.pid;
}

describe('selectHub', () => {
  it('goes headless when there is no lock', () => {
    expect(pick([], '/ws/model.erd.json')).toEqual({
      selected: { kind: 'headless' },
      stale: [],
    });
  });

  it('goes headless when no lock covers the target', () => {
    const result = pick(
      [lock({ pid: 1, workspaceFolders: ['/other'] })],
      '/ws/model.erd.json'
    );
    expect(result.selected).toEqual({ kind: 'headless' });
  });

  it('returns the parsed lock of a live hub', () => {
    const file = lock({ pid: 7, workspaceFolders: ['/ws'], mtimeMs: 55 });
    const result = pick([file], '/ws/model.erd.json');

    expect(result.selected).toEqual({
      kind: 'live',
      candidate: {
        pid: 7,
        mtimeMs: 55,
        record: expect.objectContaining({
          pipe: '/home/me/.erd-editor/ide/7.sock',
          token: 'token-7',
        }),
      },
    });
  });

  it('picks the deepest of nested workspaces', () => {
    const locks = [
      lock({ pid: 1, workspaceFolders: ['/ws'] }),
      lock({ pid: 2, workspaceFolders: ['/ws/app/packages'] }),
      lock({ pid: 3, workspaceFolders: ['/ws/app'] }),
    ];

    expect(selectedPid(pick(locks, '/ws/app/packages/x.erd'))).toBe(2);
    expect(selectedPid(pick(locks, '/ws/app/x.erd'))).toBe(3);
    expect(selectedPid(pick(locks, '/ws/x.erd'))).toBe(1);
  });

  it('uses the deepest folder of a multi-root lock', () => {
    const locks = [
      lock({ pid: 1, workspaceFolders: ['/ws/app/deep', '/unrelated'] }),
      lock({ pid: 2, workspaceFolders: ['/ws', '/ws/app/deep/er'] }),
    ];

    expect(selectedPid(pick(locks, '/ws/app/deep/er/x.erd'))).toBe(2);
    expect(selectedPid(pick(locks, '/ws/app/deep/x.erd'))).toBe(1);
  });

  it('breaks a folder tie by the newest lock, whatever the order', () => {
    const older = lock({ pid: 1, workspaceFolders: ['/ws'], mtimeMs: 100 });
    const newer = lock({ pid: 2, workspaceFolders: ['/ws'], mtimeMs: 200 });

    expect(selectedPid(pick([older, newer], '/ws/x.erd'))).toBe(2);
    expect(selectedPid(pick([newer, older], '/ws/x.erd'))).toBe(2);
  });

  it('breaks a documents tie by the same rule when two windows open one file', () => {
    const target = '/tmp/shared.erd.json';
    const older = lock({ pid: 1, documents: [target], mtimeMs: 100 });
    const newer = lock({ pid: 2, documents: [target], mtimeMs: 200 });

    expect(selectedPid(pick([older, newer], target))).toBe(2);
    expect(selectedPid(pick([newer, older], target))).toBe(2);
  });

  it('falls back to the higher pid when mtimes are equal too', () => {
    const a = lock({ pid: 30, workspaceFolders: ['/ws'], mtimeMs: 100 });
    const b = lock({ pid: 40, workspaceFolders: ['/ws'], mtimeMs: 100 });

    expect(selectedPid(pick([a, b], '/ws/x.erd'))).toBe(40);
    expect(selectedPid(pick([b, a], '/ws/x.erd'))).toBe(40);
  });

  it('prefers an open document over any folder prefix, even a newer one', () => {
    const target = '/ws/app/model.erd.json';
    const folder = lock({
      pid: 1,
      workspaceFolders: ['/ws/app'],
      mtimeMs: 900,
    });
    const holder = lock({
      pid: 2,
      workspaceFolders: ['/elsewhere'],
      documents: [target],
      mtimeMs: 100,
    });

    expect(selectedPid(pick([folder, holder], target))).toBe(2);
    expect(selectedPid(pick([holder, folder], target))).toBe(2);
  });

  it('matches a folderless window only on its own open documents', () => {
    const folderless = lock({
      pid: 5,
      documents: ['/tmp/scratch/model.erd.json'],
    });

    expect(selectedPid(pick([folderless], '/tmp/scratch/model.erd.json'))).toBe(
      5
    );
    expect(pick([folderless], '/tmp/scratch/other.erd.json').selected).toEqual({
      kind: 'headless',
    });
    expect(pick([folderless], '/tmp/scratch').selected).toEqual({
      kind: 'headless',
    });
  });

  it('does not match a folder that only shares a name prefix', () => {
    const result = pick(
      [lock({ pid: 1, workspaceFolders: ['/ws/app'] })],
      '/ws/apple/x.erd'
    );
    expect(result.selected).toEqual({ kind: 'headless' });
  });

  it('compares case-insensitively on darwin and win32', () => {
    const mac = lock({ pid: 1, workspaceFolders: ['/Users/me/WS'] });
    const win = lock({ pid: 2, documents: ['C:\\Docs\\Model.erd'] });

    expect(selectedPid(pick([mac], '/users/me/ws/x.erd', 'darwin'))).toBe(1);
    expect(pick([mac], '/users/me/ws/x.erd', 'linux').selected.kind).toBe(
      'headless'
    );
    expect(selectedPid(pick([win], 'c:/docs/model.erd', 'win32'))).toBe(2);
  });

  it('reports a hub-false window as blocked', () => {
    const result = pick(
      [lock({ pid: 9, workspaceFolders: ['/ws'], hub: false, pipe: '' })],
      '/ws/x.erd'
    );

    expect(result.selected.kind).toBe('blocked');
    expect(selectedPid(result)).toBe(9);
  });

  it('lets the best match decide between a blocked and a live window', () => {
    const blockedRoot = lock({
      pid: 1,
      workspaceFolders: ['/ws'],
      hub: false,
      pipe: '',
    });
    const liveApp = lock({ pid: 2, workspaceFolders: ['/ws/app'] });

    expect(pick([blockedRoot, liveApp], '/ws/app/x.erd').selected.kind).toBe(
      'live'
    );
    expect(pick([blockedRoot, liveApp], '/ws/lib/x.erd').selected.kind).toBe(
      'blocked'
    );
  });

  it('marks a dead pid stale and never selects it', () => {
    const dead = lock({ pid: 11, workspaceFolders: ['/ws/app'] });
    const live = lock({ pid: 12, workspaceFolders: ['/ws'] });
    const result = selectHub([dead, live], '/ws/app/x.erd', 'linux', pid => {
      return pid !== 11;
    });

    expect(result.stale).toEqual([{ pid: 11, reason: 'dead' }]);
    expect(selectedPid(result)).toBe(12);
  });

  it('marks a malformed lock of a live pid stale as malformed', () => {
    const malformed: LockFile = { pid: 21, raw: '{"pipe":', mtimeMs: 1 };
    const result = pick([malformed], '/ws/x.erd');

    expect(result.stale).toEqual([{ pid: 21, reason: 'malformed' }]);
    expect(result.selected).toEqual({ kind: 'headless' });
  });

  it('calls a malformed lock of a dead pid dead, the reason that allows removal', () => {
    const result = selectHub(
      [{ pid: 31, raw: 'garbage', mtimeMs: 1 }],
      '/ws/x.erd',
      'linux',
      () => false
    );
    expect(result.stale).toEqual([{ pid: 31, reason: 'dead' }]);
  });

  it('reports stale locks even when they would not match the target', () => {
    const result = selectHub(
      [
        lock({ pid: 41, workspaceFolders: ['/other'] }),
        { pid: 42, raw: '[]', mtimeMs: 1 },
      ],
      '/ws/x.erd',
      'linux',
      pid => pid !== 41
    );

    expect(result.stale).toEqual([
      { pid: 41, reason: 'dead' },
      { pid: 42, reason: 'malformed' },
    ]);
  });
});
