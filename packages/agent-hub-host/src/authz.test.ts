import {
  HubErrorCode,
  HubRequestError,
  type Platform,
} from '@dineug/erd-editor-agent-hub';
import { Effect } from 'effect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  connectToLock,
  createHubHandler,
  createMemoryHost,
  createMemoryHub,
  flush,
  fsError,
  type MemoryHub,
  type MockHubHandler,
  runMemory,
  startMemoryHub,
} from '@/__test-utils__/hubLayers';
import { authorizePath, realpathOrSelf, resolveRealPath } from '@/authz';

const LOCK = '/home/user/.erd-editor/ide/4242.json';

const missing = (path: string) => fsError('NotFound', 'realPath', path);

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveRealPath', () => {
  const resolve = (io: MemoryHub, path: string, platform: Platform = 'linux') =>
    runMemory(io, resolveRealPath(path, platform));

  it('resolves a symlink anywhere in an existing path', async () => {
    const io = createMemoryHub();
    io.addFile('/real/ws/a.erd.json');
    io.links.set('/ws', '/real/ws');

    expect(await resolve(io, '/ws/a.erd.json')).toBe('/real/ws/a.erd.json');
  });

  it('resolves the longest existing prefix of a document about to be created', async () => {
    const io = createMemoryHub();
    io.addDir('/real/ws');
    io.links.set('/ws', '/real/ws');

    expect(await resolve(io, '/ws/new/b.erd.json')).toBe(
      '/real/ws/new/b.erd.json'
    );
  });

  it('hands back a relative path untouched, for paths.ts to reject', async () => {
    const io = createMemoryHub();

    expect(await resolve(io, 'ws/a.erd.json')).toBe('ws/a.erd.json');
    expect(io.fs.realPath).not.toHaveBeenCalled();
  });

  it('gives null when not even the root resolves', async () => {
    const io = createMemoryHub();
    io.fs.realPath.mockImplementation((path: string) =>
      Effect.fail(missing(path))
    );

    expect(await resolve(io, '/ws/a.erd.json')).toBeNull();
    expect(io.fs.realPath).toHaveBeenLastCalledWith('/');
  });

  it('gives null for a dangling symlink, which a write would follow to its target', async () => {
    const io = createMemoryHub();
    io.addDir('/ws');
    io.links.set('/ws/schema.erd.json', '/outside/planted.erd.json');

    expect(await resolve(io, '/ws/schema.erd.json')).toBeNull();
    expect(await resolve(io, '/ws/schema.erd.json/x.erd.json')).toBeNull();
  });

  it('gives null for a missing directory followed by .., which join would fold onto an unresolved link', async () => {
    const io = createMemoryHub();
    io.addDir('/ws');
    io.addDir('/outside');
    io.links.set('/ws/link', '/outside');

    expect(await resolve(io, '/ws/missing/../link/x.erd.json')).toBeNull();
  });

  it('lets the file system resolve .. behind a directory that exists', async () => {
    const io = createMemoryHub();
    io.addDir('/ws/sub');
    io.fs.realPath.mockImplementation((path: string) =>
      path === '/ws/sub/..' ? Effect.succeed('/ws') : Effect.fail(missing(path))
    );

    expect(await resolve(io, '/ws/sub/../new.erd.json')).toBe(
      '/ws/new.erd.json'
    );
  });

  it('gives null, without climbing, when realpath fails for any reason but a missing entry', async () => {
    const io = createMemoryHub();
    io.addFile('/ws/loop.erd.json');
    io.fs.realPath.mockImplementationOnce((path: string) =>
      Effect.fail(fsError('Busy', 'realPath', path))
    );

    expect(await resolve(io, '/ws/loop.erd.json')).toBeNull();
    expect(io.fs.realPath).toHaveBeenCalledTimes(1);
    expect(io.env.lstat).not.toHaveBeenCalled();
  });

  it('walks win32 paths with win32 separators', async () => {
    const io = createMemoryHub();
    io.fs.realPath.mockImplementation((path: string) =>
      path === 'C:\\ws'
        ? Effect.succeed('C:\\Real\\ws')
        : Effect.fail(missing(path))
    );

    expect(await resolve(io, 'C:\\ws\\new.erd.json', 'win32')).toBe(
      'C:\\Real\\ws\\new.erd.json'
    );
  });
});

