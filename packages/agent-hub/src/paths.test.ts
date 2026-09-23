import { Effect } from 'effect';
import { describe, expect, it } from 'vite-plus/test';

import { runTest } from '@/__test-utils__/effect';
import {
  authorize,
  isAuthorized,
  isInside,
  isSamePath,
  longestPrefixIndex,
  toSegments,
} from '@/paths';
import { HubErrorCode, HubRequestError } from '@/protocol';

describe('toSegments', () => {
  it.each([
    ['/a/b', 'linux', ['/', 'a', 'b']],
    ['/a/b/', 'linux', ['/', 'a', 'b']],
    ['/a//b/./c', 'linux', ['/', 'a', 'b', 'c']],
    ['/', 'linux', ['/']],
    ['a/b', 'linux', ['a', 'b']],
    ['', 'linux', []],
    ['C:\\a\\b', 'win32', ['c:', 'a', 'b']],
    ['c:/a/b', 'win32', ['c:', 'a', 'b']],
    ['\\\\server\\share\\x', 'win32', ['//', 'server', 'share', 'x']],
    ['\\a\\b', 'win32', ['/', 'a', 'b']],
  ])('splits %s on %s', (path, platform, expected) => {
    expect(toSegments(path, platform)).toEqual(expected);
  });

  it('keeps a backslash as part of a name outside win32', () => {
    expect(toSegments('/a/b\\c', 'darwin')).toEqual(['/', 'a', 'b\\c']);
    expect(toSegments('C:\\a', 'linux')).toEqual(['C:\\a']);
  });

  it('keeps .. so the comparisons can refuse it', () => {
    expect(toSegments('/a/../b', 'linux')).toEqual(['/', 'a', '..', 'b']);
  });
});

describe('isInside', () => {
  it.each([
    ['/a/b', '/a/b/c.erd.json', 'linux', true],
    ['/a/b', '/a/b', 'linux', true],
    ['/a/b/', '/a/b/c', 'linux', true],
    ['/', '/a', 'linux', true],
    ['/a/b', '/a/bc', 'linux', false],
    ['/a/b', '/a/bc/d', 'linux', false],
    ['/a/b', '/a', 'linux', false],
    ['/a/b', '/A/B/c', 'linux', false],
    ['/a/b', '/A/B/c', 'darwin', true],
    ['C:\\Work', 'c:\\work\\x.erd', 'win32', true],
    ['C:\\Work', 'D:\\Work\\x.erd', 'win32', false],
    ['\\\\srv\\share', '\\\\srv\\share\\x.erd', 'win32', true],
    ['\\\\srv\\share', 'C:\\srv\\share\\x.erd', 'win32', false],
    ['/srv/share', '\\\\srv\\share\\x.erd', 'win32', false],
  ])('%s contains %s on %s: %s', (parent, child, platform, expected) => {
    expect(isInside(parent, child, platform)).toBe(expected);
  });

  it.each([
    ['/a/b', '/a/b/../c'],
    ['/a/b', '/a/b/..'],
    ['/a/../a/b', '/a/b/c'],
  ])('refuses a path with .. (%s, %s)', (parent, child) => {
    expect(isInside(parent, child, 'linux')).toBe(false);
  });

  it('refuses a relative or empty path on either side', () => {
    expect(isInside('/a', 'a/b', 'linux')).toBe(false);
    expect(isInside('a', 'a/b', 'linux')).toBe(false);
    expect(isInside('/', '', 'linux')).toBe(false);
    expect(isInside('C:\\a', 'C:\\a\\b', 'linux')).toBe(false);
  });

  it('never treats a POSIX backslash name as a separator', () => {
    expect(isInside('/ws', '/ws\\evil.erd', 'linux')).toBe(false);
    expect(isInside('/ws', '/ws\\evil.erd', 'darwin')).toBe(false);
  });
});

describe('isSamePath', () => {
  it.each([
    ['/a/b.erd', '/a/b.erd', 'linux', true],
    ['/a/b.erd', '/a//b.erd', 'linux', true],
    ['/a/b.erd', '/a/B.erd', 'linux', false],
    ['/a/b.erd', '/a/B.erd', 'darwin', true],
    ['C:\\a\\b.erd', 'c:/A/B.ERD', 'win32', true],
    ['/a/b.erd', '/a/b.erd/c', 'linux', false],
    ['/a/b.erd/c', '/a/b.erd', 'linux', false],
    ['/a/x/../b.erd', '/a/b.erd', 'linux', false],
    ['a/b.erd', 'a/b.erd', 'linux', false],
    ['', '', 'linux', false],
  ])('%s equals %s on %s: %s', (a, b, platform, expected) => {
    expect(isSamePath(a, b, platform)).toBe(expected);
  });
});

