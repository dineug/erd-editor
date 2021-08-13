import * as os from 'os';
import * as path from 'path';
import {
  Disposable,
  ExtensionContext,
  ProgressLocation,
  RelativePattern,
  Uri,
  ViewColumn,
  Webview,
  WebviewPanel,
  window,
  workspace,
} from 'vscode';

import { LiquibaseFile, loadLiquibaseFiles } from './importLiquibase';
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
    const folder = Uri.parse(path.dirname(this.uri.path));

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
            if (message.options.saveDirectly && folder) {
              let uri = Uri.joinPath(folder, message.options.fileName);
              let content = Buffer.from(message.value.split(',')[1], 'base64');

              workspace.fs.writeFile(uri, content);
            } else {
              window
                .showSaveDialog({
                  defaultUri: Uri.file(
                    path.join(os.homedir(), message.options.fileName)
                  ),
                })
                .then(uri => {
                  if (uri) {
                    workspace.fs.writeFile(
                      uri,
                      Buffer.from(message.value.split(',')[1], 'base64')
                    );
                  }
                });
            }
            break;
          case 'loadLiquibase':
            this.loadLiquibase(this.panel.webview, folder.fsPath);
            break;
        }
      },
      null,
      this.disposables
    );

    if (folder) {
      const watcher = workspace.createFileSystemWatcher(
        new RelativePattern(folder, 'changelog.xml')
      );

      watcher.onDidChange(uri =>
        this.loadLiquibase(this.panel.webview, path.dirname(uri.fsPath))
      );
      watcher.onDidCreate(uri =>
        this.loadLiquibase(this.panel.webview, path.dirname(uri.fsPath))
      );
      watcher.onDidDelete(uri =>
        this.loadLiquibase(this.panel.webview, path.dirname(uri.fsPath))
      );

      this.disposables.push(watcher);
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

  loadLiquibase = (webview: Webview, uri: string) => {
    const liquibaseFiles: LiquibaseFile[] = loadLiquibaseFiles(uri);

    const increment = 100 / liquibaseFiles.length;
    var currentFile = 0;

    // progress bar
    window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: 'Importing Liquibase changelogs',
        cancellable: true,
      },
      (progress, token) => {
        const returnPromise = new Promise<void>(resolve => {
          // listen to event `progress` and increment bar
          const listener = this.panel.webview.onDidReceiveMessage(message => {
            if (
              message.command === 'progress' &&
              currentFile < liquibaseFiles.length
            ) {
              currentFile++;
              progress.report({
                increment: increment,
                message: `[${currentFile}/${liquibaseFiles.length}] ${message.message}`,
              });
            } else if (message.command === 'progressEnd') {
              console.log('Done loading files');
              listener.dispose();
              progress.report({
                increment: 0,
                message: 'Done loading files...',
              });
              setTimeout(() => {
                resolve();
              }, 5000);
            }
          });

          token.onCancellationRequested(() => {
            listener.dispose();
          });
        });

        progress.report({
          increment: currentFile,
          message: `Please open Vuerd to import Liquibase changes.`,
        });

        return returnPromise;
      }
    );

    webview.postMessage({
      command: 'loadLiquibase',
      value: { files: liquibaseFiles, type: 'vscode' },
    });
  };
}
