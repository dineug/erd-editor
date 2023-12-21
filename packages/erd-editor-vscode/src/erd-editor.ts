import {
  AnyAction,
  Emitter,
  webviewImportFileAction,
  webviewInitialValueAction,
} from '@dineug/erd-editor-vscode-bridge';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { ErdDocument } from '@/erd-document';

export class ErdEditor {
  private bridge = new Emitter();
  private textDecoder = new TextDecoder();

  constructor(
    readonly document: ErdDocument,
    readonly webview: vscode.Webview,
    readonly context: vscode.ExtensionContext
  ) {}

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

  private async buildHtmlForWebview() {
    const publicUri = vscode.Uri.joinPath(this.context.extensionUri, 'public');
    const content = await vscode.workspace.fs.readFile(
      vscode.Uri.joinPath(publicUri, 'index.html')
    );
    const nonce = getNonce();
    const cspSource = this.webview.cspSource;
    const scriptUri = this.webview
      .asWebviewUri(
        vscode.Uri.joinPath(
          this.context.extensionUri,
          'public',
          'webview.iife.js'
        )
      )
      .toString();

    const html = this.textDecoder
      .decode(content)
      .replace(/{{nonce}}/gi, nonce)
      .replace(/{{cspSource}}/gi, cspSource)
      .replace('{{webview}}', scriptUri);

    return html;
  }
}

function getNonce() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