describe('longestPrefixIndex', () => {
  it('picks the deepest folder that contains the target', () => {
    const folders = ['/ws', '/ws/app/packages', '/ws/app', '/other'];

    expect(longestPrefixIndex(folders, '/ws/app/packages/x.erd', 'linux')).toBe(
      1
    );
    expect(longestPrefixIndex(folders, '/ws/app/y.erd', 'linux')).toBe(2);
    expect(longestPrefixIndex(folders, '/ws/z.erd', 'linux')).toBe(0);
  });

  it('keeps the first of two equally deep folders', () => {
    expect(
      longestPrefixIndex(['/Ws/a', '/ws/A'], '/ws/a/x.erd', 'darwin')
    ).toBe(0);
  });

  it('returns -1 when nothing contains the target', () => {
    expect(longestPrefixIndex(['/ws'], '/other/x.erd', 'linux')).toBe(-1);
    expect(longestPrefixIndex([], '/ws/x.erd', 'linux')).toBe(-1);
    expect(longestPrefixIndex(['/a/b'], '/a/bc/x.erd', 'linux')).toBe(-1);
  });
});

describe('isAuthorized', () => {
  const folders = ['/ws/app'];
  const documents = ['/elsewhere/open.erd.json'];

  it.each([
    ['/ws/app/model.erd.json', true, 'inside a folder'],
    ['/ws/app/nested/deep/model.erd', true, 'deep inside a folder'],
    ['/elsewhere/open.erd.json', true, 'an open document outside the folders'],
    ['/elsewhere/other.erd.json', false, 'a sibling of an open document'],
    ['/elsewhere', false, 'the directory of an open document'],
    ['/ws/apple/model.erd', false, 'a name sharing the folder prefix'],
    ['/ws/app/../secret.erd', false, 'a folder escape with ..'],
    ['app/model.erd', false, 'a relative path'],
  ])('%s -> %s (%s)', (target, expected) => {
    expect(isAuthorized(folders, documents, target, 'linux')).toBe(expected);
  });

  describe('a window with no workspace folder', () => {
    const open = ['/tmp/scratch/model.erd.json'];

    it('admits exactly the documents it has open', () => {
      expect(
        isAuthorized([], open, '/tmp/scratch/model.erd.json', 'linux')
      ).toBe(true);
    });

    it('refuses an unopened path, even beside an open one', () => {
      expect(isAuthorized([], open, '/tmp/scratch/new.erd.json', 'linux')).toBe(
        false
      );
      expect(isAuthorized([], [], '/tmp/scratch/model.erd.json', 'linux')).toBe(
        false
      );
    });
  });

  it('matches open documents case-insensitively on win32 and darwin only', () => {
    const open = ['C:\\Docs\\Model.erd.json'];

    expect(isAuthorized([], open, 'c:/docs/model.ERD.json', 'win32')).toBe(
      true
    );
    expect(
      isAuthorized([], ['/Docs/Model.erd'], '/docs/model.erd', 'darwin')
    ).toBe(true);
    expect(
      isAuthorized([], ['/Docs/Model.erd'], '/docs/model.erd', 'linux')
    ).toBe(false);
  });

  it('compares the strings it is given: resolving symlinks is the caller part', () => {
    // A link /ws/app/link -> /private/data looks inside until the caller
    // resolves both sides with realpath, which is the contract of this module.
    expect(isAuthorized(folders, [], '/ws/app/link/model.erd', 'linux')).toBe(
      true
    );
    expect(isAuthorized(folders, [], '/private/data/model.erd', 'linux')).toBe(
      false
    );
  });
});

describe('authorize', () => {
  it('succeeds quietly for an authorized path', async () => {
    await expect(
      runTest(authorize(['/ws'], [], '/ws/model.erd', 'linux'))
    ).resolves.toBeUndefined();
    await expect(
      runTest(authorize([], ['/open.erd'], '/open.erd', 'linux'))
    ).resolves.toBeUndefined();
  });

  it('fails with outsideWorkspace for any other path', async () => {
    const caught = await runTest(
      Effect.flip(authorize(['/ws'], ['/open.erd'], '/etc/model.erd', 'linux'))
    );

    expect(caught).toBeInstanceOf(HubRequestError);
    expect(caught.code).toBe(HubErrorCode.outsideWorkspace);
    expect(caught.message).toContain('/etc/model.erd');
    expect(caught.message).toBe(
      '/etc/model.erd is neither inside a workspace folder nor an open document'
    );
  });

  it('applies the isAuthorized rule, platform included', async () => {
    const outcome = (target: string, platform: string) =>
      runTest(
        authorize(['/ws/app'], ['/Docs/Model.erd'], target, platform).pipe(
          Effect.as('authorized'),
          Effect.catchTag('HubRequestError', error =>
            Effect.succeed(error.code)
          )
        )
      );

    expect(await outcome('/ws/app/x.erd', 'linux')).toBe('authorized');
    expect(await outcome('/ws/apple/x.erd', 'linux')).toBe('outsideWorkspace');
    expect(await outcome('/ws/app/../x.erd', 'linux')).toBe('outsideWorkspace');
    expect(await outcome('/docs/model.erd', 'darwin')).toBe('authorized');
    expect(await outcome('/docs/model.erd', 'linux')).toBe('outsideWorkspace');
  });

  it('checks the folders and documents as they are when it runs', async () => {
    const folders: string[] = [];
    const check = authorize(folders, [], '/ws/model.erd', 'linux');

    await expect(runTest(Effect.flip(check))).resolves.toBeInstanceOf(
      HubRequestError
    );
    folders.push('/ws');
    await expect(runTest(check)).resolves.toBeUndefined();
  });
});
