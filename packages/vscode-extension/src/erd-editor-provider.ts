import * as vscode from 'vscode';

import { VIEW_TYPE } from '@/constants/viewType';
import { CreateEditor } from '@/editor';
import { ErdDocument } from '@/erd-document';

export class ErdEditorProvider implements vscode.CustomEditorProvider<ErdDocument> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentContentChangeEvent<ErdDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  private docToWebviewMap = new Map<ErdDocument, Set<vscode.Webview>>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly createEditor: CreateEditor
  ) {}

  static register(
    context: vscode.ExtensionContext,
    createEditor: CreateEditor
  ): vscode.Disposable {
    const provider = new ErdEditorProvider(context, createEditor);

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

    if (!this.docToWebviewMap.has(document)) {
      this.docToWebviewMap.set(document, new Set());
    }

    document.onDidDispose(() => {
      listener.dispose();
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
    // Subscribed before `bootstrapWebview` is awaited: it reads `index.html` off
    // disk, so a tab closed while it is still in flight fires `onDidDispose`
    // before there is anything to unregister, and the webview would be left in
    // `docToWebviewMap` for a panel that no longer exists.
    let disposed = false;
    webviewPanel.onDidDispose(() => {
      disposed = true;
      webviewSet?.delete(webview);
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
