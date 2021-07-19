import * as os from 'os';
import * as path from 'path';
import {
  Disposable,
  ExtensionContext,
  RelativePattern,
  Uri,
  ViewColumn,
  Webview,
  WebviewPanel,
  window,
  workspace,
} from 'vscode';

import { loadLiquibaseFiles } from './importLiquibase';
import { getHtmlForWebview, getKeymap, getTheme } from './util';
import WebviewManager from './WebviewManager';

const viewType = 'vuerd.webview';

export default class WebviewERD {
  private disposables: Disposable[] = [];
  private webviewManager: WebviewManager;

  public panel: WebviewPanel;
  public uri: Uri;

  constructor(
    context: ExtensionContext,
    uri: Uri,
    webviewManager: WebviewManager,
    webviewPanel?: WebviewPanel
  ) {
    this.uri = uri;
    this.webviewManager = webviewManager;

    if (webviewPanel) {
      this.panel = webviewPanel;
    } else {
      const column = window.activeTextEditor
        ? window.activeTextEditor.viewColumn
        : undefined;
      this.panel = window.createWebviewPanel(
        viewType,
        path.basename(uri.fsPath),
        column || ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [
            Uri.file(path.join(context.extensionPath, 'static')),
          ],
        }
      );
    }
    const folder = workspace.workspaceFolders?.[0];

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.html = getHtmlForWebview(this.panel.webview, context);
    this.panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'value':
            await workspace.fs.writeFile(
              this.uri,
              Buffer.from(
                JSON.stringify(JSON.parse(message.value), null, 2),
                'utf8'
              )
            );
            return;
          case 'getValue':
            try {
              const buffer = await workspace.fs.readFile(this.uri);
              const value = Buffer.from(buffer).toString('utf8');
              this.panel.webview.postMessage({
                command: 'state',
                uri: this.uri,
              });
              this.panel.webview.postMessage({
                command: 'theme',
                value: getTheme(),
              });
              this.panel.webview.postMessage({
                command: 'keymap',
                value: getKeymap(),
              });
              this.panel.webview.postMessage({
                command: 'value',
                value,
              });
            } catch (err) {
              window.showErrorMessage(err.message);
            }
            return;
          case 'exportFile':
            window
              .showSaveDialog({
                defaultUri: Uri.file(path.join(os.homedir(), message.fileName)),
              })
              .then(uri => {
                if (uri) {
                  workspace.fs.writeFile(
                    uri,
                    Buffer.from(message.value.split(',')[1], 'base64')
                  );
                }
              });
            break;
          case 'loadLiquibase':
            if (folder)
              workspace
                .findFiles(new RelativePattern(folder, '*.vuerd.json'), null, 1)
                .then(uris =>
                  loadLiquibase(this.panel.webview, uris[0].fsPath)
                );
            break;
        }
      },
      null,
      this.disposables
    );

    if (folder) {
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(folder, 'changelog/*.xml')
      );

      watcher.onDidChange(uri =>
        loadLiquibase(this.panel.webview, path.dirname(uri.fsPath))
      );
      watcher.onDidCreate(uri =>
        loadLiquibase(this.panel.webview, path.dirname(uri.fsPath))
      );
      watcher.onDidDelete(uri =>
        loadLiquibase(this.panel.webview, path.dirname(uri.fsPath))
      );
    }
  }

  public dispose() {
    this.webviewManager.remove(this);
    this.panel.dispose();
    while (this.disposables.length) {
      const item = this.disposables.pop();
      if (item) {
        item.dispose();
      }
    }
  }
}

const loadLiquibase = (webview: Webview, uri: string) => {
  webview.postMessage({
    command: 'loadLiquibase',
    value: loadLiquibaseFiles(uri),
  });
};
