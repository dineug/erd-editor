import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('catCoding.start', () => {
      const extensionUri = context.extensionUri;

      const column = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;

      // Otherwise, create a new panel.
      const panel = vscode.window.createWebviewPanel(
        'catCoding',
        'Cat Coding',
        column || vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'public')],
        }
      );

      _getHtmlForWebview(extensionUri, panel.webview).then(html => {
        panel.webview.html = html;
      });
    })
  );
}

async function _getHtmlForWebview(
  extensionUri: vscode.Uri,
  webview: vscode.Webview
) {
  const textDecoder = new TextDecoder();
  const publicUri = vscode.Uri.joinPath(extensionUri, 'public');
  const content = await vscode.workspace.fs.readFile(
    vscode.Uri.joinPath(publicUri, 'index.html')
  );
  const nonce = getNonce();
  const cspSource = webview.cspSource;
  const scriptUri = webview
    .asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'public', 'webview.iife.js')
    )
    .toString();

  let html = textDecoder.decode(content);

  html = html.replace('{{nonce}}', nonce);
  html = html.replace('{{cspSource}}', cspSource);
  html = html.replace('{{webview}}', scriptUri);

  return html;
}

function getNonce() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
