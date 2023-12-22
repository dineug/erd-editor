import {
  AnyAction,
  Emitter,
  webviewImportFileAction,
  webviewInitialValueAction,
  webviewUpdateThemeAction,
} from '@dineug/erd-editor-vscode-bridge';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { getTheme, saveTheme } from '@/configuration';
import { ErdDocument } from '@/erd-document';
import { getNonce } from '@/utils';

const THEME_KEYS = [
  'dineug.erd-editor.theme.appearance',
  'dineug.erd-editor.theme.grayColor',
  'dineug.erd-editor.theme.accentColor',
];

export class ErdEditor {
  private bridge = new Emitter();
  private textDecoder = new TextDecoder();

  constructor(
    readonly document: ErdDocument,
    readonly webview: vscode.Webview,
    readonly context: vscode.ExtensionContext
  ) {}

  isViewOnly() {
    return (
      this.document.uri.scheme === 'git' ||
      this.document.uri.scheme === 'conflictResolution'
    );
  }

  async bootstrapWebview() {
    this.webview.options = {
      enableScripts: true,
    };

    const dispatch = (action: AnyAction) => {
      this.webview.postMessage(action);
    };

    const unsubscribe = this.bridge.on({
      vscodeInitial: () => {
        dispatch(webviewUpdateThemeAction(getTheme()));
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

  private async buildHtmlForWebview() {
    const publicUri = vscode.Uri.joinPath(this.context.extensionUri, 'public');
    const content = await vscode.workspace.fs.readFile(
      vscode.Uri.joinPath(publicUri, 'index.html')
    );
    const nonce = getNonce();
    const cspSource = this.webview.cspSource;
    const styleUri = this.webview
      .asWebviewUri(vscode.Uri.joinPath(publicUri, 'webview.css'))
      .toString();
    const scriptUri = this.webview
      .asWebviewUri(vscode.Uri.joinPath(publicUri, 'webview.iife.js'))
      .toString();

    const html = this.textDecoder
      .decode(content)
      .replace(/{{nonce}}/gi, nonce)
      .replace(/{{cspSource}}/gi, cspSource)
      .replace('{{webview.css}}', styleUri)
      .replace('{{webview.js}}', scriptUri);

    return html;
  }
}
