import { describe, expect, it } from 'vite-plus/test';

import {
  LOCK_DIR_MODE,
  LOCK_FILE_MODE,
  lockDirPath,
  lockFilePath,
  lockFilePid,
  type LockRecord,
  MAX_PIPE_PATH_BYTES,
  parseLock,
  pipePath,
  pipePathFits,
  serializeLock,
} from '@/lock';

const record: LockRecord = {
  pipe: '/home/me/.erd-editor/ide/4242.sock',
  workspaceFolders: ['/home/me/ws'],
  documents: ['/home/me/ws/model.erd.json', '/tmp/scratch.erd'],
  ide: 'vscode',
  version: '2.9.0',
  protocolVersion: 1,
  token: '6f1c2c1e-6a53-4a55-9d7e-3b8f3f0d6a10',
  hub: true,
};

describe('lock paths', () => {
  it('keeps every lock under the home directory', () => {
    expect(lockDirPath('/home/me')).toBe('/home/me/.erd-editor/ide');
    expect(lockFilePath('/home/me', 4242)).toBe(
      '/home/me/.erd-editor/ide/4242.json'
    );
  });

  it('drops trailing separators from the home directory', () => {
    expect(lockDirPath('/home/me/')).toBe('/home/me/.erd-editor/ide');
    expect(lockDirPath('/')).toBe('/.erd-editor/ide');
    expect(lockDirPath('C:\\Users\\me\\')).toBe(
      'C:\\Users\\me/.erd-editor/ide'
    );
  });

  it('puts the unix socket beside the lock file', () => {
    expect(pipePath('/home/me', 4242, 'linux')).toBe(
      '/home/me/.erd-editor/ide/4242.sock'
    );
    expect(pipePath('/Users/me', 7, 'darwin')).toBe(
      '/Users/me/.erd-editor/ide/7.sock'
    );
  });

  it('uses a named pipe keyed by pid on win32, whatever the home directory', () => {
    expect(pipePath('C:\\Users\\me', 4242, 'win32')).toBe(
      '\\\\.\\pipe\\erd-editor-ide-4242'
    );
  });

  it('restricts the directory and the file to their owner', () => {
    expect(LOCK_DIR_MODE).toBe(0o700);
    expect(LOCK_FILE_MODE).toBe(0o600);
  });
});

describe('pipePathFits', () => {
  it('accepts a socket path up to the byte limit and refuses one past it', () => {
    const atLimit = `/${'a'.repeat(MAX_PIPE_PATH_BYTES - 1)}`;

    expect(MAX_PIPE_PATH_BYTES).toBe(100);
    expect(pipePathFits(atLimit, 'linux')).toBe(true);
    expect(pipePathFits(`${atLimit}a`, 'darwin')).toBe(false);
  });

  it('counts UTF-8 bytes, not characters', () => {
    const path = `/${'가'.repeat(34)}`;

    expect(path.length).toBeLessThan(MAX_PIPE_PATH_BYTES);
    expect(pipePathFits(path, 'linux')).toBe(false);
  });

  it('never limits a win32 named pipe', () => {
    expect(pipePathFits(`\\\\.\\pipe\\${'a'.repeat(200)}`, 'win32')).toBe(true);
  });
});

describe('lockFilePid', () => {
  it.each([
    ['4242.json', 4242],
    ['1.json', 1],
  ])('reads %s as pid %d', (name, pid) => {
    expect(lockFilePid(name)).toBe(pid);
  });

  it.each([
    '4242.sock',
    '4242.json.tmp',
    '0.json',
    '-1.json',
    '0042.json',
    'abc.json',
    '.json',
    '12.5.json',
    `${'9'.repeat(20)}.json`,
  ])('ignores %s', name => {
    expect(lockFilePid(name)).toBeNull();
  });
});

describe('parseLock', () => {
  it('round-trips a record through serializeLock', () => {
    expect(parseLock(serializeLock(record))).toEqual(record);
  });

  it('round-trips a hub-false lock with no pipe and no folders', () => {
    const disabled: LockRecord = {
      ...record,
      pipe: '',
      workspaceFolders: [],
      documents: [],
      hub: false,
    };
    expect(parseLock(serializeLock(disabled))).toEqual(disabled);
  });

  it('drops fields it does not know, so a newer writer still parses', () => {
    const raw = JSON.stringify({ ...record, addedLater: { x: 1 } });
    expect(parseLock(raw)).toEqual(record);
  });

  it.each([
    ['not JSON', '{"pipe":'],
    ['null', 'null'],
    ['an array', '[]'],
    ['a string', '"lock"'],
    ['a number', '4242'],
  ])('refuses %s', (_, raw) => {
    expect(parseLock(raw)).toBeNull();
  });

  it.each(Object.keys(record) as Array<keyof LockRecord>)(
    'refuses a lock missing %s',
    field => {
      const { [field]: _, ...rest } = record;
      expect(parseLock(JSON.stringify(rest))).toBeNull();
    }
  );

  it.each([
    ['pipe', 42],
    ['workspaceFolders', '/home/me/ws'],
    ['workspaceFolders', [1]],
    ['documents', '/home/me/ws/model.erd.json'],
    ['documents', [null]],
    ['ide', false],
    ['version', 2],
    ['protocolVersion', '1'],
    ['protocolVersion', 1.5],
    ['token', null],
    ['hub', 'true'],
    ['hub', 1],
  ])('refuses %s of the wrong type (%j)', (field, value) => {
    expect(parseLock(JSON.stringify({ ...record, [field]: value }))).toBeNull();
  });
});

describe('serializeLock', () => {
  it('writes the fields in a fixed order, indented, with a final newline', () => {
    const shuffled = Object.fromEntries(
      Object.entries(record).reverse()
    ) as LockRecord;
    const text = serializeLock(shuffled);

    expect(text).toBe(serializeLock(record));
    expect(text.endsWith('}\n')).toBe(true);
    expect(Object.keys(JSON.parse(text))).toEqual([
      'pipe',
      'workspaceFolders',
      'documents',
      'ide',
      'version',
      'protocolVersion',
      'token',
      'hub',
    ]);
    expect(text).toContain('\n  "pipe": ');
  });

  it('writes only the LockRecord fields', () => {
    const extended = { ...record, secret: 'leak' } as LockRecord;
    expect(serializeLock(extended)).not.toContain('secret');
  });
});
