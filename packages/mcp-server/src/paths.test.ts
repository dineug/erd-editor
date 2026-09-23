import { describe, expect, it } from 'vite-plus/test';

import { createMemoryIo, fsError } from '@/__test-utils__/memoryIo';
import { errnoCode, isSessionError, messageOf, SessionError } from '@/errors';
import {
  DEFAULT_EXTENSION,
  isErdPath,
  pathsOf,
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

  it('picks the path module of the platform', () => {
    expect(pathsOf('win32').sep).toBe('\\');
    expect(pathsOf('linux').sep).toBe('/');
  });

  it('resolves relative paths against the working directory', async () => {
    const io = createMemoryIo({ cwd: '/work' });
    io.put('/work/sub/a.erd.json', '{}');

    expect(await resolveDocumentPath(io, 'sub/a.erd.json')).toBe(
      '/work/sub/a.erd.json'
    );
    expect(await resolveDocumentPath(io, '../work/sub/./a.erd.json')).toBe(
      '/work/sub/a.erd.json'
    );
  });

  it('hands back the real path of a document named through a symlink', async () => {
    const io = createMemoryIo();
    io.realpath = async path => path.replace(/^\/link(?=\/|$)/, '/work');

    expect(await resolveDocumentPath(io, '/link/a.erd.json')).toBe(
      '/work/a.erd.json'
    );
    expect(await resolveDocumentPath(io, '/link/new', true)).toBe(
      '/work/new.erd.json'
    );
  });

  it('resolves a missing file through its existing folders', async () => {
    const io = createMemoryIo();
    io.realpath = async path => {
      if (path === '/work') return '/real/work';
      throw fsError('ENOENT', path);
    };

    expect(await realPath(io, '/work/new/x.erd.json')).toBe(
      '/real/work/new/x.erd.json'
    );
  });

  it('stops climbing on a failure other than a missing entry, or at the root', async () => {
    const io = createMemoryIo();
    io.realpath = async path => {
      throw fsError(path === '/locked/x.erd' ? 'EACCES' : 'ENOENT', path);
    };

    expect(await realPath(io, '/locked/x.erd')).toBe('/locked/x.erd');
    expect(await realPath(io, '/')).toBe('/');
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

  it('reads an errno code and a message from anything thrown', () => {
    expect(errnoCode(fsError('ENOENT', '/x'))).toBe('ENOENT');
    expect(errnoCode({ code: 5 })).toBeUndefined();
    expect(errnoCode(null)).toBeUndefined();
    expect(messageOf(new Error('boom'))).toBe('boom');
    expect(messageOf('plain')).toBe('plain');
  });
});
