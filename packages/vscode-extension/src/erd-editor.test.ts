import {
  Bridge,
  hostExportFileCommand,
  hostImportFileCommand,
  hostInitialCommand,
  hostSaveReplicationCommand,
  hostSaveThemeCommand,
  hostSaveValueCommand,
} from '@dineug/erd-editor-vscode-bridge';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { ErdDocument } from '@/erd-document';
import { ErdEditor } from '@/erd-editor';

import {
  ConfigurationTarget,
  createExtensionContext,
  createWebview,
  createWorkspaceConfiguration,
  fireConfigurationChange,
  resetVscodeMock,
  Uri,
  window,
  workspace,
} from '../test/mocks/vscode';

// `hostExportFileCommand` falls back to `os.homedir()`, which is machine
// dependent. Everything else about `os` stays real.
vi.mock('os', async importOriginal => ({
  ...(await importOriginal<typeof import('os')>()),
  homedir: () => '/home/tester',
}));

const encoder = new TextEncoder();
const HTML_TEMPLATE = '<html><base href="{{extension-base-url}}"></html>';

/**
 * What the real `Webview.asWebviewUri` hands back for the assets folder.
 * Arranged explicitly rather than leaning on the stub's own mapping: the stub
 * normalises the trailing slash of `Uri.joinPath(dir, '/')` away where the real
 * `Uri.joinPath` (`path.posix.join`) keeps it, and the slash is load-bearing
 * for `<base href>`.
 */
const WEBVIEW_ASSETS_URL =
  'https://file+.vscode-resource.vscode-cdn.net/ext/public/';

const asDirPath = (path: string) => (path.endsWith('/') ? path : `${path}/`);

/**
 * Lets every already-resolved promise chain inside an async command handler
 * settle. The bridge dispatches synchronously but the handlers `await`.
 */
function flush() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function createEditor(
  options: {
    uri?: Uri;
    content?: string;
    siblings?: number;
    registerWebviewSet?: boolean;
  } = {}
) {
  const {
    uri = Uri.file('/workspace/sample.erd'),
    content = 'initial',
    siblings = 0,
    registerWebviewSet = true,
  } = options;

  const document = ErdDocument.create(uri as any, encoder.encode(content));
  const webview = createWebview();
  const others = Array.from({ length: siblings }, () => createWebview());
  const context = createExtensionContext();
  const docToWebviewMap = new Map([[document, new Set([webview, ...others])]]);

  webview.asWebviewUri.mockReturnValue(Uri.parse(WEBVIEW_ASSETS_URL));
  workspace.fs.readFile.mockResolvedValue(encoder.encode(HTML_TEMPLATE));

  const editor = new ErdEditor(
    document,
    webview as any,
    context as any,
    (registerWebviewSet ? docToWebviewMap : new Map()) as any
  );

  return { editor, document, webview, others, context };
}

async function bootstrap(options: Parameters<typeof createEditor>[0] = {}) {
  const created = createEditor(options);
  const disposable = await created.editor.bootstrapWebview();

  // `buildHtmlForWebview` already consumed one `readFile`; specs that assert on
  // imports care only about what happens after bootstrap.
  const [htmlUri] = workspace.fs.readFile.mock.calls[0];
  workspace.fs.readFile.mockClear();

  return { ...created, disposable, htmlUri };
}

/** `bridge` is protected on `Editor`; the dispose specs need to drive it. */
function bridgeOf(editor: ErdEditor): Bridge {
  return (editor as unknown as { bridge: Bridge }).bridge;
}

