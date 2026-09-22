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

import { choosePipePath, socketFilePaths, tmpPipePath } from '@/hub/pipePath';

import {
  createMemoryHub,
  flush,
  startMemoryHub,
} from '../../test/mocks/hubLayers';
import { resetVscodeMock } from '../../test/mocks/vscode';

const PID = 4242;

/** A home whose socket path, home + 22 + pid digits, is exactly bytes long. */
function homeForSocketBytes(bytes: number) {
  return `/${'h'.repeat(bytes - `/.erd-editor/ide/${PID}.sock`.length - 1)}`;
}

const FITTING_HOME = homeForSocketBytes(MAX_PIPE_PATH_BYTES);
const LONG_HOME = homeForSocketBytes(MAX_PIPE_PATH_BYTES + 1);

describe('choosePipePath', () => {
  it('binds beside the lock file while that path fits', () => {
    expect(pipePath(FITTING_HOME, PID, 'linux')).toHaveLength(
      MAX_PIPE_PATH_BYTES
    );
    expect(choosePipePath(FITTING_HOME, '/tmp', PID, 'linux')).toBe(
      `${FITTING_HOME}/.erd-editor/ide/${PID}.sock`
    );
  });

  it('falls back to the temp directory one byte over the limit', () => {
    expect(choosePipePath(LONG_HOME, '/tmp', PID, 'darwin')).toBe(
      `/tmp/erd-editor-ide-${PID}.sock`
    );
  });

  it('counts UTF-8 bytes, not characters', () => {
    // 26 three-byte characters: the socket path is 53 characters but 105 bytes.
    const home = `/${'한'.repeat(26)}`;
    expect(new TextEncoder().encode(pipePath(home, PID, 'linux'))).toHaveLength(
      105
    );

    expect(choosePipePath(home, '/tmp', PID, 'linux')).toBe(
      `/tmp/erd-editor-ide-${PID}.sock`
    );
  });

  it('gives up when the temp directory is too long as well', () => {
    expect(
      choosePipePath(LONG_HOME, `/${'t'.repeat(100)}`, PID, 'linux')
    ).toBeNull();
  });

  it('always uses the named pipe on win32, which the socket limit does not bind', () => {
    expect(choosePipePath(LONG_HOME, 'C:\\Temp', PID, 'win32')).toBe(
      `\\\\.\\pipe\\erd-editor-ide-${PID}`
    );
  });
});

describe('tmpPipePath', () => {
  it('drops the trailing separators of the temp directory', () => {
    expect(tmpPipePath('/var/tmp//', PID)).toBe(
      `/var/tmp/erd-editor-ide-${PID}.sock`
    );
  });
});

describe('socketFilePaths', () => {
  it('lists both places a posix window can bind', () => {
    expect(socketFilePaths('/home/user', '/tmp', PID, 'linux')).toEqual([
      `/home/user/.erd-editor/ide/${PID}.sock`,
      `/tmp/erd-editor-ide-${PID}.sock`,
    ]);
  });

  it('lists nothing on win32, where a named pipe leaves no file', () => {
    expect(socketFilePaths('C:\\Users\\me', 'C:\\Temp', PID, 'win32')).toEqual(
      []
    );
  });
});

describe('the hub under a home too long for a socket path', () => {
  beforeEach(() => {
    resetVscodeMock();
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
