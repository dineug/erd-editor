import { readFileSync } from 'node:fs';

import { HUB_PROTOCOL_VERSION } from '@dineug/erd-editor-agent-hub';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { startDocumentHub } from '@/hub';
import {
  affectsHubEnabled,
  AGENT_HUB_ENABLED_SETTING,
  isHubEnabled,
} from '@/hub/config';

import {
  createHubHandler,
  createMemoryHubIo,
  flush,
  type MemoryHubIo,
} from '../../test/mocks/hubIo';
import {
  createExtensionContext,
  createWorkspaceConfiguration,
  fireConfigurationChange,
  fireGrantWorkspaceTrust,
  fireWorkspaceFoldersChange,
  resetVscodeMock,
  Uri,
  workspace,
} from '../../test/mocks/vscode';

const SOCKET = '/home/user/.erd-editor/ide/4242.sock';

const manifest = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')
);

const contributedSetting = Object.assign(
  {},
  ...[manifest.contributes.configuration]
    .flat()
    .map((entry: any) => entry.properties)
)[AGENT_HUB_ENABLED_SETTING];

function setHubSetting(value: unknown) {
  workspace.getConfiguration.mockImplementation(() =>
    createWorkspaceConfiguration({ values: { enabled: value } })
  );
}

function start(io: MemoryHubIo = createMemoryHubIo()) {
  const context = createExtensionContext();
  const hub = startDocumentHub(context as any, createHubHandler(), io);
  return { hub, io, context };
}

describe('isHubEnabled', () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  it('is on in a trusted window with nothing configured', () => {
    expect(isHubEnabled()).toBe(true);
    expect(workspace.getConfiguration).toHaveBeenCalledWith(
      'dineug.erd-editor.agentHub'
    );
  });

  it('is off in an untrusted window whatever the setting says', () => {
    workspace.isTrusted = false;
    setHubSetting(true);

    expect(isHubEnabled()).toBe(false);
  });

  it('is off when the setting is false', () => {
    setHubSetting(false);

    expect(isHubEnabled()).toBe(false);
  });

  it('defaults to the value package.json contributes, as a boolean setting', () => {
    const config = createWorkspaceConfiguration();
    workspace.getConfiguration.mockReturnValue(config);

    isHubEnabled();

    expect(contributedSetting).toMatchObject({
      type: 'boolean',
      default: true,
    });
    expect(config.get).toHaveBeenCalledWith(
      'enabled',
      contributedSetting.default
    );
  });
});

describe('affectsHubEnabled', () => {
  it('matches a change of the enabled setting only', () => {
    const event = (sections: string[]) => ({
      affectsConfiguration: (section: string) => sections.includes(section),
    });

    expect(affectsHubEnabled(event([AGENT_HUB_ENABLED_SETTING]))).toBe(true);
    expect(affectsHubEnabled(event(['dineug.erd-editor.theme']))).toBe(false);
  });
});

