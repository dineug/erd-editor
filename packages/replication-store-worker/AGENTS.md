<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-10-25 -->

# replication-store-worker

## Purpose

A private package (`private: true`) holding a headless replica of the open document in a dedicated module `Worker`, so that the IDE host receives the serialized value without stringifying it on the UI thread. `mountWebview` in `webview-client` spawns it, sends it `webviewInitialValueCommand` and every editor action as `webviewReplicationCommand`, and relays the `hostSaveValueCommand` it posts after each store `change`. `obsidian-plugin`'s `ErdView` drives it the same way, one replica per tab, inlined into its `main.js`. A change here keeps the worker DOM-free, its constructor spelling intact and its text measurement equal to the page's (Rules).

## Making a Change

1. Read the files across the boundary the change crosses (root step 1). For a bridge command, read `packages/webview-bridge/AGENTS.md` and `packages/webview-client/AGENTS.md`, since `mountWebview` sends and relays those commands. For how the worker is built or spawned, read `packages/vscode-webview/AGENTS.md`, `packages/intellij-webview/AGENTS.md` and `packages/obsidian-plugin/AGENTS.md`, since each host loads it its own way.
2. Carry a change to `src/utils/text.ts` into its twins in `app` and `erd-editor` (Rules § Text Measurement), because the replica and the page must measure alike.
3. Skip root steps 3 and 4: this package has no `vitest.config.*`, so it has no `test` task and no coverage gate. Run its `build` task instead (Testing Requirements). A change to `createReplicationStoreWorker`'s signature still runs `pnpm test`, as root step 3 says for anything a package hands its siblings.
4. Run root step 5; `pnpm build` also rebuilds every bundle that carries the worker.
5. Run the checks that reach the worker (Testing Requirements): `vuerd-vscode`'s e2e, the editor smokes for the IntelliJ or Obsidian path, and an edit in an IDE that changes the file on disk. No spec in `pnpm test` runs the worker, so these are the only checks that a save still happens.
6. Report as root step 7 says. Name each of those checks left out, with the reason: the e2e needs VS Code (`xvfb-run -a` on Linux), the IntelliJ smoke macOS and a JetBrains IDE, the Obsidian smoke macOS or Windows and Obsidian.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | `createReplicationStoreWorker({ name })`: `new Worker(new URL('./services/replicationStore.worker.ts', import.meta.url), { type: 'module', name })` |
| `src/services/replicationStore.worker.ts` | Worker body: a store from `createReplicationStore`, the two inbound commands, and `hostSaveValueCommand` with the `change`'s `value` and `changed` and the store's `runtimeValue`, read as it relays |
| `src/utils/text.ts` | `toWidth`, the text measurement handed to the store |
| `vite.config.ts` | `defineLibraryConfig(import.meta.url, { dts, workers: true })` builds `dist/index.js` plus `dist/workers/replicationStore.worker.js`, referenced by the relative url `tools/vite/worker-url.ts` writes |

## Rules

### What the Replica Posts

- **`hostSaveValueCommand` carries three fields.** `value` is the value both IDE hosts write to disk. `changed` is the store's flag, false for a change that left the value as it was, and the hosts do not write such a change. `runtimeValue` is the document as the replica holds it; a host hands it to a second view or a joining agent and never writes it (root § Purpose gives why).
- **The replica serializes and reports only.** It does not own the file or talk to other tabs; the host does both.

### Imports

- **Import `@dineug/erd-editor/engine.js`, never the package root.** `engine.js` is DOM-free, while the root builds the element classes, which extend `HTMLElement`, and throws in a worker. `tsconfig.json` sets `lib: ["ES2022", "WebWorker"]`, so a reference to `document` fails the type check.

### Worker Construction

- **Keep the one constructor spelling.** `src/index.ts` writes `new Worker(new URL(…, import.meta.url), …)`. Vite bundles a worker only from that literal shape, `tools/vite/worker-url.ts` rewrites Vite's output back into it, and `vscode-webview`'s same-origin rewrite matches it in `dist/`.
- **The worker file imports its dependencies bare.** It imports `engine.js` and the bridge, both `dependencies`, and each webview's bundler builds it as its own entry. How each host loads it is in the `AGENTS.md` of `vscode-webview`, `intellij-webview` and `obsidian-plugin`.

### Text Measurement

- **Change the three `toWidth` twins together.** `packages/app/src/utils/text.ts` is this package's `src/utils/text.ts` byte for byte; it measures `app`'s IndexedDB replicas and a new Drive file's content. The page's `createText` in `packages/erd-editor/src/utils/text.ts` uses the same `400 12px` over the same font stack and `TEXT_PADDING` 2. A change to one goes into all three, so that the replicas and the page measure alike.
- **The no-canvas fallback also lives in `defaultToWidth`.** Without `OffscreenCanvas` the replica falls back to `text.length * 10`, where the page measures a hidden span instead. A change to that fallback also goes into `erd-editor`'s `src/engine/to-width.ts` (`defaultToWidth`, the peer's).
- **Widths live in the runtime value only.** The replica recomputes `ui.width*` with `toWidth` when it replays an edit, and its runtime value carries them. The value a host saves keeps none.

## Testing Requirements

- **The build is the gate.** There is no `test` task and no script. The `build` task builds the workspace dependencies, then runs `tsc --noEmit` and `vp build`:

  ```
  pnpm exec vp run --filter @dineug/erd-editor-replication-store-worker --fail-if-no-match build
  ```

- **CI runs the worker in `vscode-extension-e2e` only**, in a real VS Code webview. `vuerd-vscode`'s `test/integration/agent-hub.test.ts` has a peer's batch dirty the tab and saves it to disk. It also has a view change leave the tab clean through the `changed` flag. Run it locally with `pnpm --filter vuerd-vscode e2e`.
- **The two editor smokes run it outside CI.** `pnpm --filter @dineug/erd-editor-intellij-plugin smoke` runs it in a sandbox JetBrains IDE, and `pnpm --filter @dineug/erd-editor-obsidian-plugin smoke` in Obsidian. Both check what reaches the file; the IntelliJ smoke's step A7 waits for an agent edit on disk. Root § Testing Requirements gives what they need first.
- **Verify in an IDE.** No other spec runs the worker, and a broken replica fails nothing else, because edits just never persist. Open a `.erd`, edit it, and confirm the file on disk changes.

## Common Patterns

- **Raw messages plus `Bridge`, not Comlink.** The worker uses `globalThis.postMessage` and `addEventListener('message')` with `Bridge`, so it speaks the same bridge commands `mountWebview` exchanges with the host.
- **The `Bridge.mergeRegister` disposer is dropped on purpose.** The worker lives as long as the page, and `mountWebview`'s `dispose` terminates it.

## Dependencies

### Internal

`@dineug/erd-editor` (the `engine.js` entry) and `@dineug/erd-editor-webview-bridge`. Both are `dependencies`, left external in both the page build and the worker build (root § Working In This Directory, Externals).

### External

None.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
