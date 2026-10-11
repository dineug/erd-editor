# replication-store-worker

> Headless replica of the open document, running off the main thread

`createReplicationStoreWorker()` starts a module `Worker` that keeps a second copy of the open
document: it replays the editor's edits, and those the host relays from other views and agents, and,
200 ms after the last change, posts the document back serialized. The VS Code and IntelliJ hosts and
the Obsidian plugin save `.erd`, `.erd.json`, `.vuerd` and `.vuerd.json` files from what it posts,
so a save does not serialize the document on the thread that renders the editor. Two packages spawn
it: [`webview-client`](../webview-client), whose `mountWebview` runs one per editor webview in both
IDE bundles ([`vscode-webview`](../vscode-webview) and [`intellij-webview`](../intellij-webview)),
and [`obsidian-plugin`](../obsidian-plugin), whose `ErdView` starts one each time a tab loads a
diagram it can read. The package is private and never published to npm: `webview-client` lists it in
`dependencies` and `obsidian-plugin` in `devDependencies`, as
`"@dineug/erd-editor-replication-store-worker": "workspace:*"`.

## Usage

```ts
import type { ErdEditorElement } from '@dineug/erd-editor';
import { createReplicationStoreWorker } from '@dineug/erd-editor-replication-store-worker';
import {
  Bridge,
  hostSaveValueCommand,
  webviewInitialValueCommand,
  webviewReplicationCommand,
} from '@dineug/erd-editor-webview-bridge';

// What your host provides
declare const editor: ErdEditorElement;
declare const initialValue: string; // the file's text, or a runtimeValue kept for this document
declare function writeFile(value: string): void;
declare function keepRuntimeValue(runtimeValue: string): void;

const sharedStore = editor.getSharedStore({ mouseTracker: false, focusTracker: false });
const worker = createReplicationStoreWorker({ name: 'my-host/replication-store-worker' });
const workerBridge = new Bridge();

workerBridge.registerCommand(hostSaveValueCommand, ({ value, changed, runtimeValue }) => {
  if (changed) writeFile(value);
  keepRuntimeValue(runtimeValue); // seeds a second view or a joining agent; never written
});
worker.addEventListener('message', event => workerBridge.executeAction(event.data));

worker.postMessage(Bridge.executeCommand(webviewInitialValueCommand, { value: initialValue }));
editor.setInitialValue(initialValue);
sharedStore.subscribe(actions => {
  worker.postMessage(Bridge.executeCommand(webviewReplicationCommand, { actions }));
});
```

`createReplicationStoreWorker(options?)` is the only export. `options.name` names the worker, and
each host passes its own (`mountWebview` takes it from `WebviewHost.workerName`). The initial
value alone makes the worker post nothing; its first `hostSaveValueCommand` follows the first
batch with a change action in it (Data flow). A batch the host relays from another view or an
agent goes into the editor with `sharedStore.dispatch(actions)` and to the worker as the same
`webviewReplicationCommand`. The two callers in this repository are
[`mountWebview.ts`](../webview-client/src/mountWebview.ts) and Obsidian's
[`ErdView.ts`](../obsidian-plugin/src/ErdView.ts).

The build writes `dist/index.js` and, beside it, `dist/workers/replicationStore.worker.js`.
`dist/index.js` spawns the worker from `new URL('./workers/replicationStore.worker.js',
import.meta.url)`, which the host's bundler builds as an entry of its own, and the worker file
imports `@dineug/erd-editor/engine.js` and the bridge for that bundler to bundle. Each host loads
the result its own way: the VS Code webview reads it at startup into a same-origin blob, the
IntelliJ webview loads it from its URL, and `obsidian-plugin`, which ships one `main.js`, inlines
it.

## Data flow

The host side, `mountWebview` in an IDE webview or `ErdView` in Obsidian, talks to the worker with
plain `postMessage` calls carrying `@dineug/erd-editor-webview-bridge` commands:

| Command | Payload | Sent |
| --- | --- | --- |
| `webviewInitialValueCommand` | `{ value }` | To the worker, once per load |
| `webviewReplicationCommand` | `{ actions }` | To the worker, for each batch emitted or relayed |
| `hostSaveValueCommand` | `{ value, changed, runtimeValue }` | From the worker, on each `change` |

The initial value is the file's text until a replica of that document has posted; from then on the
host seeds each new view from the `runtimeValue` it kept. The worker replays every batch, those the
editor's shared store emits and those the host relays, into a store built by
`createReplicationStore` from `@dineug/erd-editor/engine.js`. That store reports a `change` 200 ms
after the last change action it applies, so a burst of batches makes one post, and a batch holding
only the registers a window answers a join with (`editor.mergeLWW`) makes none. On each `change` the
worker posts the document in both forms.

`value` is the document in the form a file holds, which the host saves. `changed` is false when
the change left `value` as it was, such as a scroll the file does not keep, and no host saves the
value then. `runtimeValue` is the document as the replica holds it, removed entities included: the
host keeps it to seed a second view or a joining agent, and never writes it.

## Development

From the repository root:

```sh
pnpm exec vp run --filter ./packages/replication-store-worker --fail-if-no-match build
```

The package has no `test` task and no scripts. The `build` task builds its workspace dependencies,
then runs `tsc --noEmit` and `vp build`, which check types and bundling only: no spec in
`pnpm test` runs the worker. These do:

- `pnpm --filter vuerd-vscode --fail-if-no-match e2e`, in a real VS Code webview (`xvfb-run -a`
  on Linux).
- `pnpm --filter @dineug/erd-editor-intellij-plugin --fail-if-no-match smoke`, on macOS after
  `./gradlew buildWebview`, and
  `pnpm --filter @dineug/erd-editor-obsidian-plugin --fail-if-no-match smoke`, on macOS or
  Windows with Obsidian installed. Both start the built MCP server, so build
  `@dineug/erd-editor-mcp` first.
- Opening a diagram in an IDE, editing it (and saving, in VS Code) and checking that the file on
  disk changes.

The rules for changing the package, and the checks a change runs, are in [AGENTS.md](./AGENTS.md).
