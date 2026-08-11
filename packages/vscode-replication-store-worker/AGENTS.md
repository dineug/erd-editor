<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-08 -->

# vscode-replication-store-worker (`@dineug/erd-editor-vscode-replication-store-worker`)

## Purpose

A tiny worker package that runs a **headless replica** of the editor document inside the VSCode
webview, off the main thread.

The problem it solves: the VSCode host must persist the `.erd` file, but serializing the whole
document on every keystroke in the UI thread stalls the canvas. So the webview forwards the raw action
stream to this worker; the worker feeds it into `createReplicationStore` from
`@dineug/erd-editor/engine.js` (the DOM-free engine entry), and emits the fully serialized document
back via `hostSaveValueCommand` only when the store reports a `change`.

The whole package is ~40 lines of glue — its value is the boundary, not the code.

## Key Files

| File                                      | Description                                                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                            | Exports `ReplicationStoreWorker`, the worker constructor, via Vite's `?worker&inline` import suffix                                                                   |
| `src/services/replicationStore.worker.ts` | The worker body: creates the replication store, registers `webviewInitialValueCommand` / `webviewReplicationCommand`, and dispatches `hostSaveValueCommand` on change |
| `src/utils/text.ts`                       | `toWidth` — text measurement supplied to the engine context (the headless store still needs column widths for layout math)                                            |
| `src/vite-env.d.ts`                       | Ambient types for the `?worker&inline` import                                                                                                                         |

## For AI Agents

### Working In This Directory

- **`?worker&inline` is load-bearing.** The worker is inlined into the bundle rather than emitted as a
  separate file because the VSCode webview's CSP and `vscode-resource:` URL scheme make loading an
  external worker script unreliable. Do not "optimize" this into a plain worker URL.
- **Import the engine entry, never the element entry.** `@dineug/erd-editor/engine.js` is DOM-free;
  `@dineug/erd-editor` registers custom elements and will throw in a worker.
- **`toWidth` must stay canvas-free.** It runs in a worker with no `document`, so it is a metrics-table
  implementation, not `ctx.measureText`. `packages/intellij-webview/src/utils/text.ts` is a near-copy —
  keep the two in sync or extract them.
- Only three commands cross this boundary: in `webviewInitialValueCommand` and
  `webviewReplicationCommand`, out `hostSaveValueCommand`. Adding a fourth means touching
  `vscode-bridge` and `vscode-webview` too.
- The worker communicates over raw `globalThis.postMessage` / `addEventListener('message')` and the
  `Bridge` — **not** Comlink (unlike the shiki and schema-GC workers). Don't mix the two idioms.
- `private: true`.

### Testing Requirements

- No `test` target. Verify with `pnpm --filter @dineug/erd-editor-vscode-replication-store-worker build`.
- Real verification requires the VSCode extension host: launch it from
  `packages/vscode-extension/.vscode/`, open a `.erd` file, edit, and confirm the file on disk updates.
  Failure here is silent — edits simply never persist — so check the webview devtools console.
- After changing the engine's `createReplicationStore` signature, rebuild this package; it is the only
  consumer of the `engine.js` entry.

### Common Patterns

- `Bridge.mergeRegister(...)` collects command disposers.
- Actions are forwarded verbatim; the worker never interprets payloads.

## Dependencies

### Internal

- `@dineug/erd-editor` — the `engine.js` entry (`createReplicationStore`)
- `@dineug/erd-editor-vscode-bridge` — command protocol
- `@dineug/shared`

### External

Build-only: `vite`, `vite-plugin-dts`, `@rollup/plugin-typescript`.

### Consumers

`@dineug/erd-editor-vscode-webview`. (The IntelliJ webview does the same job with its own inline copy
under `packages/intellij-webview/src/services/`.)

<!-- MANUAL: -->
