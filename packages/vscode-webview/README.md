# vscode-webview

> Webview bundle for the Entity-Relationship Diagram Editor [VS Code extension](https://marketplace.visualstudio.com/items?itemName=dineug.vuerd-vscode)

![erd-editor](https://github.com/dineug/erd-editor/blob/main/img/erd-editor-vscode.png?raw=true)

Internal to the erd-editor monorepo. It is not published to npm; the extension
package depends on it as `"@dineug/erd-editor-vscode-webview": "workspace:*"`.

This package builds the bundle that runs inside the extension's webview iframe.
It is a build artifact, not something to install: the output is written to
`packages/vscode-extension/public` and shipped inside the VSIX. To actually edit
diagrams in VS Code, install [`vuerd-vscode`](../vscode-extension) from the
Marketplace, then create an empty file with a `.erd.json` extension and open it.

Editor usage is documented in the [Guides](https://docs.erd-editor.io/docs/category/guides).

## How it talks to the host

`src/index.ts` creates the `<erd-editor>` element and wires two `Bridge`
instances from `@dineug/erd-editor-vscode-bridge`, the typed command protocol it
shares with the extension host:

- **host ↔ webview**, over `acquireVsCodeApi()` `postMessage` — initial value,
  theme, readonly, file import/export, and replication actions.
- **webview ↔ worker**, over a `ReplicationStoreWorker` from
  `@dineug/erd-editor-vscode-replication-store-worker`, which keeps a headless
  replica of the document.

`editor.getSharedStore({ mouseTracker: false, focusTracker: false })` is subscribed once the host
sends the initial value; every batch of actions is forwarded to both the worker
and the host. File dialogs belong to the host — `setImportFileCallback` and
`setExportFileCallback` dispatch host commands, and export blobs are
base64-encoded so everything crossing `postMessage` stays JSON-safe.

## Build

```sh
pnpm exec vp run --filter @dineug/erd-editor-vscode-webview --fail-if-no-match build
```

Types only:

```sh
pnpm --filter @dineug/erd-editor-vscode-webview typecheck
```

There is no local `dist/`; `build` writes into `packages/vscode-extension/public`.
