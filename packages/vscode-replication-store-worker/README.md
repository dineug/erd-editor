# vscode-replication-store-worker

> Headless replica of the editor document, running off the main thread

`@dineug/erd-editor-vscode-replication-store-worker` keeps a second copy of the open document inside
a Web Worker, so the VS Code host can persist `.erd.json` files without serializing on the UI thread.
The webview stays free to render; the worker does the replaying and the stringifying.

Internal to the erd-editor monorepo and never published to npm — depend on it as
`"@dineug/erd-editor-vscode-replication-store-worker": "workspace:*"`.
`@dineug/erd-editor-vscode-webview` is the only consumer; `intellij-webview` keeps its own copy of
the worker, spawned from a URL instead of inlined.

## Data flow

The webview forwards the editor's raw action stream into the worker, which replays it into a store
built by `createReplicationStore` from `@dineug/erd-editor/engine.js`. Only when that store reports a
`change` does the worker post the serialized document back out.

Traffic in both directions is plain `postMessage` carrying `@dineug/erd-editor-vscode-bridge`
commands — inbound `webviewInitialValueCommand` and `webviewReplicationCommand`, outbound
`hostSaveValueCommand`.

## Usage

`ReplicationStoreWorker`, a worker constructor, is the single export.

```ts
import { Bridge, hostSaveValueCommand } from '@dineug/erd-editor-vscode-bridge';
import { ReplicationStoreWorker } from '@dineug/erd-editor-vscode-replication-store-worker';

const worker = new ReplicationStoreWorker({ name: 'replication-store-worker' });
const bridge = new Bridge();

bridge.registerCommand(hostSaveValueCommand, ({ value }) => {
  // `value` is the serialized document — hand it to the host to write to disk
});

worker.addEventListener('message', event => bridge.executeAction(event.data));
```

`src/index.ts` imports the worker through Vite's `?worker&inline` suffix, so the whole worker body —
engine, bridge and all — is baked into `dist/index.js` as a string and started from a Blob URL. There
is no separate worker file to ship, and no module resolution at runtime.

## Development

No test task; verify with a build.

```sh
pnpm exec vp run --filter @dineug/erd-editor-vscode-replication-store-worker --fail-if-no-match build
```
