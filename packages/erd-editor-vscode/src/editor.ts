import { Emitter } from '@dineug/erd-editor-vscode-bridge';
import * as vscode from 'vscode';

import { ErdDocument } from '@/erd-document';
import { textDecoder } from '@/utils';

export type CreateEditor = (
  ...args: ConstructorParameters<typeof Editor>
) => Editor;

export abstract class Editor {
  protected bridge = new Emitter();
  protected abstract assetsDir: string;

  constructor(
    readonly document: ErdDocument,
    readonly webview: vscode.Webview,
    readonly context: vscode.ExtensionContext,
    readonly docToWebviewMap: Map<ErdDocument, Set<vscode.Webview>>
  ) {}

  get readonly() {
    // TODO: scheme
    // scheme: untitled, file, git, conflictResolution
    // const editable = vscode.workspace.fs.isWritableFileSystem(
    //   this.document.uri.scheme
    // );
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
    const baseUrl = this.webview
      .asWebviewUri(vscode.Uri.joinPath(publicUri, '/'))
      .toString();

    const html = textDecoder
      .decode(content)
      .replace('{{extension-base-url}}', baseUrl);

    return html;
  }
}

export function widthEditor(
  EditorComponent: new (...args: ConstructorParameters<typeof Editor>) => Editor
): CreateEditor {
  return (...args) => new EditorComponent(...args);
}
