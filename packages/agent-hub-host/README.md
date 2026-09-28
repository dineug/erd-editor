# agent-hub-host

> The editor window's side of the coding-agent hub, on Node

`@dineug/erd-editor-agent-hub-host` serves the hub that `@dineug/erd-editor-agent-hub` specifies,
from inside an editor window. It listens on the pipe and writes the lock file that advertises it,
sweeps the locks dead windows left behind, answers `hello`, and authorizes every path against the
window's folders and open documents. It also frames the traffic, and it listens, stops and
rewrites the lock as the host's setting and folders change. The VS Code extension and the Obsidian
plugin both build on it. The IntelliJ plugin serves the same hub from Kotlin, held to this package
by `src/__fixtures__/conformance.json`.

Internal to the erd-editor monorepo and never published to npm. It is built for Node (`node22`),
with `effect` and `@effect/platform-node` as peers. `vuerd-vscode` and `obsidian-plugin` list it,
`agent-hub`, `effect` and `@effect/platform-node` as devDependencies and inline one copy of each.

## What a host provides

This package owns everything a connection meets before a document is involved. The host keeps its
documents and hands them in as three effect services:

| Service | |
| --- | --- |
| `HubHost` | `ide` (the name the lock and `hello` carry, such as `vscode` or `obsidian`), `isEnabled()`, `folders()` and the two events that change them |
| `HubDocuments` | `setPublisher(publish)`: publish the open documents at once, then again on every change; the lock lists them |
| `HubHandlerService` | One Effect per request after `hello` (`listDocuments`, `openDocument`, `join`, `applyActions`, `leave`, `save`), with every path already authorized and resolved, plus `disconnect` |

Two sets of rules live here too, so an agent meets the same behaviour in every editor:

- `documentRules.ts`: which files the hub serves (`.erd`, `.vuerd`, `.erd.json`, `.vuerd.json`),
  the refusal texts every host answers alike and the open and save timeouts.
- `joinWindow.ts`: how a joining peer's snapshot lines up with the actions queued while it was
  taken.

## Usage

A host builds one runtime: its documents first, which cannot fail, then the hub on top of them.

```ts
import {
  documentHubLayer,
  HubDocuments,
  HubHandlerService,
  HubHost,
  nativeFileSystemLayer,
  nodeHubServices,
  withDocumentHub,
} from '@dineug/erd-editor-agent-hub-host';
import { Effect, Layer, ManagedRuntime } from 'effect';

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
  Layer.succeed(HubHandlerService, createHandler(registry))
);

const runtime = ManagedRuntime.make(
  withDocumentHub(
    documents,
    documentHubLayer.pipe(
      Layer.provide(Layer.mergeAll(nodeHubServices(version), nativeFileSystemLayer))
    )
  )
);

await runtime.runPromise(Effect.void); // builds the hub
await runtime.dispose(); // on shutdown: deletes the lock, then closes the pipe
```

The hub never throws at the editor. A hub that fails to build is logged under
`[erd-editor hub]` and leaves the documents serving every editor. A failed lock write is repaired
in the background. A host whose process can go down without awaiting `dispose` calls the
`DocumentHub`'s `releaseSync()`, which deletes the lock and the socket before it returns, as
Obsidian does on `quit` and `pagehide`.

`vscode-extension`'s `src/hub/index.ts` and `obsidian-plugin`'s `src/hub/runtime.ts` are the two
real compositions.

## Development

```sh
pnpm exec vp run --filter @dineug/erd-editor-agent-hub-host --fail-if-no-match test
pnpm --filter @dineug/erd-editor-agent-hub-host test:coverage
```

Unit specs run on the memory layers in `src/__test-utils__/hubLayers.ts`. Only `nodeHub.test.ts`
and `netSocket.test.ts` provide the node layers, against a temporary directory: in any other spec
they would bind a socket and write a lock under the real home directory. After a change here, run
both hosts' `test` and `test:coverage` and `pnpm build`, then port the change to the Kotlin hub and
run `./gradlew check` in `packages/intellij-plugin`. `AGENTS.md` has the full rules.
