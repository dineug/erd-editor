import * as path from "path";
import {
  ExtensionContext,
  Uri,
  commands,
  window,
  WebviewPanel,
  workspace,
  TextDocument,
} from "vscode";
import { trackEvent } from "./GoogleAnalytics";
import { webviewManager } from "./WebviewManager";
import { ERDEditorProvider } from "./ERDEditorProvider";

export function activate(context: ExtensionContext) {
  context.subscriptions.push(ERDEditorProvider.register(context));

  context.subscriptions.push(
    commands.registerCommand("vuerd.webview", (uri: any) => {
      if (uri instanceof Uri) {
        trackEvent("vuerd.webview");
        return webviewManager.add(context, uri);
      } else {
        window.showInformationMessage("Open a vuerd.json file first to show");
        return;
      }
    })
  );

  if (window.registerWebviewPanelSerializer) {
    window.registerWebviewPanelSerializer("vuerd.webview", {
      async deserializeWebviewPanel(webviewPanel: WebviewPanel, state: any) {
        const uri = state.uri as Uri;
        webviewManager.revive(context, uri, webviewPanel);
        trackEvent("vuerd.webview");
      },
    });
  }

  // Automatically preview content piped from stdin (when VSCode is already open)
  workspace.onDidOpenTextDocument((document) => {
    if (isVuerdFile(document)) {
      commands.executeCommand("vuerd.webview", document.uri);
    }
  });

  // Automaticlly preview content piped from stdin (when VSCode first starts up)
  if (window.activeTextEditor) {
    const document = window.activeTextEditor.document;
    if (isVuerdFile(document)) {
      commands.executeCommand("vuerd.webview", document.uri);
    }
  }
}

export function deactivate() {}

function isVuerdFile(document: TextDocument) {
  return document && path.basename(document.fileName).match(/\.(vuerd.json)$/i);
}
