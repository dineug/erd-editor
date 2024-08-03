import * as vscode from 'vscode';

import { MODERN_VIEW_TYPE } from '@/constants/viewType';
import { CreateEditor } from '@/editor';
import { ErdDocument } from '@/erd-document';
import { trackEvent } from '@/utils/googleAnalytics';

export class ErdEditorProvider
  implements vscode.CustomEditorProvider<ErdDocument>
{
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentContentChangeEvent<ErdDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  private docToWebviewMap = new Map<ErdDocument, Set<vscode.Webview>>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly viewType: string,
    private readonly createEditor: CreateEditor
  ) {}

  static register(
    context: vscode.ExtensionContext,
    createEditor: CreateEditor
  ): vscode.Disposable {
    const provider = new ErdEditorProvider(
      context,
      MODERN_VIEW_TYPE,
      createEditor
    );

    return vscode.window.registerCustomEditorProvider(
      MODERN_VIEW_TYPE,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: true,
      }
    );
  }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext
  ): Promise<ErdDocument> {
    trackEvent(this.viewType);
    const content = await vscode.workspace.fs.readFile(
      openContext.backupId ? vscode.Uri.parse(openContext.backupId) : uri
    );
    const document = ErdDocument.create(uri, content);
    const listener = document.onDidChangeContent(() => {
      this._onDidChangeCustomDocument.fire({ document });
    });
    let unsubscribe = () => {};

    if (!this.docToWebviewMap.has(document)) {
      this.docToWebviewMap.set(document, new Set());
    }

    document.onDidDispose(() => {
      listener.dispose();
      unsubscribe();
      this.docToWebviewMap.delete(document);
    });

    return document;
  }

  async resolveCustomEditor(
    document: ErdDocument,
    webviewPanel: vscode.WebviewPanel
  ) {
    const webviewSet = this.docToWebviewMap.get(document);
    const webview = webviewPanel.webview;
    webviewSet?.add(webview);

    const editor = this.createEditor(
      document,
      webview,
      this.context,
      this.docToWebviewMap
    );
    const editorDisposable = await editor.bootstrapWebview();

    webviewPanel.onDidDispose(() => {
      editorDisposable.dispose();
      webviewSet?.delete(webview);
    });
  }

  async saveCustomDocument(document: ErdDocument) {
    return await document.save();
  }

  async saveCustomDocumentAs(document: ErdDocument, destination: vscode.Uri) {
    return await document.saveAs(destination);
  }

  async revertCustomDocument(document: ErdDocument) {
    return await document.revert();
  }

  async backupCustomDocument(
    document: ErdDocument,
    context: vscode.CustomDocumentBackupContext
  ) {
    return await document.backup(context.destination);
  }
}
