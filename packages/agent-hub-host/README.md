# agent-hub-host

> The editor window's side of the document hub, on Node

`@dineug/erd-editor-agent-hub-host` serves, from inside an editor window, the hub coding agents
join, which [`agent-hub`](../agent-hub) specifies. It listens on the pipe and writes the lock file
that advertises it, sweeps the locks dead windows left behind, answers `hello`, authorizes every
path against the window's folders and open documents, and frames the traffic. It listens, stops
and rewrites the lock as the host's setting and folders change. It is private and depended on as
`"@dineug/erd-editor-agent-hub-host": "workspace:*"`: [`vuerd-vscode`](../vscode-extension) and
[`obsidian-plugin`](../obsidian-plugin) list it in `devDependencies`, with
`@dineug/erd-editor-agent-hub`, `effect` and `@effect/platform-node`, and inline them into their
bundles; its own Node (`node22`) build keeps the three bare, `agent-hub` in `dependencies` and the
effect packages as peers. [`intellij-plugin`](../intellij-plugin) serves the same hub from Kotlin
with no build edge to this package; both are held to
[`src/__fixtures__/conformance.json`](./src/__fixtures__/conformance.json).

## Usage

The package owns everything a connection meets before a document is involved. A host keeps its
documents and hands them in as three effect services from
[`src/services/HubHost.ts`](./src/services/HubHost.ts):

| Service | What the host provides |
| --- | --- |
| `HubHost` | `ide` (the name the lock and the hub's `hello` answer carry, such as `vscode` or `obsidian`), `isEnabled()`, `folders()`, and `onEnabledChange` / `onFoldersChange`, each returning an `Unsubscribe` |
| `HubDocuments` | `setPublisher(publish)`: publish the open documents at once, then again on every change; the lock lists them |
| `HubHandlerService` | A `HubHandler`: one Effect per request after `hello` (`listDocuments`, `openDocument`, `join`, `applyActions`, `leave`, `save`), each path already authorized and resolved to its real path, plus `disconnect(connection)`, a plain function the hub calls once an admitted peer's connection ends |

The host builds one runtime with `withDocumentHub`: its documents first, which cannot fail, then
the hub on them.

```ts
import {
  type DocumentPublisher,
  documentHubLayer,
  HubDocuments,
  type HubHandler,
  HubHandlerService,
  HubHost,
  nativeFileSystemLayer,
  nodeHubServices,
  type Unsubscribe,
  warnUnsafe,
  withDocumentHub,
} from '@dineug/erd-editor-agent-hub-host';
import { Effect, Layer, ManagedRuntime } from 'effect';

// The host's own pieces.
declare const version: string;
declare const settings: { agentHub: boolean; onChange(listener: () => void): Unsubscribe };
declare const workspace: { roots: string[]; onRootsChange(listener: () => void): Unsubscribe };
declare const registry: { setPublisher(publish: DocumentPublisher): void };
declare const handler: HubHandler;

const documents = Layer.mergeAll(
  Layer.succeed(HubHost, {
    ide: 'my-editor',
    isEnabled: () => settings.agentHub,
    folders: () => workspace.roots,
    onEnabledChange: listener => settings.onChange(listener),
    onFoldersChange: listener => workspace.onRootsChange(listener),
  }),
  Layer.succeed(HubDocuments, {
    setPublisher: publish => registry.setPublisher(publish),
  }),
  Layer.succeed(HubHandlerService, handler)
);

const runtime = ManagedRuntime.make(
  withDocumentHub(
    documents,
    documentHubLayer.pipe(
      Layer.provide(Layer.mergeAll(nodeHubServices(version), nativeFileSystemLayer))
    )
  )
);

// Builds the hub; the exit fails only when a dispose interrupted the build.
await runtime.runPromiseExit(Effect.void);

// On shutdown: deletes the lock, then closes the pipe. Bounded, since a stalled task
// holds the close.
await Effect.runPromise(
  runtime.disposeEffect.pipe(
    Effect.timeout('5 seconds'),
    Effect.catchCause(cause =>
      Effect.sync(() => warnUnsafe('could not close the document hub', cause))
    )
  )
);
```

The hub never throws at the editor: one that fails to build logs
`could not start the document hub` under `[erd-editor hub]` and leaves the documents serving every
editor.

A host that can go down without awaiting the dispose calls the `DocumentHub`'s `releaseSync()`,
which deletes the lock and socket files before it returns. The runtime above types only the
documents' services, and a hub that failed leaves no `DocumentHub`, so such a host captures it
with `Layer.tap` on `documentHubLayer` (`hub = Context.get(context, DocumentHub)`) and calls
`hub?.releaseSync()`, as `obsidian-plugin` does on the workspace's `quit` and the window's
`pagehide`.

The two real compositions are `vuerd-vscode`'s
[`src/hub/index.ts`](../vscode-extension/src/hub/index.ts) (the layers) with
[`src/extension.ts`](../vscode-extension/src/extension.ts) (the runtime and its dispose), and
`obsidian-plugin`'s [`src/hub/runtime.ts`](../obsidian-plugin/src/hub/runtime.ts) with
[`src/main.ts`](../obsidian-plugin/src/main.ts) (the machine layer and `releaseSync`).

[`src/index.ts`](./src/index.ts) also exports the parts the hub is built from, such as
`serveConnection`, `authorizePath`, `LockFile` and each module's renamed `layer`.

## Rules every host shares

Two modules hold rules each host applies itself, so agents meet the same behaviour in every
editor:

- [`documentRules.ts`](./src/documentRules.ts): which files the hub serves (`ERD_FILE_EXTENSIONS`:
  `erd`, `vuerd`, `erd.json`, `vuerd.json`), the refusal texts every host answers alike, and the
  open and save timeouts (`OPEN_READY_TIMEOUT_MS`, `SAVE_QUIET_CAP_MS`).
  `serveConnection` does not check the extension: each host's `openDocument`, `join`,
  `applyActions` and `save` call `assertErdFile` themselves.
- [`joinWindow.ts`](./src/joinWindow.ts): when a document is quiet (every view a change reached
  has saved its replica or closed, and at least one save came), which a join awaits for up to
  `JOIN_QUIET_CAP_MS` and a save for up to `SAVE_QUIET_CAP_MS` (`waitForQuiet`), and how a joining
  peer's snapshot lines up with the actions queued while it was taken (`filterJoinQueue`,
  `drainJoinQueue`).

## Development

From the repository root:

```sh
pnpm exec vp run --filter ./packages/agent-hub-host --fail-if-no-match test
pnpm --filter ./packages/agent-hub-host --fail-if-no-match test:coverage
pnpm --filter ./packages/agent-hub-host --fail-if-no-match test:dev
pnpm exec vp run --filter ./packages/agent-hub-host --fail-if-no-match build
```

`test` and `build` build `agent-hub` first; `test` then runs `tsc --noEmit` and Vitest in a Node
environment, and `build` writes `dist/` with the `.d.ts` files the two hosts type-check against.
`test:coverage` (v8) and `test:dev` (watch mode) run Vitest alone, so run a task first on a fresh
clone: `agent-hub` resolves only to its `dist/`. The rules for changing the package, and the
checks a change runs, are in [AGENTS.md](./AGENTS.md).
