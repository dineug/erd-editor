import * as path from "path";
import * as os from "os";
import {
  Disposable,
  WebviewPanel,
  Uri,
  ExtensionContext,
  window,
  ViewColumn,
  workspace,
} from "vscode";
import { getHtmlForWebview, getTheme, getKeymap } from "./util";
import WebviewManager from "./WebviewManager";

const viewType = "vuerd.webview";

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
            Uri.file(path.join(context.extensionPath, "static")),
          ],
        }
      );
    }

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.html = getHtmlForWebview(this.panel.webview, context);
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "value":
            await workspace.fs.writeFile(
              this.uri,
              Buffer.from(
                JSON.stringify(JSON.parse(message.value), null, 2),
                "utf8"
              )
            );
            return;
          case "getValue":
            try {
              const buffer = await workspace.fs.readFile(this.uri);
              const value = Buffer.from(buffer).toString("utf8");
              this.panel.webview.postMessage({
                command: "state",
                uri: this.uri,
              });
              this.panel.webview.postMessage({
                command: "theme",
                value: getTheme(),
              });
              this.panel.webview.postMessage({
                command: "keymap",
                value: getKeymap(),
              });
              this.panel.webview.postMessage({
                command: "value",
                value,
              });
            } catch (err) {
              window.showErrorMessage(err.message);
            }
            return;
          case "exportFile":
            window
              .showSaveDialog({
                defaultUri: Uri.file(path.join(os.homedir(), message.fileName)),
              })
              .then((uri) => {
                if (uri) {
                  workspace.fs.writeFile(
                    uri,
                    Buffer.from(message.value.split(",")[1], "base64")
                  );
                }
              });
            break;
        }
      },
      null,
      this.disposables
    );
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
