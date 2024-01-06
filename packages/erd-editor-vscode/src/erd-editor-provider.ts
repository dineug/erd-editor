// @ts-ignore
import { createReplicationStore } from '@dineug/erd-editor/engine.js';
import * as vscode from 'vscode';

import { MODERN_VIEW_TYPE } from '@/constants/viewType';
import { CreateEditor } from '@/editor';
import { ErdDocument } from '@/erd-document';
import { textDecoder, textEncoder } from '@/utils';
import { trackEvent } from '@/utils/googleAnalytics';
import { createFont, toWidth } from '@/utils/text';

export class ErdEditorProvider
  implements vscode.CustomEditorProvider<ErdDocument>
{
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentContentChangeEvent<ErdDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  private docToTupleMap = new Map<ErdDocument, [Set<vscode.Webview>, any]>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly viewType: string,
    private readonly createEditor: CreateEditor
  ) {}

  static register(
    context: vscode.ExtensionContext,
    viewType: string,
    createEditor: CreateEditor
  ): vscode.Disposable {
    const provider = new ErdEditorProvider(context, viewType, createEditor);

    return vscode.window.registerCustomEditorProvider(viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: viewType === MODERN_VIEW_TYPE,
    });
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

    await createFont(this.context);

    if (
      this.viewType === MODERN_VIEW_TYPE &&
      !this.docToTupleMap.has(document)
    ) {
      const store = createReplicationStore({ toWidth });
      this.docToTupleMap.set(document, [new Set(), store]);
      store.setInitialValue(textDecoder.decode(document.content));
      unsubscribe = store.on({
        change: () => {
          const value = store.value;
          document.update(textEncoder.encode(value));
        },
      });
    }

    document.onDidDispose(() => {
      listener.dispose();
      unsubscribe();
      this.docToTupleMap.delete(document);
    });

    return document;
  }

  async resolveCustomEditor(
    document: ErdDocument,
    webviewPanel: vscode.WebviewPanel
  ) {
    const [webviewSet] = this.docToTupleMap.get(document) ?? [];
    const webview = webviewPanel.webview;
    webviewSet?.add(webview);

    const editor = this.createEditor(
      document,
      webviewPanel.webview,
      this.context,
      this.docToTupleMap
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
