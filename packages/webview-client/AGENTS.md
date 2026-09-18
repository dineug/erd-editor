<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-09-06 | Updated: 2026-09-19 -->

# webview-client

## Purpose

`mountWebview(host)` puts `<erd-editor>` into an IDE webview and wires the whole host protocol: the `webview-bridge` commands in both directions, the replica worker from `replication-store-worker`, and file export as base64. `vscode-webview` and `intellij-webview` are thin adapters over it that supply only a `WebviewHost`. `private: true`.

## Key Files

| File | Description |
| --- | --- |
| `src/mountWebview.ts` | The whole client: `WebviewHost` (what a host supplies), `WebviewClient` (`editor`, `refreshAppearance`, `dispose`) and the command wiring |
| `src/base64.ts` | `encodeBase64` — `btoa` over 32 KiB slices, because `String.fromCharCode` takes its bytes as arguments |
| `src/mountWebview.test.ts` | happy-dom spec: every command, each import type, auto appearance, export, dispose |
| `vite.config.ts` | `defineLibraryConfig(import.meta.url, { dts, minify: false, preserveModules: true })` |

## For AI Agents

### Working In This Directory

- **A host difference is a new optional `WebviewHost` field, never a fork of the wiring.** Today: `dispatch` (the transport), `workerName` (one replica worker per IDE), `resolveAppearance` (what `'auto'` means; absent, dark), `importFile` (true sends file dialogs to the host, false keeps the editor's own input) and `onMounted`.
- **Two `Bridge`s**: `bridge` takes host messages from `window`'s `message` event, `workerBridge` takes the replica worker's. Handlers register up front and are collected with `Bridge.mergeRegister`.
- **Nothing mounts until the host answers.** `hostInitialCommand` goes out at once; `webviewInitialValueCommand` seeds the replica, sets the value, starts forwarding, appends the editor to `document.body` and calls `onMounted`. A host that never answers leaves a blank panel.
- **Replication**: the store is `editor.getSharedStore({ mouseTracker: false, focusTracker: false })`, so no cursors. Local actions go to the worker and to the host as `hostSaveReplicationCommand`; the host's `webviewReplicationCommand` goes to the store and the worker, never echoed back. The worker's `hostSaveValueCommand` is relayed to the host.
- The import `switch` exhausts the bridge's file-type union with `never`, so widening the union without a case is a build error — the host has already read the file, and an unhandled type would be lost silently.
- `refreshAppearance()` re-applies only while the theme is `'auto'`.
- **Never construct a worker in this package.** `vscode-webview`'s same-origin rewrite matches only the `erd-editor` and `replication-store-worker` dist files, and a url worker it misses fails that build.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/erd-editor-webview-client --fail-if-no-match test` — happy-dom. The spec mocks `@dineug/erd-editor` and `@dineug/erd-editor-replication-store-worker` and stubs `document.createElement('erd-editor')` with a node carrying spies, so it needs no Konva, shadow root or real worker; the bridge is real.
- This is the only automated test of the protocol handling; the two webview bundles have none.

## Dependencies

### Internal

`@dineug/erd-editor`, `@dineug/erd-editor-replication-store-worker`, `@dineug/erd-editor-webview-bridge` — all `dependencies`, all external; the webview bundle resolves them.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