describe('realpathOrSelf', () => {
  it('falls back to the path it was given', async () => {
    const io = createMemoryHub();
    io.addDir('/ws');

    expect(await runMemory(io, realpathOrSelf('/ws'))).toBe('/ws');
    expect(await runMemory(io, realpathOrSelf('/gone'))).toBe('/gone');
  });
});

describe('authorizePath', () => {
  const scope = { folders: ['/a/b'], documents: ['/loose/c.erd.json'] };
  const authorize = (io: MemoryHub, target: string) =>
    runMemory(io, authorizePath('linux', scope, target));

  it('returns the real path inside a folder, or of an open document', async () => {
    const io = createMemoryHub();
    io.addFile('/a/b/x.erd.json');
    io.addFile('/loose/c.erd.json');

    await expect(authorize(io, '/a/b/x.erd.json')).resolves.toBe(
      '/a/b/x.erd.json'
    );
    await expect(authorize(io, '/loose/c.erd.json')).resolves.toBe(
      '/loose/c.erd.json'
    );
  });

  it.each([
    ['a sibling folder sharing a prefix', '/a/bc/x.erd.json'],
    ['a document next to an open one', '/loose/d.erd.json'],
    ['a relative path', 'a/b/x.erd.json'],
    ['a path climbing out with ..', '/a/b/../../etc/passwd'],
  ])('refuses %s with outsideWorkspace', async (_label, target) => {
    const io = createMemoryHub();

    await expect(authorize(io, target)).rejects.toMatchObject({
      code: HubErrorCode.outsideWorkspace,
    });
  });

  it('refuses a symlink inside the folder that leads out of it', async () => {
    const io = createMemoryHub();
    io.addFile('/etc/passwd');
    io.links.set('/a/b/escape', '/etc');

    await expect(authorize(io, '/a/b/escape/passwd')).rejects.toBeInstanceOf(
      HubRequestError
    );
  });

  it('refuses a dangling symlink inside the folder with outsideWorkspace', async () => {
    const io = createMemoryHub();
    io.addDir('/a/b');
    io.links.set('/a/b/x.erd.json', '/etc/planted.erd.json');

    await expect(authorize(io, '/a/b/x.erd.json')).rejects.toMatchObject({
      code: HubErrorCode.outsideWorkspace,
      message:
        '/a/b/x.erd.json has no real path the hub can check, such as a dangling link',
    });
  });
});

/** Starts the hub in a host with these root folders. */
function startHub(
  io: MemoryHub,
  handler: MockHubHandler,
  folders: string[] = []
) {
  return startMemoryHub(io, { handler, host: createMemoryHost({ folders }) });
}

/** Sends one request after hello and hands back its response. */
async function ask(io: MemoryHub, frame: Record<string, unknown>) {
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
      const io = createMemoryHub();
      io.addDir('/ws');
      const handler = createHubHandler();
      startHub(io, handler, ['/ws']);
      await flush();
      io.fs.writeFileString.mockClear();

      const response = await ask(io, { id: 2, method, params });

      expect(response).toMatchObject({
        id: 2,
        ok: false,
        method,
        error: { code: HubErrorCode.outsideWorkspace },
      });
      expect(handler[method as 'join']).not.toHaveBeenCalled();
      expect(io.fs.writeFileString).not.toHaveBeenCalled();
      expect(io.files.has(OUTSIDE)).toBe(false);
    }
  );

  it('lets a path inside a workspace folder through under its real path', async () => {
    const io = createMemoryHub();
    io.addFile('/real/a.erd.json');
    io.links.set('/link', '/real');
    const handler = createHubHandler();
    startHub(io, handler, ['/link']);
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
      const io = createMemoryHub({ platform });
      io.addDir('/WS');
      startHub(io, createHubHandler(), ['/WS']);
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
    const io = createMemoryHub();
    io.addDir('/ws');
    io.links.set('/ws/schema.erd.json', '/outside/planted.erd.json');
    const handler = createHubHandler();
    startHub(io, handler, ['/ws']);
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
    it('admits the open document and nothing else', async () => {
      const io = createMemoryHub();
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
    });

    it('stops admitting a document once it is closed', async () => {
      const io = createMemoryHub();
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
