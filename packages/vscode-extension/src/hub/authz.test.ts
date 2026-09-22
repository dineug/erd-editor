import { HubErrorCode, HubRequestError } from '@dineug/erd-editor-agent-hub';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { startDocumentHub } from '@/hub';
import { authorizePath, realpathOrSelf, resolveRealPath } from '@/hub/authz';

import {
  connectToLock,
  createHubHandler,
  createMemoryHubIo,
  flush,
  type MemoryHubIo,
  type MockHubHandler,
} from '../../test/mocks/hubIo';
import {
  createExtensionContext,
  resetVscodeMock,
  Uri,
  workspace,
} from '../../test/mocks/vscode';

const LOCK = '/home/user/.erd-editor/ide/4242.json';

function enoent() {
  return Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
}

beforeEach(() => {
  resetVscodeMock();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveRealPath', () => {
  it('resolves a symlink anywhere in an existing path', async () => {
    const io = createMemoryHubIo();
    io.addFile('/real/ws/a.erd.json');
    io.links.set('/ws', '/real/ws');

    expect(await resolveRealPath(io, '/ws/a.erd.json', 'linux')).toBe(
      '/real/ws/a.erd.json'
    );
  });

  it('resolves the longest existing prefix of a document about to be created', async () => {
    const io = createMemoryHubIo();
    io.addDir('/real/ws');
    io.links.set('/ws', '/real/ws');

    expect(await resolveRealPath(io, '/ws/new/b.erd.json', 'linux')).toBe(
      '/real/ws/new/b.erd.json'
    );
  });

  it('hands back a relative path untouched, for paths.ts to reject', async () => {
    const io = createMemoryHubIo();

    expect(await resolveRealPath(io, 'ws/a.erd.json', 'linux')).toBe(
      'ws/a.erd.json'
    );
    expect(io.realpath).not.toHaveBeenCalled();
  });

  it('gives null when not even the root resolves', async () => {
    const io = createMemoryHubIo();
    io.realpath.mockRejectedValue(enoent());

    expect(await resolveRealPath(io, '/ws/a.erd.json', 'linux')).toBeNull();
    expect(io.realpath).toHaveBeenLastCalledWith('/');
  });

  it('gives null for a dangling symlink, which a write would follow to its target', async () => {
    const io = createMemoryHubIo();
    io.addDir('/ws');
    io.links.set('/ws/schema.erd.json', '/outside/planted.erd.json');

    expect(
      await resolveRealPath(io, '/ws/schema.erd.json', 'linux')
    ).toBeNull();
    expect(
      await resolveRealPath(io, '/ws/schema.erd.json/x.erd.json', 'linux')
    ).toBeNull();
  });

  it('gives null for a missing directory followed by .., which join would fold onto an unresolved link', async () => {
    const io = createMemoryHubIo();
    io.addDir('/ws');
    io.addDir('/outside');
    io.links.set('/ws/link', '/outside');

    expect(
      await resolveRealPath(io, '/ws/missing/../link/x.erd.json', 'linux')
    ).toBeNull();
  });

  it('lets the file system resolve .. behind a directory that exists', async () => {
    const io = createMemoryHubIo();
    io.addDir('/ws/sub');
    io.realpath.mockImplementation(async path => {
      if (path === '/ws/sub/..') return '/ws';
      throw enoent();
    });

    expect(await resolveRealPath(io, '/ws/sub/../new.erd.json', 'linux')).toBe(
      '/ws/new.erd.json'
    );
  });

  it('gives null, without climbing, when realpath fails for any reason but a missing entry', async () => {
    const io = createMemoryHubIo();
    io.addFile('/ws/loop.erd.json');
    io.realpath.mockRejectedValueOnce(
      Object.assign(new Error('ELOOP'), { code: 'ELOOP' })
    );

    expect(await resolveRealPath(io, '/ws/loop.erd.json', 'linux')).toBeNull();
    expect(io.realpath).toHaveBeenCalledTimes(1);
    expect(io.lstat).not.toHaveBeenCalled();
  });

  it('walks win32 paths with win32 separators', async () => {
    const io = createMemoryHubIo();
    io.realpath.mockImplementation(async path => {
      if (path === 'C:\\ws') return 'C:\\Real\\ws';
      throw enoent();
    });

    expect(await resolveRealPath(io, 'C:\\ws\\new.erd.json', 'win32')).toBe(
      'C:\\Real\\ws\\new.erd.json'
    );
  });
});

