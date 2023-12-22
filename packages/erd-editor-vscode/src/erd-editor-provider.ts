import * as vscode from 'vscode';

import { ErdDocument } from '@/erd-document';
import { ErdEditor } from '@/erd-editor';
import { trackEvent } from '@/utils/googleAnalytics';

export class ErdEditorProvider
  implements vscode.CustomEditorProvider<ErdDocument>
{
  private static readonly viewType = 'editor.erd';

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentContentChangeEvent<ErdDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new ErdEditorProvider(context);

    return vscode.window.registerCustomEditorProvider(
      ErdEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext
  ): Promise<ErdDocument> {
    trackEvent(ErdEditorProvider.viewType);
    const content = await vscode.workspace.fs.readFile(
      openContext.backupId ? vscode.Uri.parse(openContext.backupId) : uri
    );
    const document = ErdDocument.create(uri, content);
    const listener = document.onDidChangeContent(() => {
      this._onDidChangeCustomDocument.fire({ document });
    });

    document.onDidDispose(() => {
      listener.dispose();
    });

    return document;
  }

  async resolveCustomEditor(
    document: ErdDocument,
    webviewPanel: vscode.WebviewPanel
  ) {
    const editor = new ErdEditor(document, webviewPanel.webview, this.context);
    const editorDisposable = await editor.bootstrapWebview();

    webviewPanel.onDidDispose(() => {
      editorDisposable.dispose();
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
