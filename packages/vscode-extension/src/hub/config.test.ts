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

import {
  affectsHubEnabled,
  AGENT_HUB_ENABLED_SETTING,
  isHubEnabled,
} from '@/hub/config';

import {
  createMemoryHub,
  flush,
  type MemoryHub,
  startMemoryHub,
} from '../../test/mocks/hubLayers';
import {
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

function start(io: MemoryHub = createMemoryHub()) {
  return { hub: startMemoryHub(io), io };
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

describe('this window as the hub host', () => {
  beforeEach(() => {
    resetVscodeMock();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('names vscode, and writes only a hub false lock in an untrusted window', async () => {
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

    expect(io.listen).toHaveBeenCalledWith(SOCKET);
    expect(io.lock()).toMatchObject({
      hub: true,
      pipe: SOCKET,
      token: 'token-1',
    });
  });

  it('turns the lock to hub false when the setting goes off, and serves again when it comes back', async () => {
    const { io } = start();
    await flush();
    const client = io.connect(SOCKET);

    setHubSetting(false);
    fireConfigurationChange([AGENT_HUB_ENABLED_SETTING]);
    await flush();

    expect(io.lock()).toMatchObject({ hub: false, pipe: '', token: '' });
    expect(client.closed).toBe(true);

    setHubSetting(true);
    fireConfigurationChange([AGENT_HUB_ENABLED_SETTING]);
    await flush();

    expect(io.listen).toHaveBeenCalledTimes(2);
    expect(io.lock()).toMatchObject({ hub: true, token: 'token-2' });
  });

  it('ignores a configuration change to any other setting', async () => {
    const { io } = start();
    await flush();
    io.fs.writeFileString.mockClear();

    fireConfigurationChange(['dineug.erd-editor.theme.appearance']);
    await flush();

    expect(io.fs.writeFileString).not.toHaveBeenCalled();
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

  it('stops listening to trust, setting and folder events once closed', async () => {
    workspace.isTrusted = false;
    const { io, hub } = start();
    await flush();

    await hub.close();
    fireGrantWorkspaceTrust();
    fireConfigurationChange([AGENT_HUB_ENABLED_SETTING]);
    fireWorkspaceFoldersChange([{ uri: Uri.file('/ws') }]);
    await flush();

    expect(io.listen).not.toHaveBeenCalled();
    expect(io.lock()).toBeUndefined();
  });
});

describe('the workspace folders of the lock', () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  it.each([
    ['undefined', undefined],
    ['empty', []],
  ])('lists none when workspaceFolders is %s', async (_label, folders) => {
    workspace.workspaceFolders = folders;
    const { io } = start();
    await flush();

    expect(io.lock()).toMatchObject({ hub: true, workspaceFolders: [] });
  });

  it('lists the real path of every file folder and leaves virtual folders out', async () => {
    const io = createMemoryHub();
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
    const io = createMemoryHub();
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
});