describe('ErdEditor', () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  describe('bootstrapWebview', () => {
    it('enables scripts — the webview bundle cannot boot without them', async () => {
      const { webview } = await bootstrap();

      expect(webview.options).toEqual({ enableScripts: true });
    });

    it('renders the html with the extension base url substituted in', async () => {
      const { webview } = await bootstrap();

      expect(webview.html).toBe(
        `<html><base href="${WEBVIEW_ASSETS_URL}"></html>`
      );
      expect(webview.html).not.toContain('{{extension-base-url}}');
    });

    it('reads index.html out of the assets dir inside the extension', async () => {
      const { htmlUri, webview } = await bootstrap();

      expect(htmlUri.toString()).toBe('file:///ext/public/index.html');
      const [assetsUri] = webview.asWebviewUri.mock.calls[0];
      // Normalised because the stub and the real `Uri.joinPath` disagree about
      // the trailing slash; what this pins is the directory that gets rewritten.
      expect(asDirPath(assetsUri.path)).toBe('/ext/public/');
    });

    it('leaves its listeners live when the html fails to load — characterises a latent bug', async () => {
      const { editor, webview } = createEditor();
      workspace.fs.readFile.mockRejectedValue(new Error('ENOENT'));

      await expect(editor.bootstrapWebview()).rejects.toThrow('ENOENT');

      // Every listener is registered before `buildHtmlForWebview` is awaited,
      // and the Disposable that would release them is never returned — so a
      // panel that failed to boot keeps answering configuration changes.
      fireConfigurationChange(['workbench.colorTheme']);
      expect(webview.postMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('hostInitialCommand', () => {
    it('answers the handshake with theme, readonly and value, in that order', async () => {
      workspace.getConfiguration.mockReturnValue(
        createWorkspaceConfiguration({
          values: {
            appearance: 'light',
            grayColor: 'sand',
            accentColor: 'ruby',
          },
        })
      );
      const { webview, others } = await bootstrap({
        content: '{"version":"3.0.0"}',
        siblings: 1,
      });

      webview.__receive(Bridge.executeCommand(hostInitialCommand, undefined));

      // The handshake answers the panel that asked; the other panel on the same
      // document already has its own state and must not be re-initialised.
      expect(others[0].postMessage).not.toHaveBeenCalled();
      expect(webview.postMessage.mock.calls.map(([action]) => action)).toEqual([
        {
          type: 'webviewUpdateThemeCommand',
          payload: {
            appearance: 'light',
            grayColor: 'sand',
            accentColor: 'ruby',
          },
        },
        { type: 'webviewUpdateReadonlyCommand', payload: false },
        {
          type: 'webviewInitialValueCommand',
          payload: { value: '{"version":"3.0.0"}' },
        },
      ]);
    });

    it('falls back to the packaged theme defaults when nothing is configured', async () => {
      const { webview } = await bootstrap();

      webview.__receive(Bridge.executeCommand(hostInitialCommand, undefined));

      expect(webview.postMessage.mock.calls[0][0]).toEqual({
        type: 'webviewUpdateThemeCommand',
        payload: {
          appearance: 'dark',
          grayColor: 'slate',
          accentColor: 'indigo',
        },
      });
    });

    it('reports readonly for a git-scheme document — that file cannot be written', async () => {
      const { webview } = await bootstrap({
        uri: Uri.parse('git:/workspace/sample.erd'),
      });

      webview.__receive(Bridge.executeCommand(hostInitialCommand, undefined));

      expect(webview.postMessage.mock.calls[1][0]).toEqual({
        type: 'webviewUpdateReadonlyCommand',
        payload: true,
      });
    });

    it('decodes the stored bytes as utf-8, not latin-1', async () => {
      const { webview } = await bootstrap({
        content: '{"name":"주문 테이블"}',
      });

      webview.__receive(Bridge.executeCommand(hostInitialCommand, undefined));

      expect(webview.postMessage.mock.calls[2][0]).toEqual({
        type: 'webviewInitialValueCommand',
        payload: { value: '{"name":"주문 테이블"}' },
      });
    });
  });

  describe('hostSaveValueCommand', () => {
    it('writes the utf-8 encoded value back into the document', async () => {
      const { webview, document } = await bootstrap();
      const update = vi.spyOn(document, 'update');

      webview.__receive(
        Bridge.executeCommand(hostSaveValueCommand, { value: 'héllo' })
      );
      await flush();

      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0]).toEqual(
        new Uint8Array([104, 195, 169, 108, 108, 111])
      );
      expect(document.content).toEqual(encoder.encode('héllo'));
    });
  });

  describe('hostSaveReplicationCommand', () => {
    it('broadcasts to every other webview on the document and never back to the sender', async () => {
      const { webview, others } = await bootstrap({ siblings: 2 });
      const actions = [{ type: 'addTable' }];

      webview.__receive(
        Bridge.executeCommand(hostSaveReplicationCommand, { actions })
      );

      const expected = {
        type: 'webviewReplicationCommand',
        payload: { actions },
      };
      expect(others[0].postMessage).toHaveBeenCalledTimes(1);
      expect(others[0].postMessage).toHaveBeenCalledWith(expected);
      expect(others[1].postMessage).toHaveBeenCalledTimes(1);
      expect(others[1].postMessage).toHaveBeenCalledWith(expected);
      // The sender already applied the actions locally; echoing them back would
      // replay them into the split view that produced them.
      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it('sends nothing when the sender is the only webview on the document', async () => {
      const { webview } = await bootstrap();

      webview.__receive(
        Bridge.executeCommand(hostSaveReplicationCommand, { actions: [] })
      );

      // The set is non-empty — it holds the sender — so this exercises the
      // filter, not the `!webviewSet` early return below.
      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it('stays silent when the document has no registered webview set', async () => {
      const { webview, others } = await bootstrap({
        siblings: 2,
        registerWebviewSet: false,
      });

      webview.__receive(
        Bridge.executeCommand(hostSaveReplicationCommand, { actions: [] })
      );

      expect(webview.postMessage).not.toHaveBeenCalled();
      expect(others[0].postMessage).not.toHaveBeenCalled();
      expect(others[1].postMessage).not.toHaveBeenCalled();
    });
  });

  describe('hostImportFileCommand', () => {
    const importJson = () =>
      Bridge.executeCommand(hostImportFileCommand, {
        type: 'json',
        op: 'set',
        accept: '.json',
      });

    const importGraphQL = () =>
      Bridge.executeCommand(hostImportFileCommand, {
        type: 'graphql',
        op: 'set',
        accept: '.graphql,.gql,.graphqls',
      });

    const importDBML = () =>
      Bridge.executeCommand(hostImportFileCommand, {
        type: 'dbml',
        op: 'set',
        accept: '.dbml',
      });

    it('filters the dialog by the extensions of the requested type', async () => {
      const { webview } = await bootstrap();
      window.showOpenDialog.mockResolvedValue([
        Uri.file('/workspace/sample.json'),
      ]);
      workspace.fs.readFile.mockResolvedValue(encoder.encode('{}'));

      webview.__receive(importJson());
      await flush();

      // The filter comes from the extension table, not from the `accept` string
      // on the payload: the same table decides whether the picked file is
      // accepted afterwards, so the dialog can never offer a file the check
      // then rejects.
      expect(window.showOpenDialog).toHaveBeenCalledWith({
        filters: { JSON: ['json'] },
      });
    });

    it('offers every graphql extension in one filter', async () => {
      const { webview } = await bootstrap();
      window.showOpenDialog.mockResolvedValue(undefined);

      webview.__receive(importGraphQL());
      await flush();

      expect(window.showOpenDialog).toHaveBeenCalledWith({
        filters: { GraphQL: ['graphql', 'gql', 'graphqls'] },
      });
    });

    it('offers the dbml extension in its own filter', async () => {
      const { webview } = await bootstrap();
      window.showOpenDialog.mockResolvedValue(undefined);

      webview.__receive(importDBML());
      await flush();

      expect(window.showOpenDialog).toHaveBeenCalledWith({
        filters: { DBML: ['dbml'] },
      });
    });

    it('forwards a dbml file', async () => {
      const { webview } = await bootstrap();
      const uri = Uri.file('/workspace/schema.dbml');
      window.showOpenDialog.mockResolvedValue([uri]);
      workspace.fs.readFile.mockResolvedValue(
        encoder.encode('Table users { id int [pk] }')
      );

      webview.__receive(importDBML());
      await flush();

      expect(webview.postMessage).toHaveBeenCalledWith({
        type: 'webviewImportFileCommand',
        payload: {
          type: 'dbml',
          op: 'set',
          value: 'Table users { id int [pk] }',
        },
      });
    });

    it('refuses a file that is not dbml', async () => {
      const { webview } = await bootstrap();
      window.showOpenDialog.mockResolvedValue([
        Uri.file('/workspace/schema.sql'),
      ]);

      webview.__receive(importDBML());
      await flush();

      expect(window.showInformationMessage).toHaveBeenCalledWith(
        'Just import the dbml file'
      );
      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it('does nothing when the open dialog is cancelled', async () => {
      const { webview } = await bootstrap();
      window.showOpenDialog.mockResolvedValue(undefined);

      webview.__receive(importJson());
      await flush();

      expect(workspace.fs.readFile).not.toHaveBeenCalled();
      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it('does nothing when the open dialog resolves an empty selection', async () => {
      const { webview } = await bootstrap();
      window.showOpenDialog.mockResolvedValue([]);

      webview.__receive(importJson());
      await flush();

      expect(workspace.fs.readFile).not.toHaveBeenCalled();
      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it('refuses a file whose extension does not match the requested type', async () => {
      const { webview } = await bootstrap();
      window.showOpenDialog.mockResolvedValue([
        Uri.file('/workspace/notes.txt'),
      ]);

      webview.__receive(importJson());
      await flush();

      const [message] = window.showInformationMessage.mock
        .calls[0] as unknown as [string];
      expect(message).toBe('Just import the json file');
      expect(workspace.fs.readFile).not.toHaveBeenCalled();
      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it('reads the chosen file and forwards it with the same type and op', async () => {
      const { webview } = await bootstrap();
      const uri = Uri.file('/workspace/schema.sql');
      window.showOpenDialog.mockResolvedValue([uri]);
      workspace.fs.readFile.mockResolvedValue(
        encoder.encode('CREATE TABLE a();')
      );

      webview.__receive(
        Bridge.executeCommand(hostImportFileCommand, {
          type: 'sql',
          op: 'diff',
          accept: '.sql',
        })
      );
      await flush();

      expect(workspace.fs.readFile).toHaveBeenCalledWith(uri);
      expect(window.showInformationMessage).not.toHaveBeenCalled();
      expect(webview.postMessage).toHaveBeenCalledWith({
        type: 'webviewImportFileCommand',
        payload: { type: 'sql', op: 'diff', value: 'CREATE TABLE a();' },
      });
    });

    it('rejects sample.xjson — the dot in the extension is a literal separator', async () => {
      const { webview } = await bootstrap();
      window.showOpenDialog.mockResolvedValue([
        Uri.file('/workspace/sample.xjson'),
      ]);
      workspace.fs.readFile.mockResolvedValue(encoder.encode('{}'));

      webview.__receive(importJson());
      await flush();

      // Guards the escaping in `new RegExp(\`\\.${type}$\`)`: with a single
      // backslash the pattern degrades to `.json$`, where the dot is a wildcard
      // and any `*xjson` file passes as JSON.
      expect(window.showInformationMessage).toHaveBeenCalledWith(
        'Just import the json file'
      );
      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it.each(['schema.graphql', 'schema.gql', 'schema.graphqls'])(
      'forwards %s — graphql answers to more than one extension',
      async fileName => {
        const { webview } = await bootstrap();
        const uri = Uri.file(`/workspace/${fileName}`);
        window.showOpenDialog.mockResolvedValue([uri]);
        workspace.fs.readFile.mockResolvedValue(
          encoder.encode('type User { id: ID! }')
        );

        webview.__receive(importGraphQL());
        await flush();

        expect(workspace.fs.readFile).toHaveBeenCalledWith(uri);
        expect(window.showInformationMessage).not.toHaveBeenCalled();
        expect(webview.postMessage).toHaveBeenCalledWith({
          type: 'webviewImportFileCommand',
          payload: {
            type: 'graphql',
            op: 'set',
            value: 'type User { id: ID! }',
          },
        });
      }
    );

    it('matches the graphql extensions case-insensitively', async () => {
      const { webview } = await bootstrap();
      window.showOpenDialog.mockResolvedValue([
        Uri.file('/workspace/Schema.GQL'),
      ]);
      workspace.fs.readFile.mockResolvedValue(
        encoder.encode('type A { b: ID }')
      );

      webview.__receive(importGraphQL());
      await flush();

      expect(window.showInformationMessage).not.toHaveBeenCalled();
      expect(webview.postMessage).toHaveBeenCalled();
    });

    it('refuses a prisma schema — a neighbouring format, not SDL', async () => {
      const { webview } = await bootstrap();
      window.showOpenDialog.mockResolvedValue([
        Uri.file('/workspace/schema.prisma'),
      ]);

      webview.__receive(importGraphQL());
      await flush();

      expect(window.showInformationMessage).toHaveBeenCalledWith(
        'Just import the graphql file'
      );
      expect(workspace.fs.readFile).not.toHaveBeenCalled();
      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it('rejects sample.xgql — the alternation stays anchored to the dot', async () => {
      const { webview } = await bootstrap();
      window.showOpenDialog.mockResolvedValue([
        Uri.file('/workspace/sample.xgql'),
      ]);

      webview.__receive(importGraphQL());
      await flush();

      expect(window.showInformationMessage).toHaveBeenCalledWith(
        'Just import the graphql file'
      );
      expect(webview.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('hostExportFileCommand', () => {
    const exportFile = () =>
      Bridge.executeCommand(hostExportFileCommand, {
        // base64 of 'hello'
        value: 'aGVsbG8=',
        fileName: 'sample.json',
      });

    it('defaults the save dialog into the first workspace folder', async () => {
      const { webview } = await bootstrap();
      workspace.workspaceFolders = [
        { uri: Uri.file('/workspace') },
        { uri: Uri.file('/other') },
      ];

      webview.__receive(exportFile());
      await flush();

      const [options] = window.showSaveDialog.mock.calls[0] as unknown as [
        { defaultUri: Uri },
      ];
      expect(options.defaultUri.fsPath).toBe('/workspace/sample.json');
    });

    it('defaults to the home directory when no folder is open', async () => {
      const { webview } = await bootstrap();
      workspace.workspaceFolders = undefined;

      webview.__receive(exportFile());
      await flush();

      const [options] = window.showSaveDialog.mock.calls[0] as unknown as [
        { defaultUri: Uri },
      ];
      expect(options.defaultUri.fsPath).toBe('/home/tester/sample.json');
    });

    it('defaults to the home directory when the workspace holds no folders', async () => {
      const { webview } = await bootstrap();
      workspace.workspaceFolders = [];

      webview.__receive(exportFile());
      await flush();

      const [options] = window.showSaveDialog.mock.calls[0] as unknown as [
        { defaultUri: Uri },
      ];
      expect(options.defaultUri.fsPath).toBe('/home/tester/sample.json');
    });

    it('writes nothing when the save dialog is cancelled', async () => {
      const { webview } = await bootstrap();
      window.showSaveDialog.mockResolvedValue(undefined);

      webview.__receive(exportFile());
      await flush();

      expect(workspace.fs.writeFile).not.toHaveBeenCalled();
    });

    it('writes the base64-decoded bytes to the chosen uri', async () => {
      const { webview } = await bootstrap();
      const target = Uri.file('/downloads/sample.json');
      window.showSaveDialog.mockResolvedValue(target);

      webview.__receive(exportFile());
      await flush();

      expect(workspace.fs.writeFile).toHaveBeenCalledTimes(1);
      expect(workspace.fs.writeFile).toHaveBeenCalledWith(
        target,
        new Uint8Array([104, 101, 108, 108, 111])
      );
    });
  });

  describe('hostSaveThemeCommand', () => {
    it('persists all three theme settings through the configuration api', async () => {
      const config = createWorkspaceConfiguration();
      workspace.getConfiguration.mockReturnValue(config);
      const { webview } = await bootstrap();

      webview.__receive(
        Bridge.executeCommand(hostSaveThemeCommand, {
          appearance: 'light',
          grayColor: 'sand',
          accentColor: 'ruby',
        })
      );

      expect(workspace.getConfiguration).toHaveBeenCalledWith(
        'dineug.erd-editor.theme'
      );
      expect(config.update.mock.calls).toEqual([
        ['appearance', 'light', ConfigurationTarget.Global],
        ['grayColor', 'sand', ConfigurationTarget.Global],
        ['accentColor', 'ruby', ConfigurationTarget.Global],
      ]);
    });
  });

  describe('configuration changes', () => {
    it('pushes a fresh theme when a theme key changes', async () => {
      const { webview } = await bootstrap();
      workspace.getConfiguration.mockReturnValue(
        createWorkspaceConfiguration({
          values: {
            appearance: 'light',
            grayColor: 'sand',
            accentColor: 'ruby',
          },
        })
      );

      fireConfigurationChange(['workbench.colorTheme']);

      expect(webview.postMessage).toHaveBeenCalledTimes(1);
      expect(webview.postMessage).toHaveBeenCalledWith({
        type: 'webviewUpdateThemeCommand',
        payload: {
          appearance: 'light',
          grayColor: 'sand',
          accentColor: 'ruby',
        },
      });
    });

    it('asks about every theme key, scoped to the document uri', async () => {
      const { document } = await bootstrap();
      const affectsConfiguration = vi.fn(
        (_section: string, _scope?: unknown) => false
      );

      workspace.onDidChangeConfiguration.mock.calls.forEach(([listener]) =>
        listener({ affectsConfiguration })
      );

      // `affectsConfiguration` takes an optional scope; without the document
      // uri a folder-scoped theme would repaint panels in other folders too.
      expect(affectsConfiguration.mock.calls).toEqual([
        ['dineug.erd-editor.theme.appearance', document.uri],
        ['dineug.erd-editor.theme.grayColor', document.uri],
        ['dineug.erd-editor.theme.accentColor', document.uri],
        ['workbench.colorTheme', document.uri],
      ]);
    });

    it('ignores a change that touches no theme key', async () => {
      const { webview } = await bootstrap();

      fireConfigurationChange(['editor.fontSize']);

      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it('pushes once for an event that reports several theme keys as affected', async () => {
      const { webview } = await bootstrap();

      fireConfigurationChange([
        'dineug.erd-editor.theme.appearance',
        'dineug.erd-editor.theme.grayColor',
        'workbench.colorTheme',
      ]);

      // Switching a theme preset rewrites several keys in one settings write.
      // A listener per THEME_KEY would turn that single event into one push per
      // matching key, each re-reading the same configuration.
      expect(webview.postMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('dispose', () => {
    it('stops handling messages coming from the webview', async () => {
      const { webview, disposable } = await bootstrap();

      disposable.dispose();
      webview.__receive(Bridge.executeCommand(hostInitialCommand, undefined));
      await flush();

      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it('stops pushing theme updates on configuration changes', async () => {
      const { webview, disposable } = await bootstrap();

      disposable.dispose();
      fireConfigurationChange([
        'workbench.colorTheme',
        'dineug.erd-editor.theme.appearance',
      ]);

      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it('unregisters the bridge commands, not just the webview listener', async () => {
      const { editor, document, disposable } = await bootstrap();
      const update = vi.spyOn(document, 'update');
      const bridge = bridgeOf(editor);
      const save = Bridge.executeCommand(hostSaveValueCommand, {
        value: 'ignored',
      });

      bridge.executeAction(save);
      await flush();
      expect(update).toHaveBeenCalledTimes(1);

      disposable.dispose();
      // Driven straight at the bridge on purpose: replaying this through
      // `webview.__receive` would be satisfied by the message listener being
      // gone and would say nothing about the command registrations.
      bridge.executeAction(save);
      await flush();

      expect(update).toHaveBeenCalledTimes(1);
    });
  });
});
