import { Effect, PlatformError } from 'effect';
import { describe, expect, it } from 'vite-plus/test';

import { fsError } from '@/__test-utils__/memoryFs';
import { createMemoryHost } from '@/__test-utils__/memoryHost';
import {
  isPlatformReason,
  isSessionError,
  messageOf,
  SessionError,
} from '@/errors';
import {
  DEFAULT_EXTENSION,
  isErdPath,
  realPath,
  resolveDocumentPath,
  sessionKey,
} from '@/paths';

describe('document paths', () => {
  it('accepts the four extensions the editor opens, in any case', () => {
    expect(
      ['a.erd', 'a.VUERD', 'a.erd.json', 'a.vuerd.json'].every(isErdPath)
    ).toBe(true);
    expect(['a.json', 'a.sql', 'erd'].some(isErdPath)).toBe(false);
    expect(DEFAULT_EXTENSION).toBe('.erd.json');
  });

  it('folds case in the session key where the platform compares without it', () => {
    expect(sessionKey('/A/b.erd', 'darwin')).toBe('/a/b.erd');
    expect(sessionKey('C:\\A.erd', 'win32')).toBe('c:\\a.erd');
    expect(sessionKey('/A/b.erd', 'linux')).toBe('/A/b.erd');
  });

  it('resolves relative paths against the working directory', async () => {
    const io = createMemoryHost({ cwd: '/work' });
    io.put('/work/sub/a.erd.json', '{}');

    expect(await io.run(resolveDocumentPath('sub/a.erd.json'))).toBe(
      '/work/sub/a.erd.json'
    );
    expect(await io.run(resolveDocumentPath('../work/sub/./a.erd.json'))).toBe(
      '/work/sub/a.erd.json'
    );
  });

  it('hands back the real path of a document named through a symlink', async () => {
    const io = createMemoryHost();
    io.links.set('/link', '/work');
    io.put('/work/a.erd.json', '{}');

    expect(await io.run(resolveDocumentPath('/link/a.erd.json'))).toBe(
      '/work/a.erd.json'
    );
    expect(await io.run(resolveDocumentPath('/link/new', true))).toBe(
      '/work/new.erd.json'
    );
  });

  it('refuses an empty path, and a path that is no ERD document', async () => {
    const io = createMemoryHost();

    await expect(io.run(resolveDocumentPath('  '))).rejects.toMatchObject({
      code: 'invalidPath',
      message: 'path is empty',
    });
    await expect(
      io.run(resolveDocumentPath('notes.md', true))
    ).rejects.toMatchObject({ code: 'invalidPath' });
  });

  it.each([
    ['orders:v2.erd', false, '/work/orders:v2.erd', 'orders:v2.erd'],
    [
      'schema-2026-09-27T10:00.erd',
      false,
      '/work/schema-2026-09-27T10:00.erd',
      'schema-2026-09-27T10:00.erd',
    ],
    ['CON.erd', false, '/work/CON.erd', 'CON.erd'],
    ['sub./x.erd', false, '/work/sub./x.erd', 'sub.'],
    ['orders:v2', true, '/work/orders:v2.erd.json', 'orders:v2.erd.json'],
  ])(
    'refuses %s on win32, a name Windows does not store as written, and resolves it elsewhere',
    async (input, create, absolute, segment) => {
      const windows = createMemoryHost({ platform: 'win32' });
      const linux = createMemoryHost({ platform: 'linux' });

      await expect(
        windows.run(resolveDocumentPath(input, create))
      ).rejects.toMatchObject({
        code: 'invalidPath',
        message: `${absolute} holds ${JSON.stringify(segment)}, which Windows does not store as written: a colon names a stream of another file, NUL, CON, COM1 and the like are devices, and a trailing dot or space is dropped; rename it, for example with - in place of :`,
      });
      expect(await linux.run(resolveDocumentPath(input, create))).toBe(
        absolute
      );
    }
  );

  it('refuses on win32 a real path that meets such a name through a link', async () => {
    const io = createMemoryHost({ platform: 'win32' });
    io.links.set('/work/j', '/work/sub.');
    io.put('/work/sub./a.erd.json', '{}');

    await expect(
      io.run(resolveDocumentPath('j/a.erd.json'))
    ).rejects.toMatchObject({
      code: 'invalidPath',
      message: expect.stringMatching(
        /^\/work\/sub\.\/a\.erd\.json holds "sub\."/
      ),
    });
  });

  it('resolves a missing file through its existing folders', async () => {
    const io = createMemoryHost();
    io.calls.realPath = path =>
      path === '/work'
        ? Effect.succeed('/real/work')
        : Effect.fail(fsError('NotFound', 'realPath', path));

    expect(await io.run(realPath('/work/new/x.erd.json'))).toBe(
      '/real/work/new/x.erd.json'
    );
  });

  it('stops climbing on a failure other than a missing entry, or at the root', async () => {
    const io = createMemoryHost();
    // The folder resolves elsewhere, so a climb past the refusal would show.
    io.calls.realPath = path =>
      path === '/locked'
        ? Effect.succeed('/real/locked')
        : Effect.fail(
            fsError(
              path === '/locked/x.erd' ? 'PermissionDenied' : 'NotFound',
              'realPath',
              path
            )
          );

    expect(await io.run(realPath('/locked/x.erd'))).toBe('/locked/x.erd');
    expect(await io.run(realPath('/'))).toBe('/');
  });
});

describe('errors', () => {
  it('matches a session error with or without a code', () => {
    const error = new SessionError('blocked', 'no');

    expect(isSessionError(error)).toBe(true);
    expect(isSessionError(error, 'blocked')).toBe(true);
    expect(isSessionError(error, 'conflict')).toBe(false);
    expect(isSessionError(new Error('x'))).toBe(false);
  });

  it('builds the same tagged error from its fields as from the code and message', () => {
    const fields = new SessionError({ code: 'hubGone', message: 'gone' });
    const positional = new SessionError('hubGone', 'gone');

    expect(fields).toMatchObject({
      _tag: 'SessionError',
      name: 'SessionError',
      code: 'hubGone',
      message: 'gone',
    });
    expect(positional).toMatchObject({ code: 'hubGone', message: 'gone' });
    expect(fields).toBeInstanceOf(Error);
  });

  it('tells a platform failure by its reason tag', () => {
    const missing = fsError('NotFound', 'stat', '/x');

    expect(isPlatformReason(missing, 'NotFound')).toBe(true);
    expect(isPlatformReason(missing, 'AlreadyExists')).toBe(false);
    expect(isPlatformReason(new Error('ENOENT'), 'NotFound')).toBe(false);
  });

  it('reads a message from anything thrown, a file system failure in the words of its system call', () => {
    expect(messageOf(new Error('boom'))).toBe('boom');
    expect(messageOf('plain')).toBe('plain');
    expect(messageOf(fsError('Unknown', 'writeFile', '/x', 'ENOSPC'))).toBe(
      'ENOSPC: /x'
    );
    const bare = PlatformError.systemError({
      _tag: 'Busy',
      module: 'FileSystem',
      method: 'remove',
    });
    expect(messageOf(bare)).toBe(bare.message);
  });
});
