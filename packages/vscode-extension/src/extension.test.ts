import { readFileSync } from 'node:fs';

import { HubErrorCode } from '@dineug/erd-editor-agent-hub';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { VIEW_TYPE } from '@/constants/viewType';
import { ErdEditorProvider } from '@/erd-editor-provider';
import { activate, deactivate } from '@/extension';
import { nodeHubIo } from '@/hub/io';

import { connectToLock, flush, type MemoryHubIo } from '../test/mocks/hubIo';
import {
  commands,
  createExtensionContext,
  Disposable,
  resetVscodeMock,
  Uri,
  ViewColumn,
  window,
  workspace,
} from '../test/mocks/vscode';

// activate starts the document hub, which must not bind a socket or write a
// lock under the real home directory from a unit test.
vi.mock('@/hub/io', async () => {
  const { createMemoryHubIo } = await import('../test/mocks/hubIo');
  return { nodeHubIo: createMemoryHubIo() };
});

const hubIo = nodeHubIo as MemoryHubIo;

type Manifest = {
  contributes: {
    commands: Array<{ command: string }>;
    menus: Record<string, Array<{ command: string; alt?: string }>>;
  };
};

const manifest: Manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
);

const COMMAND_IDS = [
  'vuerd.showEditor',
  'vuerd.showEditorToSide',
  'vuerd.showSource',
  'vuerd.showSourceToSide',
];

/**
 * All four commands are contributed to editor/title, where VSCode passes the
 * resource uri plus its own editor group context object and never a ViewColumn.
 * An unwrapped registration passes that object along as viewColumn.
 */
const EDITOR_TITLE_CONTEXT = { groupId: 1, editorIndex: 0 };

const uri = Uri.file('/workspace/sample.erd');

function registeredCommandIds() {
  return commands.registerCommand.mock.calls.map(([command]) => command).sort();
}

/** Runs activate and hands back the callback registered under id. */
function activateAndGetCommand(id: string) {
  activate(createExtensionContext() as any);
  const entry = commands.registerCommand.mock.calls.find(
    ([command]) => command === id
  );

  if (!entry) {
    throw new Error(`activate() never registered ${id}`);
  }

  return entry[1];
}

