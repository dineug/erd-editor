import {
  AnyAction,
  webviewImportFileAction,
  webviewInitialValueAction,
} from '@dineug/erd-editor-vscode-bridge';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { Editor } from '@/editor';

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
        dispatch(
          webviewInitialValueAction({
            value: Array.from(this.document.content),
          })
        );
      },
      vscodeSaveValue: async ({ payload: { value } }) => {
        await this.document.update(new Uint8Array(value));
      },
      vscodeImportFile: async ({ payload: { type } }) => {
        const uris = await vscode.window.showOpenDialog();
        if (!uris || !uris.length) return;

        const uri = uris[0];
        const regexp = new RegExp(`\.(${type})$`, 'i');

        if (!regexp.test(uri.path)) {
          vscode.window.showInformationMessage(`Just import the ${type} file`);
          return;
        }

        const value = await vscode.workspace.fs.readFile(uris[0]);
        dispatch(webviewImportFileAction({ type, value: Array.from(value) }));
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

        await vscode.workspace.fs.writeFile(uri, new Uint8Array(value));
      },
    });

    const listeners: vscode.Disposable[] = [
      this.webview.onDidReceiveMessage(action => this.bridge.emit(action)),
    ];

    this.webview.html = await this.buildHtmlForWebview();

    return new vscode.Disposable(() => {
      unsubscribe();
      listeners.forEach(listener => listener.dispose());
    });
  }
}
