import {
  AnyAction,
  webviewImportFileAction,
  webviewInitialValueAction,
  webviewUpdateReadonlyAction,
  webviewUpdateThemeLegacyAction,
} from '@dineug/erd-editor-vscode-bridge';
import { decode } from 'base64-arraybuffer';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { getThemeLegacy } from '@/configuration';
import { Editor } from '@/editor';
import { textDecoder, textEncoder } from '@/utils';

const THEME_KEYS = [
  'dineug.vuerd-vscode.themeSync',
  'dineug.vuerd-vscode.theme',
  'workbench.colorTheme',
];

export class ErdEditorLegacy extends Editor {
  assetsDir = 'public-legacy';

  async bootstrapWebview() {
    this.webview.options = {
      enableScripts: true,
    };

    const dispatch = (action: AnyAction) => {
      this.webview.postMessage(action);
    };

    const unsubscribe = this.bridge.on({
      vscodeInitial: () => {
        dispatch(webviewUpdateThemeLegacyAction(getThemeLegacy()));
        dispatch(webviewUpdateReadonlyAction(this.readonly));
        dispatch(
          webviewInitialValueAction({
            value: textDecoder.decode(this.document.content),
          })
        );
      },
      vscodeSaveValue: async ({ payload: { value } }) => {
        await this.document.update(textEncoder.encode(value));
      },
      vscodeImportFile: async ({ payload: { type, op } }) => {
        const uris = await vscode.window.showOpenDialog();
        if (!uris || !uris.length) return;

        const uri = uris[0];
        const regexp = new RegExp(`\.(${type}|erd|vuerd)$`, 'i');

        if (!regexp.test(uri.path)) {
          vscode.window.showInformationMessage(`Just import the ${type} file`);
          return;
        }

        const value = await vscode.workspace.fs.readFile(uris[0]);
        dispatch(
          webviewImportFileAction({
            type,
            op,
            value: textDecoder.decode(value),
          })
        );
      },
      vscodeExportFile: async ({ payload: { value, fileName } }) => {
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

        await vscode.workspace.fs.writeFile(uri, new Uint8Array(decode(value)));
      },
    });

    const listeners: vscode.Disposable[] = [
      this.webview.onDidReceiveMessage(action => this.bridge.emit(action)),
      ...THEME_KEYS.map(key =>
        vscode.workspace.onDidChangeConfiguration(event => {
          if (!event.affectsConfiguration(key, this.document.uri)) {
            return;
          }
          dispatch(webviewUpdateThemeLegacyAction(getThemeLegacy()));
        })
      ),
    ];

    this.webview.html = await this.buildHtmlForWebview();

    return new vscode.Disposable(() => {
      unsubscribe();
      listeners.forEach(listener => listener.dispose());
    });
  }
}
