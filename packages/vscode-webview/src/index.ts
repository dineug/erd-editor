import './webview.css';
import 'core-js/stable';

import { Appearance } from '@dineug/erd-editor-webview-bridge';
import { mountWebview } from '@dineug/erd-editor-webview-client';

const vscode = acquireVsCodeApi();
const loading = document.querySelector('#loading');

/** VSCode writes its theme kind onto the body; auto follows it, light only where it says so. */
function getSystemTheme(): Appearance {
  const themeKind = document.body.dataset.vscodeThemeKind;

  return themeKind
    ? themeKind === 'vscode-light'
      ? Appearance.light
      : Appearance.dark
    : document.body.classList.contains('vscode-light')
      ? Appearance.light
      : Appearance.dark;
}

const client = mountWebview({
  dispatch: action => vscode.postMessage(action),
  workerName: '@dineug/erd-editor-vscode-webview/replication-store-worker',
  resolveAppearance: getSystemTheme,
  importFile: true,
  onMounted: () => loading?.remove(),
});

const observer = new MutationObserver(() => client.refreshAppearance());
observer.observe(document.body, {
  attributes: true,
  attributeFilter: ['class', 'data-vscode-theme-kind'],
});
