import {
  AnyAction,
  Bridge,
  type CommandPayload,
  hostExportFileCommand,
  hostImportFileCommand,
  hostInitialCommand,
  hostSaveReplicationCommand,
  hostSaveThemeCommand,
  hostSaveValueCommand,
  webviewImportFileCommand,
  webviewInitialValueCommand,
  webviewReplicationCommand,
  webviewUpdateReadonlyCommand,
  webviewUpdateThemeCommand,
} from '@dineug/erd-editor-vscode-bridge';
import { decode } from 'base64-arraybuffer';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { getTheme, saveTheme } from '@/configuration';
import { Editor } from '@/editor';
import { textDecoder, textEncoder } from '@/utils';

type ImportFileType = CommandPayload<typeof hostImportFileCommand>['type'];

/**
 * The extensions each import type answers to and the label the dialog shows.
 * One source feeds both the filter and the check on what was picked, keyed by
 * ImportFileType so widening the union without listing them is a build error.
 */
const IMPORT_FILE_TYPES: Record<
  ImportFileType,
  { label: string; extensions: string[] }
> = {
  json: { label: 'JSON', extensions: ['json'] },
  sql: { label: 'SQL', extensions: ['sql'] },
  graphql: { label: 'GraphQL', extensions: ['graphql', 'gql', 'graphqls'] },
  dbml: { label: 'DBML', extensions: ['dbml'] },
  aml: { label: 'AML', extensions: ['aml'] },
};

const THEME_KEYS = [
  'dineug.erd-editor.theme.appearance',
  'dineug.erd-editor.theme.grayColor',
  'dineug.erd-editor.theme.accentColor',
  'workbench.colorTheme',
];

export class ErdEditor extends Editor {
  assetsDir = 'public';

  async bootstrapWebview() {
    this.webview.options = {
      enableScripts: true,
    };

    const webviewSet = this.docToWebviewMap.get(this.document);

    const dispatch = (action: AnyAction) => {
      this.webview.postMessage(action);
    };

    const dispatchBroadcast = (action: AnyAction) => {
      if (!webviewSet) return;

      Array.from(webviewSet)
        .filter(webview => webview !== this.webview)
        .forEach(webview => webview.postMessage(action));
    };

    const dispose = Bridge.mergeRegister(
      this.bridge.registerCommand(hostInitialCommand, () => {
        dispatch(Bridge.executeCommand(webviewUpdateThemeCommand, getTheme()));
        dispatch(
          Bridge.executeCommand(webviewUpdateReadonlyCommand, this.readonly)
        );
        dispatch(
          Bridge.executeCommand(webviewInitialValueCommand, {
            value: textDecoder.decode(this.document.content),
          })
        );
      }),
      this.bridge.registerCommand(hostSaveValueCommand, async ({ value }) => {
        await this.document.update(textEncoder.encode(value));
      }),
      this.bridge.registerCommand(hostSaveReplicationCommand, ({ actions }) => {
        dispatchBroadcast(
          Bridge.executeCommand(webviewReplicationCommand, { actions })
        );
      }),
      this.bridge.registerCommand(
        hostImportFileCommand,
        async ({ type, op }) => {
          const { label, extensions } = IMPORT_FILE_TYPES[type];

          const uris = await vscode.window.showOpenDialog({
            filters: { [label]: extensions },
          });
          if (!uris || !uris.length) return;

          const uri = uris[0];
          // The alternation is what lets one type arrive under several
          // extensions. The backslash has to survive the template literal, or
          // the dot becomes a wildcard and a longer suffix passes.
          const regexp = new RegExp(`\\.(?:${extensions.join('|')})$`, 'i');

          if (!regexp.test(uri.path)) {
            vscode.window.showInformationMessage(
              `Just import the ${type} file`
            );
            return;
          }

          const value = await vscode.workspace.fs.readFile(uris[0]);
          dispatch(
            Bridge.executeCommand(webviewImportFileCommand, {
              type,
              op,
              value: textDecoder.decode(value),
            })
          );
        }
      ),
      this.bridge.registerCommand(
        hostExportFileCommand,
        async ({ value, fileName }) => {
          let defaultPath = os.homedir();

          if (
            Array.isArray(vscode.workspace.workspaceFolders) &&
            vscode.workspace.workspaceFolders.length
          ) {
            defaultPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
          }

          const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(path.join(defaultPath, fileName)),
          });
          if (!uri) return;

          await vscode.workspace.fs.writeFile(
            uri,
            new Uint8Array(decode(value))
          );
        }
      ),
      this.bridge.registerCommand(hostSaveThemeCommand, payload => {
        saveTheme(payload);
      })
    );

    const listeners: vscode.Disposable[] = [
      this.webview.onDidReceiveMessage(action => {
        this.bridge.executeAction(action);
      }),
      // One listener for all of THEME_KEYS rather than one each: VSCode fires a
      // single event that can report several keys at once, and a listener per
      // key pushed the same theme up to four times.
      vscode.workspace.onDidChangeConfiguration(event => {
        const affected = THEME_KEYS.some(key =>
          event.affectsConfiguration(key, this.document.uri)
        );
        if (!affected) {
          return;
        }

        dispatch(Bridge.executeCommand(webviewUpdateThemeCommand, getTheme()));
      }),
    ];

    this.webview.html = await this.buildHtmlForWebview();

    return new vscode.Disposable(() => {
      listeners.forEach(listener => listener.dispose());
      dispose();
    });
  }
}