describe('realpathOrSelf', () => {
  it('falls back to the path it was given', async () => {
    const io = createMemoryHubIo();
    io.addDir('/ws');

    expect(await realpathOrSelf(io, '/ws')).toBe('/ws');
    expect(await realpathOrSelf(io, '/gone')).toBe('/gone');
  });
});

describe('authorizePath', () => {
  const scope = { folders: ['/a/b'], documents: ['/loose/c.erd.json'] };

  it('returns the real path inside a folder, or of an open document', async () => {
    const io = createMemoryHubIo();
    io.addFile('/a/b/x.erd.json');
    io.addFile('/loose/c.erd.json');

    await expect(
      authorizePath(io, 'linux', scope, '/a/b/x.erd.json')
    ).resolves.toBe('/a/b/x.erd.json');
    await expect(
      authorizePath(io, 'linux', scope, '/loose/c.erd.json')
    ).resolves.toBe('/loose/c.erd.json');
  });

  it.each([
    ['a sibling folder sharing a prefix', '/a/bc/x.erd.json'],
    ['a document next to an open one', '/loose/d.erd.json'],
    ['a relative path', 'a/b/x.erd.json'],
    ['a path climbing out with ..', '/a/b/../../etc/passwd'],
  ])('refuses %s with outsideWorkspace', async (_label, target) => {
    const io = createMemoryHubIo();

    await expect(
      authorizePath(io, 'linux', scope, target)
    ).rejects.toMatchObject({ code: HubErrorCode.outsideWorkspace });
  });

  it('refuses a symlink inside the folder that leads out of it', async () => {
    const io = createMemoryHubIo();
    io.addFile('/etc/passwd');
    io.links.set('/a/b/escape', '/etc');

    await expect(
      authorizePath(io, 'linux', scope, '/a/b/escape/passwd')
    ).rejects.toBeInstanceOf(HubRequestError);
  });

  it('refuses a dangling symlink inside the folder with outsideWorkspace', async () => {
    const io = createMemoryHubIo();
    io.addDir('/a/b');
    io.links.set('/a/b/x.erd.json', '/etc/planted.erd.json');

    await expect(
      authorizePath(io, 'linux', scope, '/a/b/x.erd.json')
    ).rejects.toMatchObject({
      code: HubErrorCode.outsideWorkspace,
      message:
        '/a/b/x.erd.json has no real path the hub can check, such as a dangling link',
    });
  });
});

function startHub(io: MemoryHubIo, handler: MockHubHandler) {
  return startDocumentHub(createExtensionContext() as any, handler, io);
}

/** Sends one request after hello and hands back its response. */
async function ask(io: MemoryHubIo, frame: Record<string, unknown>) {
  const client = connectToLock(io);
  client.send(frame);
  await flush();
  return client.received[1];
}

