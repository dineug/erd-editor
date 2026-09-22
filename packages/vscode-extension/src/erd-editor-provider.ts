import * as vscode from 'vscode';

import { VIEW_TYPE } from '@/constants/viewType';
import { CreateEditor } from '@/editor';
import { ErdDocument } from '@/erd-document';
import { type DocumentRegistry } from '@/hub/documentRegistry';

export class ErdEditorProvider implements vscode.CustomEditorProvider<ErdDocument> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentContentChangeEvent<ErdDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly createEditor: CreateEditor,
    private readonly registry: DocumentRegistry
  ) {}

  static register(
    context: vscode.ExtensionContext,
    createEditor: CreateEditor,
    registry: DocumentRegistry
  ): vscode.Disposable {
    const provider = new ErdEditorProvider(context, createEditor, registry);

    return vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: true,
    });
  }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext
  ): Promise<ErdDocument> {
    const content = await vscode.workspace.fs.readFile(
      openContext.backupId ? vscode.Uri.parse(openContext.backupId) : uri
    );
    const document = ErdDocument.create(uri, content);
    const listener = document.onDidChangeContent(() => {
      this._onDidChangeCustomDocument.fire({ document });
    });

    document.onDidDispose(() => {
      listener.dispose();
      this.registry.unregister(document);
    });

    // Awaited so the lock lists the document before its editor can take
    // edits; register never rejects, so a broken hub never blocks the open.
    await this.registry.register(document);
    return document;
  }

  async resolveCustomEditor(
    document: ErdDocument,
    webviewPanel: vscode.WebviewPanel
  ) {
    const webview = webviewPanel.webview;
    this.registry.addWebview(document, webviewPanel);

    const editor = this.createEditor(
      document,
      webview,
      this.context,
      this.registry.docToWebviewMap,
      this.registry
    );
    const viewState = webviewPanel.onDidChangeViewState(event => {
      if (event.webviewPanel.active) this.registry.setActive(document);
    });
    // Subscribed before bootstrapWebview is awaited, since that reads off disk:
    // a tab closed in flight fires onDidDispose before there is anything to
    // unregister, leaving the webview mapped to a panel that no longer exists.
    let disposed = false;
    webviewPanel.onDidDispose(() => {
      disposed = true;
      viewState.dispose();
      this.registry.removeWebview(document, webviewPanel);
    });

    const editorDisposable = await editor.bootstrapWebview();

    if (disposed) {
      // The panel went away mid-bootstrap; nothing will fire for it again.
      editorDisposable.dispose();
    } else {
      webviewPanel.onDidDispose(() => editorDisposable.dispose());
    }
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
