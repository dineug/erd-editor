import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { getHtmlForWebview, getTheme, getKeymap } from './util';
import { Disposable, disposeAll } from './dispose';
import { trackEvent } from './GoogleAnalytics';

interface ERDEditorDocumentDelegate {
  getFileData(): Promise<string>;
}

class ERDEditorDocument extends Disposable implements vscode.CustomDocument {
  static async create(
    uri: vscode.Uri,
    backupId: string | undefined,
    delegate: ERDEditorDocumentDelegate
  ): Promise<ERDEditorDocument | PromiseLike<ERDEditorDocument>> {
    const dataFile =
      typeof backupId === 'string' ? vscode.Uri.parse(backupId) : uri;
    const buffer = await vscode.workspace.fs.readFile(dataFile);
    const value = Buffer.from(buffer).toString('utf8');
    return new ERDEditorDocument(uri, value, delegate);
  }

  private readonly _uri: vscode.Uri;

  private _documentData: string;

  private readonly _delegate: ERDEditorDocumentDelegate;

  private constructor(
    uri: vscode.Uri,
    initialContent: string,
    delegate: ERDEditorDocumentDelegate
  ) {
    super();
    this._uri = uri;
    this._documentData = initialContent;
    this._delegate = delegate;
  }

  public get uri() {
    return this._uri;
  }

  public get documentData(): string {
    return this._documentData;
  }

  private readonly _onDidDispose = this._register(
    new vscode.EventEmitter<void>()
  );

  public readonly onDidDispose = this._onDidDispose.event;

  private readonly _onDidChangeDocument = this._register(
    new vscode.EventEmitter<{
      readonly content: string;
    }>()
  );

  public readonly onDidChangeContent = this._onDidChangeDocument.event;

  private readonly _onDidChange = this._register(
    new vscode.EventEmitter<void>()
  );

  public readonly onDidChange = this._onDidChange.event;

  dispose(): void {
    this._onDidDispose.fire();
    super.dispose();
  }

  makeEdit() {
    this._onDidChange.fire();
  }

  async save(cancellation: vscode.CancellationToken): Promise<void> {
    await this.saveAs(this.uri, cancellation);
  }

  async saveAs(
    targetResource: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    const value = await this._delegate.getFileData();
    if (cancellation.isCancellationRequested) {
      return;
    }

    await vscode.workspace.fs.writeFile(
      targetResource,
      Buffer.from(JSON.stringify(JSON.parse(value), null, 2), 'utf8')
    );
  }

  async revert(_cancellation: vscode.CancellationToken): Promise<void> {
    const buffer = await vscode.workspace.fs.readFile(this.uri);
    const value = Buffer.from(buffer).toString('utf8');
    this._documentData = value;
    this._onDidChangeDocument.fire({
      content: value,
    });
  }

  async backup(
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    await this.saveAs(destination, cancellation);

    return {
      id: destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(destination);
        } catch {
          // noop
        }
      },
    };
  }
}

export class ERDEditorProvider
  implements vscode.CustomEditorProvider<ERDEditorDocument>
{
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      ERDEditorProvider.viewType,
      new ERDEditorProvider(context) as any,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      } as any
    );
  }

  private static readonly viewType = 'vuerd.editor';

  private readonly webviews = new WebviewCollection();

  constructor(private readonly _context: vscode.ExtensionContext) {}

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: { backupId?: string },
    _token: vscode.CancellationToken
  ): Promise<ERDEditorDocument> {
    trackEvent('vuerd.editor');
    const document: ERDEditorDocument = await ERDEditorDocument.create(
      uri,
      openContext.backupId,
      {
        getFileData: async () => {
          const webviewsForDocument = Array.from(
            this.webviews.get(document.uri)
          );
          if (!webviewsForDocument.length) {
            throw new Error('Could not find webview to save for');
          }
          const panel = webviewsForDocument[0];
          const response = await this.postMessageWithResponse<{
            value: string;
          }>(panel, 'getFileData', {});
          return response.value;
        },
      }
    );

    const listeners: vscode.Disposable[] = [];

    listeners.push(
      document.onDidChange(e => {
        this._onDidChangeCustomDocument.fire({
          document,
        });
      })
    );

    listeners.push(
      document.onDidChangeContent(e => {
        for (const webviewPanel of this.webviews.get(document.uri)) {
          this.postMessage(webviewPanel, 'update', {
            value: e.content,
          });
        }
      })
    );

    document.onDidDispose(() => disposeAll(listeners));

    return document;
  }

  async resolveCustomEditor(
    document: ERDEditorDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.webviews.add(document.uri, webviewPanel);

    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = getHtmlForWebview(
      webviewPanel.webview,
      this._context
    );

    webviewPanel.webview.onDidReceiveMessage(e => this.onMessage(document, e));

    webviewPanel.webview.onDidReceiveMessage(e => {
      if (e.command === 'getValue') {
        this.postMessage(webviewPanel, 'theme', {
          value: getTheme(),
        });
        this.postMessage(webviewPanel, 'keymap', {
          value: getKeymap(),
        });
        this.postMessage(webviewPanel, 'init', {
          value: document.documentData,
        });
      } else if (e.command === 'exportFile') {
        vscode.window
          .showSaveDialog({
            defaultUri: vscode.Uri.file(path.join(os.homedir(), e.fileName)),
          })
          .then(uri => {
            if (uri) {
              vscode.workspace.fs.writeFile(
                uri,
                Buffer.from(e.value.split(',')[1], 'base64')
              );
            }
          });
      }
    });
  }

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentContentChangeEvent<ERDEditorDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  public saveCustomDocument(
    document: ERDEditorDocument,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    return document.save(cancellation);
  }

  public saveCustomDocumentAs(
    document: ERDEditorDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    return document.saveAs(destination, cancellation);
  }

  public revertCustomDocument(
    document: ERDEditorDocument,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    return document.revert(cancellation);
  }

  public backupCustomDocument(
    document: ERDEditorDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken
  ): Thenable<vscode.CustomDocumentBackup> {
    return document.backup(context.destination, cancellation);
  }

  private _requestId = 1;
  private readonly _callbacks = new Map<number, (response: any) => void>();

  private postMessageWithResponse<R = unknown>(
    panel: vscode.WebviewPanel,
    type: string,
    body: any
  ): Promise<R> {
    const requestId = this._requestId++;
    const p = new Promise<R>(resolve =>
      this._callbacks.set(requestId, resolve)
    );
    panel.webview.postMessage({ type, requestId, body });
    return p;
  }

  private postMessage(
    panel: vscode.WebviewPanel,
    type: string,
    body: any
  ): void {
    panel.webview.postMessage({ type, body });
  }

  private onMessage(document: ERDEditorDocument, message: any) {
    switch (message.type) {
      case 'value':
        document.makeEdit();
        return;

      case 'response': {
        const callback = this._callbacks.get(message.requestId);
        callback?.(message.body);
        return;
      }
    }
  }
}

class WebviewCollection {
  private readonly _webviews = new Set<{
    readonly resource: string;
    readonly webviewPanel: vscode.WebviewPanel;
  }>();

  public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
    const key = uri.toString();
    for (const entry of this._webviews) {
      if (entry.resource === key) {
        yield entry.webviewPanel;
      }
    }
  }

  public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
    const entry = { resource: uri.toString(), webviewPanel };
    this._webviews.add(entry);

    webviewPanel.onDidDispose(() => {
      this._webviews.delete(entry);
    });
  }
}
