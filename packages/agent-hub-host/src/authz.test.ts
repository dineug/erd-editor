import { HubErrorCode, type Platform } from '@dineug/erd-editor-agent-hub';
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

// The resolve and authorize tables are vectors of __fixtures__/conformance.json,
// each over a machine of its own; what stays here watches the file system calls.
describe('resolveRealPath', () => {
  const resolve = (io: MemoryHub, path: string, platform: Platform = 'linux') =>
    runMemory(io, resolveRealPath(path, platform));

  it('asks the file system nothing about a relative path', async () => {
    const io = createMemoryHub();

    await resolve(io, 'ws/a.erd.json');
    expect(io.fs.realPath).not.toHaveBeenCalled();
  });

  it('climbs no further than the root', async () => {
    const io = createMemoryHub();
    io.fs.realPath.mockImplementation((path: string) =>
      Effect.fail(missing(path))
    );

    await resolve(io, '/ws/a.erd.json');
    expect(io.fs.realPath).toHaveBeenLastCalledWith('/');
  });

  it('neither climbs nor looks at the entry when realpath fails for any reason but a missing one', async () => {
    const io = createMemoryHub();
    io.addFile('/ws/loop.erd.json');
    io.fs.realPath.mockImplementationOnce((path: string) =>
      Effect.fail(fsError('Busy', 'realPath', path))
    );

    await resolve(io, '/ws/loop.erd.json');
    expect(io.fs.realPath).toHaveBeenCalledTimes(1);
    expect(io.env.lstat).not.toHaveBeenCalled();
  });
});

describe('authorizePath', () => {
  it.each(['C:\\ws\\COM1.erd', 'C:\\ws\\a:b.erd', 'C:\\ws\\sub.\\a.erd'])(
    'refuses %s on win32 before it asks the file system anything',
    async target => {
      const io = createMemoryHub({ platform: 'win32' });

      const refusal = await runMemory(
        io,
        authorizePath(
          'win32',
          { folders: ['C:\\ws'], documents: [] },
          target
        ).pipe(Effect.flip)
      );

      expect(refusal.code).toBe(HubErrorCode.badRequest);
      expect(io.fs.realPath).not.toHaveBeenCalled();
      expect(io.env.lstat).not.toHaveBeenCalled();
    }
  );
});

describe('realpathOrSelf', () => {
  it('falls back to the path it was given', async () => {
    const io = createMemoryHub();
    io.addDir('/ws');

    expect(await runMemory(io, realpathOrSelf('/ws'))).toBe('/ws');
    expect(await runMemory(io, realpathOrSelf('/gone'))).toBe('/gone');
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
