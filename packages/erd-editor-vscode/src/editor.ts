import { Emitter } from '@dineug/erd-editor-vscode-bridge';
import * as vscode from 'vscode';

import { ErdDocument } from '@/erd-document';
import { getNonce } from '@/utils';

export type CreateEditor = (
  ...args: ConstructorParameters<typeof Editor>
) => Editor;

export abstract class Editor {
  protected bridge = new Emitter();
  protected textEncoder = new TextEncoder();
  protected textDecoder = new TextDecoder();
  protected abstract assetsDir: string;

  constructor(
    readonly document: ErdDocument,
    readonly webview: vscode.Webview,
    readonly context: vscode.ExtensionContext
  ) {}

  get readonly() {
    return (
      this.document.uri.scheme === 'git' ||
      this.document.uri.scheme === 'conflictResolution'
    );
  }

  abstract bootstrapWebview(): Promise<vscode.Disposable>;

  async buildHtmlForWebview() {
    const publicUri = vscode.Uri.joinPath(
      this.context.extensionUri,
      this.assetsDir
    );
    const content = await vscode.workspace.fs.readFile(
      vscode.Uri.joinPath(publicUri, 'index.html')
    );
    const nonce = getNonce();
    const cspSource = this.webview.cspSource;
    const styleUri = this.webview
      .asWebviewUri(vscode.Uri.joinPath(publicUri, 'webview.css'))
      .toString();
    const scriptUri = this.webview
      .asWebviewUri(vscode.Uri.joinPath(publicUri, 'webview.js'))
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

export function widthEditor(
  EditorComponent: new (...args: ConstructorParameters<typeof Editor>) => Editor
): CreateEditor {
  return (...args) => new EditorComponent(...args);
}