describe('the hub by trust and setting', () => {
  beforeEach(() => {
    resetVscodeMock();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes only a hub false lock in an untrusted window, and never listens', async () => {
    workspace.isTrusted = false;
    const { io } = start();
    await flush();

    expect(io.listen).not.toHaveBeenCalled();
    expect(io.lock()).toEqual({
      pipe: '',
      workspaceFolders: [],
      documents: [],
      ide: 'vscode',
      version: '0.0.0-mock',
      protocolVersion: HUB_PROTOCOL_VERSION,
      token: '',
      hub: false,
    });
    expect(io.files.get(io.lockPath())?.mode).toBe(0o600);
  });

  it('writes only a hub false lock when the setting is off', async () => {
    setHubSetting(false);
    const { io } = start();
    await flush();

    expect(io.listen).not.toHaveBeenCalled();
    expect(io.lock()).toMatchObject({ hub: false, pipe: '', token: '' });
  });

  it('starts serving once trust is granted, and the lock then names the pipe and a token', async () => {
    workspace.isTrusted = false;
    const { io } = start();
    await flush();

    fireGrantWorkspaceTrust();
    await flush();

    expect(io.listen).toHaveBeenCalledWith(SOCKET, expect.any(Function));
    expect(io.lock()).toMatchObject({
      hub: true,
      pipe: SOCKET,
      token: 'token-1',
    });
  });

  it('keeps a hub false lock when trust is granted but the pipe cannot listen', async () => {
    workspace.isTrusted = false;
    const { io } = start();
    await flush();
    io.listen.mockRejectedValueOnce(new Error('EADDRINUSE'));
    io.rename.mockClear();

    fireGrantWorkspaceTrust();
    await flush();

    expect(io.listen).toHaveBeenCalledTimes(1);
    expect(io.rename).toHaveBeenCalledTimes(1);
    expect(io.lock()).toMatchObject({ hub: false, pipe: '', token: '' });
  });

  it('retries listening on the next trust event after a failure', async () => {
    const io = createMemoryHubIo();
    io.listen.mockRejectedValueOnce(new Error('EADDRINUSE'));
    start(io);
    await flush();

    fireGrantWorkspaceTrust();
    await flush();

    expect(io.listen).toHaveBeenCalledTimes(2);
    expect(io.lock()).toMatchObject({ hub: true, token: 'token-2' });
  });

  it('keeps serving through a trust event in a window that was already trusted', async () => {
    const { io } = start();
    await flush();

    fireGrantWorkspaceTrust();
    await flush();

    expect(io.listen).toHaveBeenCalledTimes(1);
    expect(io.lock()).toMatchObject({ hub: true, token: 'token-1' });
  });

  it('turns the lock to hub false before closing the pipe when the setting goes off', async () => {
    const { io } = start();
    await flush();
    const client = io.connect(SOCKET);
    const handle = await io.listen.mock.results[0].value;
    io.rename.mockClear();

    setHubSetting(false);
    fireConfigurationChange([AGENT_HUB_ENABLED_SETTING]);
    await flush();

    expect(io.lock()).toMatchObject({ hub: false, pipe: '', token: '' });
    expect(client.closed).toBe(true);
    expect(io.servers.has(SOCKET)).toBe(false);
    expect(io.files.has(SOCKET)).toBe(false);
    // A client that reads the lock in between finds hub false, never a pipe
    // that no longer answers.
    expect(io.rename.mock.invocationCallOrder[0]).toBeLessThan(
      handle.close.mock.invocationCallOrder[0]
    );
  });

  it('serves again with a new token when the setting comes back on', async () => {
    const { io } = start();
    await flush();
    setHubSetting(false);
    fireConfigurationChange([AGENT_HUB_ENABLED_SETTING]);
    await flush();

    setHubSetting(true);
    fireConfigurationChange([AGENT_HUB_ENABLED_SETTING]);
    await flush();

    expect(io.listen).toHaveBeenCalledTimes(2);
    expect(io.lock()).toMatchObject({ hub: true, token: 'token-2' });
  });

  it('ignores a configuration change to any other setting', async () => {
    const { io } = start();
    await flush();
    io.writeFile.mockClear();

    fireConfigurationChange(['dineug.erd-editor.theme.appearance']);
    await flush();

    expect(io.writeFile).not.toHaveBeenCalled();
    expect(io.listen).toHaveBeenCalledTimes(1);
  });

  it('logs and carries on when reading the setting throws', async () => {
    const { io, hub } = start();
    await flush();
    workspace.getConfiguration.mockImplementationOnce(() => {
      throw new Error('settings.json is not JSON');
    });

    fireConfigurationChange([AGENT_HUB_ENABLED_SETTING]);
    await flush();
    await hub.setDocuments(['/elsewhere/a.erd.json']);

    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      expect.objectContaining({ message: 'settings.json is not JSON' })
    );
    expect(io.lock()).toMatchObject({
      hub: true,
      documents: ['/elsewhere/a.erd.json'],
    });
  });

  it('guards with a hub false lock on the next document change when the setting cannot be read at start', async () => {
    workspace.getConfiguration.mockImplementationOnce(() => {
      throw new Error('settings.json is not JSON');
    });
    const { io, hub } = start();
    await flush();
    expect(io.lock()).toBeUndefined();

    await hub.setDocuments(['/elsewhere/a.erd.json']);
    expect(io.lock()).toMatchObject({
      hub: false,
      documents: ['/elsewhere/a.erd.json'],
    });

    fireGrantWorkspaceTrust();
    await flush();
    expect(io.lock()).toMatchObject({ hub: true, token: 'token-1' });
  });
});

describe('the lock of a window without folders', () => {
  beforeEach(() => {
    resetVscodeMock();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['undefined', undefined],
    ['empty', []],
  ])(
    'is written when workspaceFolders is %s, and lists the open documents',
    async (_label, folders) => {
      workspace.workspaceFolders = folders;
      const io = createMemoryHubIo();
      io.addFile('/notes/loose.erd.json');
      const { hub } = start(io);

      await hub.setDocuments(['/notes/loose.erd.json']);

      expect(io.lock()).toMatchObject({
        hub: true,
        workspaceFolders: [],
        documents: ['/notes/loose.erd.json'],
      });
    }
  );

  it('lists the documents in a hub false lock too, since that lock guards them', async () => {
    workspace.isTrusted = false;
    const io = createMemoryHubIo();
    const { hub } = start(io);

    await hub.setDocuments(['/notes/loose.erd.json']);

    expect(io.lock()).toMatchObject({
      hub: false,
      documents: ['/notes/loose.erd.json'],
    });
  });
});

describe('the workspace folders of the lock', () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  it('lists the real path of every file folder and leaves virtual folders out', async () => {
    const io = createMemoryHubIo();
    io.addDir('/real/project');
    io.links.set('/link', '/real');
    workspace.workspaceFolders = [
      { uri: Uri.file('/link/project') },
      { uri: Uri.parse('vscode-vfs://github/dineug/erd-editor') },
    ];
    start(io);
    await flush();

    expect(io.lock()?.workspaceFolders).toEqual(['/real/project']);
  });

  it('rewrites the lock when a folder is added to the window', async () => {
    const io = createMemoryHubIo();
    io.addDir('/a');
    io.addDir('/b');
    workspace.workspaceFolders = [{ uri: Uri.file('/a') }];
    start(io);
    await flush();

    fireWorkspaceFoldersChange([
      { uri: Uri.file('/a') },
      { uri: Uri.file('/b') },
    ]);
    await flush();

    expect(io.lock()?.workspaceFolders).toEqual(['/a', '/b']);
  });

  it('keeps a folder whose realpath fails under the path VSCode reported', async () => {
    const io = createMemoryHubIo();
    workspace.workspaceFolders = [{ uri: Uri.file('/gone') }];
    start(io);
    await flush();

    expect(io.lock()?.workspaceFolders).toEqual(['/gone']);
  });
});
