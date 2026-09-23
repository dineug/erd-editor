import { Bridge } from '@dineug/erd-editor-webview-bridge';
import * as vscode from 'vscode';

import { ErdDocument } from '@/erd-document';
import { type WebviewRelay } from '@/hub/documentRegistry';
import { isReadonlyUri } from '@/hub/readonlyUri';
import { textDecoder } from '@/utils';

export type CreateEditor = (
  ...args: ConstructorParameters<typeof Editor>
) => Editor;

export abstract class Editor {
  protected bridge = new Bridge();
  protected abstract assetsDir: string;

  constructor(
    readonly document: ErdDocument,
    readonly webview: vscode.Webview,
    readonly context: vscode.ExtensionContext,
    readonly docToWebviewMap: Map<ErdDocument, Set<vscode.Webview>>,
    readonly registry: WebviewRelay
  ) {}

  get readonly() {
    return isReadonlyUri(this.document.uri);
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
    const baseUrl = this.webview
      .asWebviewUri(vscode.Uri.joinPath(publicUri, '/'))
      .toString();

    // Global: a string pattern would substitute only the first occurrence and
    // ship the literal token for any later one.
    const html = textDecoder
      .decode(content)
      .replace(/\{\{extension-base-url\}\}/g, baseUrl);

    return html;
  }
}

export function widthEditor(
  EditorComponent: new (...args: ConstructorParameters<typeof Editor>) => Editor
): CreateEditor {
  return (...args) => new EditorComponent(...args);
}
