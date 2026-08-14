import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VIEW_TYPE } from '@/constants/viewType';
import { ErdEditorProvider } from '@/erd-editor-provider';
import { activate } from '@/extension';

import {
  commands,
  createExtensionContext,
  Disposable,
  resetVscodeMock,
  Uri,
  ViewColumn,
  window,
} from '../test/mocks/vscode';

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
 * All four commands are contributed to `editor/title`, and VSCode invokes an
 * editor title action with the resource uri *plus* its own editor group context
 * object — never a `ViewColumn`. This is what the unwrapped registrations of
 * `vuerd.showSource` / `vuerd.showEditor` end up passing along as `viewColumn`.
 */
const EDITOR_TITLE_CONTEXT = { groupId: 1, editorIndex: 0 };

const uri = Uri.file('/workspace/sample.erd');

function registeredCommandIds() {
  return commands.registerCommand.mock.calls.map(([command]) => command).sort();
}

/** Runs `activate` and hands back the callback registered under `id`. */
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
  });

  describe('activate', () => {
    it('hands VSCode five disposables — the custom editor plus one per command', () => {
      const context = createExtensionContext();

      activate(context as any);

      expect(context.subscriptions).toHaveLength(5);
      expect(window.registerCustomEditorProvider).toHaveBeenCalledTimes(1);
      expect(commands.registerCommand).toHaveBeenCalledTimes(4);
    });

    it('pushes the very disposable each registration returned, so deactivation releases all five', () => {
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

      expect(context.subscriptions).toContain(registration);
      for (const id of COMMAND_IDS) {
        expect(context.subscriptions).toContain(commandRegistrations.get(id));
      }
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

      // Every command is hidden from the palette (`when: false`), so a menu
      // entry is the only way to reach one: an id here with no handler is an
      // action that silently does nothing, and a handler no menu names is
      // unreachable.
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
      // The command is contributed to `editor/title`, where VSCode calls the
      // handler with more than the resource uri. Registering `showSource` by
      // reference would bind that second argument to `viewColumn`.
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
      // Same contract as `vuerd.showSource`: only the uri may reach the handler.
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
