import {
  AnyAction,
  webviewImportFileAction,
  webviewInitialValueAction,
  webviewReplicationAction,
  webviewUpdateReadonlyAction,
  webviewUpdateThemeAction,
} from '@dineug/erd-editor-vscode-bridge';
import { decode } from 'base64-arraybuffer';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { getTheme, saveTheme } from '@/configuration';
import { Editor } from '@/editor';
import { textDecoder, textEncoder } from '@/utils';

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

    const [webviewSet, store] = this.docToTupleMap.get(this.document) ?? [];

    const dispatch = (action: AnyAction) => {
      this.webview.postMessage(action);
    };

    const dispatchBroadcast = (action: AnyAction) => {
      if (!webviewSet) return;

      Array.from(webviewSet)
        .filter(webview => webview !== this.webview)
        .forEach(webview => webview.postMessage(action));
    };

    const unsubscribe = this.bridge.on({
      vscodeInitial: () => {
        dispatch(webviewUpdateThemeAction(getTheme()));
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
      vscodeSaveReplication: ({ payload: { actions } }) => {
        store.dispatch(actions);
        dispatchBroadcast(webviewReplicationAction({ actions }));
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
      vscodeSaveTheme: ({ payload }) => {
        saveTheme(payload);
      },
    });

    const listeners: vscode.Disposable[] = [
      this.webview.onDidReceiveMessage(action => this.bridge.emit(action)),
      ...THEME_KEYS.map(key =>
        vscode.workspace.onDidChangeConfiguration(event => {
          if (!event.affectsConfiguration(key, this.document.uri)) {
            return;
          }
          dispatch(webviewUpdateThemeAction(getTheme()));
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
