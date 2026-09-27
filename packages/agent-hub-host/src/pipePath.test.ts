import {
  lockFilePath,
  MAX_PIPE_PATH_BYTES,
  pipePath,
} from '@dineug/erd-editor-agent-hub';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createMemoryHub,
  flush,
  startMemoryHub,
} from '@/__test-utils__/hubLayers';

const PID = 4242;

/** A home whose socket path, home + 22 + pid digits, is exactly bytes long. */
function homeForSocketBytes(bytes: number) {
  return `/${'h'.repeat(bytes - `/.erd-editor/ide/${PID}.sock`.length - 1)}`;
}

const LONG_HOME = homeForSocketBytes(MAX_PIPE_PATH_BYTES + 1);

// The tables of choosePipePath, tmpPipePath and socketFilePaths are vectors of
// __fixtures__/conformance.json; this spec runs the whole hub where they matter.
describe('the hub under a home too long for a socket path', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listens under tmpdir, names that pipe in the lock, and keeps the lock in the home', async () => {
    const io = createMemoryHub({ homedir: LONG_HOME, tmpdir: '/tmp' });
    io.addDir('/tmp');
    startMemoryHub(io);
    await flush();

    const fallback = `/tmp/erd-editor-ide-${PID}.sock`;
    expect(io.listen).toHaveBeenCalledWith(fallback);
    expect(io.lockPath()).toBe(lockFilePath(LONG_HOME, PID));
    expect(io.lock()).toMatchObject({ hub: true, pipe: fallback });
    expect(io.files.has(pipePath(LONG_HOME, PID, 'linux'))).toBe(false);
  });

  it('deletes the fallback socket with the lock on dispose', async () => {
    const io = createMemoryHub({ homedir: LONG_HOME, tmpdir: '/tmp' });
    io.addDir('/tmp');
    const hub = startMemoryHub(io);
    await flush();

    await hub.close();

    expect(io.files.has(`/tmp/erd-editor-ide-${PID}.sock`)).toBe(false);
    expect(io.lock()).toBeUndefined();
  });

  it('serves the named pipe on win32 whatever the home, and deletes no socket file for it', async () => {
    const io = createMemoryHub({ homedir: LONG_HOME, platform: 'win32' });
    const hub = startMemoryHub(io);
    await flush();
    const namedPipe = `\\\\.\\pipe\\erd-editor-ide-${PID}`;

    expect(io.lock()).toMatchObject({ hub: true, pipe: namedPipe });

    await hub.close();

    expect(io.fs.remove).not.toHaveBeenCalledWith(namedPipe);
    expect(io.servers.size).toBe(0);
  });

  it('never listens and writes only a hub false lock when no socket path fits at all', async () => {
    const io = createMemoryHub({
      homedir: LONG_HOME,
      tmpdir: `/${'t'.repeat(100)}`,
    });
    startMemoryHub(io);
    await flush();

    expect(io.listen).not.toHaveBeenCalled();
    expect(io.lockPath()).toBe(lockFilePath(LONG_HOME, PID));
    expect(io.lock()).toMatchObject({ hub: false, pipe: '', token: '' });
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      expect.stringContaining('leaves room for a socket path')
    );
  });
});
