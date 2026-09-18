<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-09-19 -->

# replication-store-worker

## Purpose

A headless replica of the open document in a dedicated module `Worker`, so the IDE host receives the serialized value without stringifying on the UI thread. `mountWebview` in `webview-client` spawns it, feeds it `webviewInitialValueCommand` and every editor action as `webviewReplicationCommand`, and relays the `hostSaveValueCommand` it posts after each store `change` — the value both IDE hosts write to disk. `private: true`.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | `createReplicationStoreWorker({ name })` — `new Worker(new URL('./services/replicationStore.worker.ts', import.meta.url), { type: 'module', name })` |
| `src/services/replicationStore.worker.ts` | Worker body: a store from `createReplicationStore`, the two inbound commands, `hostSaveValueCommand` on `change` |
| `src/utils/text.ts` | `toWidth`, the text measurement handed to the store |
| `vite.config.ts` | `defineLibraryConfig(import.meta.url, { dts, workers: true })` → `dist/index.js` plus `dist/workers/replicationStore.worker.js`, referenced by the relative url `tools/vite/worker-url.ts` writes |

## For AI Agents

### Working In This Directory

- **Import `@dineug/erd-editor/engine.js` (DOM-free), never the package root**, which registers custom elements and throws in a worker. `tsconfig.json` sets `lib: ["ES2022", "WebWorker"]`, so `document` does not typecheck.
- **Keep the one constructor spelling** `new Worker(new URL(…, import.meta.url), …)` in `src/index.ts`: Vite bundles a worker only from that literal shape, `tools/vite/worker-url.ts` rewrites Vite's output back into it, and `vscode-webview`'s same-origin rewrite matches it in `dist/`. The worker file imports `engine.js` and the bridge bare (both `dependencies`), and each webview's bundler builds it as its own entry — see those packages for how each host loads it.
- **`toWidth` must stay in step with `packages/erd-editor/src/utils/text.ts`** (`400 12px` over the same font stack, `TEXT_PADDING` 2). The replica recomputes `ui.width*` with it when it replays an edit, and its value is what the host saves. Without `OffscreenCanvas` it falls back to `text.length * 10`, where the page measures a hidden span instead.
- The replica serializes and reports; it does not own the file or talk to other tabs — the host does both.

### Testing Requirements

- No test task and no scripts; the gate is `pnpm exec vp run --filter @dineug/erd-editor-replication-store-worker --fail-if-no-match build`.
- Nothing runs the worker in CI, and its failure is silent: edits never persist. Verify in an IDE — open a `.erd`, edit, confirm the file on disk changes.

### Common Patterns

- Raw `globalThis.postMessage` / `addEventListener('message')` plus `Bridge`, not Comlink.
- The `Bridge.mergeRegister` disposer is dropped on purpose; the worker lives as long as the page, and `mountWebview`'s `dispose` terminates it.

## Dependencies

### Internal

`@dineug/erd-editor` (the `engine.js` entry) and `@dineug/erd-editor-webview-bridge` — `dependencies`, left external in both the page and the worker build.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