describe('extension', () => {
  beforeEach(() => {
    resetVscodeMock();
    // Every activate starts a hub on the one shared double; a fresh file
    // system and no listener keep one spec's hub out of the next.
    hubIo.files.clear();
    hubIo.servers.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await deactivate();
    vi.restoreAllMocks();
  });

  describe('activate', () => {
    it('hands VSCode six disposables — the custom editor, one per command and the document hub', () => {
      const context = createExtensionContext();

      activate(context as any);

      expect(context.subscriptions).toHaveLength(6);
      expect(window.registerCustomEditorProvider).toHaveBeenCalledTimes(1);
      expect(commands.registerCommand).toHaveBeenCalledTimes(4);
    });

    it('pushes the very disposable each registration returned, so deactivation releases all six', () => {
      const context = createExtensionContext();
      const registration = new Disposable(() => undefined);
      const commandRegistrations = new Map<string, Disposable>();
      window.registerCustomEditorProvider.mockReturnValue(registration);
      commands.registerCommand.mockImplementation((command: string) => {
        const disposable = new Disposable(() => undefined);
        commandRegistrations.set(command, disposable);
        return disposable;
      });

      activate(context as any);

      expect(context.subscriptions).toHaveLength(6);
      expect(context.subscriptions).toContain(registration);
      for (const id of COMMAND_IDS) {
        expect(context.subscriptions).toContain(commandRegistrations.get(id));
      }
      expect(context.subscriptions[5]).toMatchObject({
        setDocuments: expect.any(Function),
        close: expect.any(Function),
        dispose: expect.any(Function),
      });
    });

    it('still registers the editor and every command when the document hub cannot start', async () => {
      const context = createExtensionContext();
      hubIo.homedir.mockImplementationOnce(() => {
        throw new Error('uv_os_homedir returned ENOENT');
      });

      expect(() => activate(context as any)).not.toThrow();

      expect(window.registerCustomEditorProvider).toHaveBeenCalledTimes(1);
      expect(registeredCommandIds()).toEqual(COMMAND_IDS);
      expect(context.subscriptions).toHaveLength(5);
      expect(console.warn).toHaveBeenCalledWith(
        '[erd-editor hub]',
        'could not start the document hub',
        expect.objectContaining({ message: 'uv_os_homedir returned ENOENT' })
      );
      await flush();
      expect(hubIo.lock()).toBeUndefined();
      expect(deactivate()).toBeUndefined();
    });

    it('registers exactly the four vuerd commands', () => {
      activate(createExtensionContext() as any);

      expect(registeredCommandIds()).toEqual(COMMAND_IDS);
    });

    it('registers the custom editor provider under the shared VIEW_TYPE constant', () => {
      activate(createExtensionContext() as any);

      expect(window.registerCustomEditorProvider).toHaveBeenCalledWith(
        VIEW_TYPE,
        expect.any(ErdEditorProvider),
        expect.anything()
      );
    });

    it('only registers — nothing is opened until a command actually runs', () => {
      activate(createExtensionContext() as any);

      expect(window.showTextDocument).not.toHaveBeenCalled();
      expect(commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('document hub', () => {
    it('writes the lock of this window and serves its pipe', async () => {
      activate(createExtensionContext() as any);
      await flush();

      expect(hubIo.lock()).toMatchObject({ hub: true, ide: 'vscode' });
    });

    it('deletes the lock when the hub subscription is disposed', async () => {
      const context = createExtensionContext();
      activate(context as any);
      await flush();

      context.subscriptions[5].dispose();
      await flush();

      expect(hubIo.lock()).toBeUndefined();
    });

    it('deletes the lock in deactivate, which VSCode awaits, and has nothing left to close after', async () => {
      activate(createExtensionContext() as any);
      await flush();

      await deactivate();

      expect(hubIo.lock()).toBeUndefined();
      expect(deactivate()).toBeUndefined();
    });

    /** Activates with /workspace open, so requests pass authorization and reach the handler. */
    async function activateWithWorkspace() {
      workspace.workspaceFolders = [{ uri: Uri.file('/workspace') }];
      hubIo.addDir('/workspace');
      activate(createExtensionContext() as any);
      await flush();
      return connectToLock(hubIo);
    }

    it.each([
      ['listDocuments', {}],
      ['openDocument', { path: '/workspace/a.erd.json', create: true }],
      ['join', { path: '/workspace/a.erd.json' }],
      ['leave', { path: '/workspace/a.erd.json' }],
      ['save', { path: '/workspace/a.erd.json' }],
    ])(
      'answers %s with notOpen until a document registry serves requests',
      async (method, params) => {
        const client = await activateWithWorkspace();

        client.send({ id: 2, method, params });
        await flush();

        expect(client.received[1]).toEqual({
          id: 2,
          ok: false,
          method,
          error: {
            code: HubErrorCode.notOpen,
            message:
              'This VS Code window does not serve ERD documents to agents yet',
          },
        });
      }
    );

    it('logs and drops actions, since no peer can have joined', async () => {
      const client = await activateWithWorkspace();

      client.send({
        method: 'actions',
        params: { path: '/workspace/a.erd.json', actions: [] },
      });
      await flush();
      client.close();

      expect(console.warn).toHaveBeenCalledWith(
        '[erd-editor hub]',
        'dropped actions for /workspace/a.erd.json: no peer can join'
      );
    });
  });

  describe('package.json manifest', () => {
    it('registers a handler for every contributed command — an unhandled command is a dead menu entry', () => {
      activate(createExtensionContext() as any);

      const contributed = manifest.contributes.commands
        .map(command => command.command)
        .sort();

      expect(registeredCommandIds()).toEqual(contributed);
    });

    it('backs every menu entry, alt action included, with a registered handler', () => {
      activate(createExtensionContext() as any);

      // Every command is hidden from the palette, so a menu entry is the only
      // way to reach one: an id with no handler silently does nothing, and a
      // handler no menu names is unreachable.
      const menuCommandIds = Object.values(manifest.contributes.menus)
        .flat()
        .flatMap(item =>
          item.alt ? [item.command, item.alt] : [item.command]
        );

      expect([...new Set(menuCommandIds)].sort()).toEqual(
        registeredCommandIds()
      );
    });
  });

  describe('vuerd.showSource', () => {
    it('opens the raw file in the current column', () => {
      activateAndGetCommand('vuerd.showSource')(uri);

      expect(window.showTextDocument).toHaveBeenCalledTimes(1);
      expect(window.showTextDocument).toHaveBeenCalledWith(uri, {
        viewColumn: undefined,
      });
    });

    it('ignores the extra arguments VSCode passes from the editor title bar', () => {
      // The command is contributed to editor/title, where VSCode calls the
      // handler with more than the resource uri. Registering showSource by
      // reference would bind that second argument to viewColumn.
      activateAndGetCommand('vuerd.showSource')(uri, EDITOR_TITLE_CONTEXT);

      expect(window.showTextDocument).toHaveBeenCalledWith(uri, {
        viewColumn: undefined,
      });
    });

    it('known bug: drops the showTextDocument thenable, so a failed open never reaches the user', () => {
      const rejected = Promise.reject(new Error('file is gone'));
      rejected.catch(() => undefined); // the assertion below is that nobody else does
      window.showTextDocument.mockReturnValue(rejected);

      const result = activateAndGetCommand('vuerd.showSource')(uri);

      expect(result).toBeUndefined();
    });
  });

  describe('vuerd.showSourceToSide', () => {
    it('opens the raw file beside the editor instead of replacing it', () => {
      activateAndGetCommand('vuerd.showSourceToSide')(uri);

      expect(window.showTextDocument).toHaveBeenCalledTimes(1);
      expect(window.showTextDocument).toHaveBeenCalledWith(uri, {
        viewColumn: ViewColumn.Beside,
      });
    });

    it('pins Beside even when VSCode forwards its own editor title context', () => {
      activateAndGetCommand('vuerd.showSourceToSide')(
        uri,
        EDITOR_TITLE_CONTEXT
      );

      expect(window.showTextDocument).toHaveBeenCalledWith(uri, {
        viewColumn: ViewColumn.Beside,
      });
    });
  });

  describe('vuerd.showEditor', () => {
    it('reopens the file with the erd custom editor in the current column', () => {
      activateAndGetCommand('vuerd.showEditor')(uri);

      expect(commands.executeCommand).toHaveBeenCalledTimes(1);
      expect(commands.executeCommand).toHaveBeenCalledWith(
        'vscode.openWith',
        uri,
        VIEW_TYPE,
        undefined
      );
    });

    it('ignores the extra arguments VSCode passes from the editor title bar', () => {
      // Same contract as vuerd.showSource: only the uri may reach the handler.
      activateAndGetCommand('vuerd.showEditor')(uri, EDITOR_TITLE_CONTEXT);

      expect(commands.executeCommand).toHaveBeenCalledWith(
        'vscode.openWith',
        uri,
        VIEW_TYPE,
        undefined
      );
    });

    it('known bug: drops the executeCommand thenable, so a failed open never reaches the user', () => {
      const rejected = Promise.reject(new Error('no editor for this file'));
      rejected.catch(() => undefined); // the assertion below is that nobody else does
      commands.executeCommand.mockReturnValue(rejected);

      const result = activateAndGetCommand('vuerd.showEditor')(uri);

      expect(result).toBeUndefined();
    });
  });

  describe('vuerd.showEditorToSide', () => {
    it('reopens the file with the erd custom editor beside the source', () => {
      activateAndGetCommand('vuerd.showEditorToSide')(uri);

      expect(commands.executeCommand).toHaveBeenCalledTimes(1);
      expect(commands.executeCommand).toHaveBeenCalledWith(
        'vscode.openWith',
        uri,
        VIEW_TYPE,
        ViewColumn.Beside
      );
    });

    it('pins Beside even when VSCode forwards its own editor title context', () => {
      activateAndGetCommand('vuerd.showEditorToSide')(
        uri,
        EDITOR_TITLE_CONTEXT
      );

      expect(commands.executeCommand).toHaveBeenCalledWith(
        'vscode.openWith',
        uri,
        VIEW_TYPE,
        ViewColumn.Beside
      );
    });
  });
});
