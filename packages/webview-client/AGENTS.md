<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-09-06 | Updated: 2026-09-06 -->

# webview-client

## Purpose

`mountWebview(host)` puts `<erd-editor>` into an IDE webview and wires everything the host
protocol needs: the `@dineug/erd-editor-webview-bridge` commands in both directions, the
replica worker from `@dineug/erd-editor-replication-store-worker`, file export as base64 and
the lazily loaded Shiki worker. `vscode-webview` and `intellij-webview` are thin adapters over
it, each supplying only its transport and what differs about its host. `private: true`.

## Key Files

| File | Description |
| --- | --- |
| `src/mountWebview.ts` | The whole client: `WebviewHost` (what a host supplies), `WebviewClient` (what it gets back), and the command wiring |
| `src/mountWebview.test.ts` | happy-dom spec over a faked editor element, worker and host: every command, both import modes, auto appearance, dispose |
| `vite.config.ts` | `defineLibraryConfig(import.meta.url, { dts })`; all five runtime packages are `dependencies`, so the build leaves them external Builds unminified, one module per source file (`preserveModules`), and the manifest says `sideEffects: false`. |
## For AI Agents

### Working In This Directory

- **What differs per host is the `WebviewHost` surface, nothing else.** `dispatch` is the transport, `workerName` keeps two IDEs off one worker, `resolveAppearance` is what `'auto'` means (absent, dark), `importFile` says whether file dialogs go to the host or stay the editor's own input, and `onMounted` runs when the editor joins the document. A new host difference is a new optional field here, not a fork of the wiring.
- **Nothing happens until the host answers.** `mountWebview` sends `hostInitialCommand` at once and appends the editor only on `webviewInitialValueCommand`, which also seeds the replica and starts forwarding editor actions to the worker and the host as `hostSaveReplicationCommand`.
- The import `switch` exhausts the bridge's file-type union with a `never`; widening the union without a case here breaks the build, which is the point.
- **Every runtime dependency is a `dependencies` entry and external**, including `@dineug/erd-editor`. The worker is constructed inside `replication-store-worker`, so this package never spells a worker url and the VSCode webview's inline rewrite does not need to know it.
- `refreshAppearance()` re-applies the resolved appearance only while the theme is `'auto'`; the VSCode adapter calls it from a `MutationObserver` on the body's theme kind.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/erd-editor-webview-client --fail-if-no-match test` — `tsc --noEmit`, then Vitest in happy-dom. The spec mocks the three editor-side packages and stubs `document.createElement('erd-editor')` with a real node carrying the editor's API as spies, so it runs without Konva or a shadow root.
- The two webview bundles have no test of their own; this is where the protocol handling is tested.

## Dependencies

### Internal

`@dineug/erd-editor`, `@dineug/erd-editor-replication-store-worker`, `@dineug/erd-editor-shiki-worker` (lazy), `@dineug/erd-editor-webview-bridge` — all `dependencies`, all external.

### External

None — `src/base64.ts` encodes an exported blob for the host through `btoa`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
