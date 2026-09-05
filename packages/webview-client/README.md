# @dineug/erd-editor-webview-client

> The editor mounted into an IDE webview, with the host protocol already wired

Both IDE bundles, `vscode-webview` and `intellij-webview`, used to carry the same hundred
lines: create the element, register every `@dineug/erd-editor-webview-bridge` command, spawn
the replica worker, hand file exports to the host and load the highlighter lazily. That is
`mountWebview` now, and each bundle keeps only what differs about its host.

## Usage

```ts
import { mountWebview } from '@dineug/erd-editor-webview-client';

const client = mountWebview({
  dispatch: action => sendToHost(action),
  workerName: 'my-host/replication-store-worker',
  resolveAppearance: () => readSystemTheme(), // what 'auto' means here; omit for dark
  importFile: true, // hand file dialogs to the host; omit to keep the editor's own input
  onMounted: () => placeholder.remove(),
});

// when the host's system theme changes
client.refreshAppearance();
```

The editor joins the document when the host answers `hostInitialCommand` with
`webviewInitialValueCommand`; until then nothing is rendered. `dispose()` drops the listeners
and the worker.