describe('path authorization at the hub entry', () => {
  const OUTSIDE = '/etc/elsewhere.erd.json';

  it.each([
    ['openDocument', { path: OUTSIDE, create: true, initialValue: '{}' }],
    ['join', { path: OUTSIDE }],
    ['applyActions', { path: OUTSIDE, actions: [] }],
    ['leave', { path: OUTSIDE }],
    ['save', { path: OUTSIDE }],
  ])(
    'refuses %s outside the workspace, calls no handler and creates no file',
    async (method, params) => {
      workspace.workspaceFolders = [{ uri: Uri.file('/ws') }];
      const io = createMemoryHubIo();
      io.addDir('/ws');
      const handler = createHubHandler();
      startHub(io, handler);
      await flush();
      io.writeFile.mockClear();

      const response = await ask(io, { id: 2, method, params });

      expect(response).toMatchObject({
        id: 2,
        ok: false,
        method,
        error: { code: HubErrorCode.outsideWorkspace },
      });
      expect(handler[method as 'join']).not.toHaveBeenCalled();
      expect(io.writeFile).not.toHaveBeenCalled();
      expect(io.files.has(OUTSIDE)).toBe(false);
    }
  );

  it('lets a path inside a workspace folder through under its real path', async () => {
    workspace.workspaceFolders = [{ uri: Uri.file('/link') }];
    const io = createMemoryHubIo();
    io.addFile('/real/a.erd.json');
    io.links.set('/link', '/real');
    const handler = createHubHandler();
    startHub(io, handler);
    await flush();

    const response = await ask(io, {
      id: 2,
      method: 'join',
      params: { path: '/link/a.erd.json' },
    });

    expect(response).toMatchObject({ id: 2, ok: true });
    expect(handler.join).toHaveBeenCalledWith(
      { path: '/real/a.erd.json' },
      expect.anything()
    );
  });

  it.each([
    ['darwin', { ok: true }],
    ['linux', { ok: false, error: { code: HubErrorCode.outsideWorkspace } }],
  ])(
    'compares paths by the platform this window runs on: %s',
    async (platform, expected) => {
      workspace.workspaceFolders = [{ uri: Uri.file('/WS') }];
      const io = createMemoryHubIo({ platform });
      io.addDir('/WS');
      startHub(io, createHubHandler());
      await flush();

      const response = await ask(io, {
        id: 2,
        method: 'join',
        params: { path: '/ws/a.erd.json' },
      });

      expect(response).toMatchObject(expected);
    }
  );

  it('refuses a dangling symlink in the workspace and creates nothing at its target', async () => {
    workspace.workspaceFolders = [{ uri: Uri.file('/ws') }];
    const io = createMemoryHubIo();
    io.addDir('/ws');
    io.links.set('/ws/schema.erd.json', '/outside/planted.erd.json');
    const handler = createHubHandler();
    startHub(io, handler);
    await flush();

    const response = await ask(io, {
      id: 2,
      method: 'openDocument',
      params: { path: '/ws/schema.erd.json', create: true, initialValue: '{}' },
    });

    expect(response).toMatchObject({
      ok: false,
      error: { code: HubErrorCode.outsideWorkspace },
    });
    expect(handler.openDocument).not.toHaveBeenCalled();
    expect(io.files.has('/outside/planted.erd.json')).toBe(false);
  });

  describe('in a window without folders', () => {
    it.each([
      ['undefined', undefined],
      ['empty', []],
    ])(
      'with workspaceFolders %s, admits the open document and nothing else',
      async (_label, folders) => {
        workspace.workspaceFolders = folders;
        const io = createMemoryHubIo();
        io.addFile('/notes/open.erd.json');
        io.addFile('/notes/closed.erd.json');
        const handler = createHubHandler();
        const hub = startHub(io, handler);
        await hub.setDocuments(['/notes/open.erd.json']);

        const joined = await ask(io, {
          id: 2,
          method: 'join',
          params: { path: '/notes/open.erd.json' },
        });
        const unopened = await ask(io, {
          id: 3,
          method: 'join',
          params: { path: '/notes/closed.erd.json' },
        });
        const created = await ask(io, {
          id: 4,
          method: 'openDocument',
          params: { path: '/notes/new.erd.json', create: true },
        });

        expect(joined).toMatchObject({ ok: true });
        expect(unopened).toMatchObject({
          ok: false,
          error: { code: HubErrorCode.outsideWorkspace },
        });
        expect(created).toMatchObject({
          ok: false,
          error: { code: HubErrorCode.outsideWorkspace },
        });
        expect(handler.openDocument).not.toHaveBeenCalled();
      }
    );

    it('stops admitting a document once it is closed', async () => {
      const io = createMemoryHubIo();
      io.addFile('/notes/open.erd.json');
      const hub = startHub(io, createHubHandler());
      await hub.setDocuments(['/notes/open.erd.json']);
      await hub.setDocuments([]);

      const response = await ask(io, {
        id: 2,
        method: 'save',
        params: { path: '/notes/open.erd.json' },
      });

      expect(response).toMatchObject({
        ok: false,
        error: { code: HubErrorCode.outsideWorkspace },
      });
      expect(io.readJson(LOCK).documents).toEqual([]);
    });
  });
});
