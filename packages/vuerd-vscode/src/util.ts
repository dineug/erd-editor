import * as path from 'path';
import { ExtensionContext, Uri, Webview, workspace } from 'vscode';

export function getNonce() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function getHtmlForWebview(
  webview: Webview,
  context: ExtensionContext
): string {
  const vuerdUri = webview.asWebviewUri(
    Uri.file(path.join(context.extensionPath, 'static', 'vuerd.min.js'))
  );
  const pluginGenerateTemplateUri = webview.asWebviewUri(
    Uri.file(
      path.join(context.extensionPath, 'static', 'generate-template.min.js')
    )
  );
  const mainUri = webview.asWebviewUri(
    Uri.file(path.join(context.extensionPath, 'static', 'main.js'))
  );
  const lazyLoadUri = webview.asWebviewUri(
    Uri.file(path.join(context.extensionPath, 'static', 'lazy-load.js'))
  );
  const nonce = getNonce();
  const cspSource = webview.cspSource;

  return /* html */ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy"
      content="default-src * ${cspSource} https: 'unsafe-inline' 'unsafe-eval';
        script-src ${cspSource} blob: data: https: 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}';
        style-src ${cspSource} https: 'unsafe-inline';
        img-src ${cspSource} data: https:;
        connect-src ${cspSource} blob: data: https: http:;">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>vuerd</title>
    </head>
    <body>
      <script nonce="${nonce}" src=${vuerdUri}></script>
      <script nonce="${nonce}" src=${mainUri}></script>
      <script nonce="${nonce}" src=${pluginGenerateTemplateUri} defer></script>
      <script nonce="${nonce}" src=${lazyLoadUri} defer></script>
    </body>
    </html>`;
}

export function getTheme() {
  const config = workspace.getConfiguration('dineug.vuerd-vscode');
  const themeSync = config.get('themeSync');
  return {
    theme: Object.assign({}, config.get('theme')),
    themeSync: !!themeSync,
  };
}

export function getKeymap() {
  const config = workspace.getConfiguration('dineug.vuerd-vscode');
  return {
    keymap: Object.assign({}, config.get('keymap')),
  };
}
