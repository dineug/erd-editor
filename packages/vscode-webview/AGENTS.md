<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-08-27 -->

# vscode-webview

## Purpose

The bundle running inside the VSCode webview iframe — the client half of `vuerd-vscode`. It creates the
`<erd-editor>` element, talks to the extension host over `acquireVsCodeApi()` `postMessage`, and spawns the
replication-store worker holding the host's copy. It builds *into* `../vscode-extension/public`, not a local `dist/`.

## Key Files

| File             | Description                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`   | The entire client — element creation, both `Bridge` instances, worker spawn, theme/readonly/import-export handling      |
| `index.html`     | Entry, at the package root; carries the `{{extension-base-url}}` base tag and the `#loading` placeholder                |
| `vite.config.ts` | `run.tasks.build`, `base: './'`, `publicDir: false`, the out-of-package `outDir`, `bundle.[hash:8]` names, local `strip-crossorigin` plugin |
| `src/env.d.ts`   | `@types/vscode-webview` (for `acquireVsCodeApi`) and `vite/client` — the only thing declaring `*.css` imports           |
| `src/webview.css` | Webview loading and editor-host styles imported before the element is appended |

## For AI Agents

### Working In This Directory

- **Output lands in the gitignored `packages/vscode-extension/public`** that `vsce` ships in the VSIX.
  `emptyOutDir: true` and the matching task `output` are both explicit — drop either and stale bundles ship.
- **`base: './'` and the literal `{{extension-base-url}}` token are a contract.** `Editor#buildHtmlForWebview`
  (`packages/vscode-extension/src/editor.ts`) regex-replaces it; absolute asset paths render a blank panel.
- **`crossorigin` must not reach the emitted HTML** — assets come via `asWebviewUri` from an origin sending
  no CORS headers, so such a script never loads; hence `strip-crossorigin` and `modulePreload: false`.
- **`acquireVsCodeApi()` is called once, at module scope in `src/index.ts`**; a second call throws.
- `hostInitialCommand` is dispatched at module evaluation, before the editor is appended. The host's
  `webviewInitialValueCommand` is the gate that creates the element, starts worker replication, removes
  `#loading`, and appends the editor.
- Local editor actions go to both the replication worker and the extension host as
  `hostSaveReplicationCommand`; actions received from the host update the editor and worker without
  echoing a host save command.
- **File dialogs live on the host**: `setImportFileCallback` / `setExportFileCallback` dispatch host commands
  and base64-encode export blobs — everything crossing `postMessage` must be JSON-safe.
- **`appearance: 'auto'` resolves locally** from `document.body`'s `data-vscode-theme-kind` (or the
  `vscode-light` class), watched by a `MutationObserver` — not `prefers-color-scheme`.

### Testing Requirements

- Build (`tsc --noEmit`, then `vp build`): `pnpm exec vp run --filter @dineug/erd-editor-vscode-webview --fail-if-no-match build`.
  Types alone: `pnpm --filter @dineug/erd-editor-vscode-webview typecheck` — the only `package.json` script.
- No unit suite — no `test` task, no `vitest.config.ts`; that `tsc --noEmit` is the only automated check.
- Nothing renders this bundle in CI (the Extension Host harness blocks the webview document request): verify
  by hand — edit a `.erd` file, switch themes, open it in two editor groups, and one from git history.

### Common Patterns

- Two `Bridge` instances — `bridge` for host ↔ webview, `workerBridge` for webview ↔ replication worker.
  Handlers are registered up front and collected with `Bridge.mergeRegister`.
- `editor.getSharedStore({ mouseTracker: false, focusTracker: false })` — that store feeds host replication, not collaboration;
  nothing here receives cursor positions.
- Shiki loads lazily into its own chunk; `#loading` is removed and the editor appended to `document.body`
  only when `webviewInitialValueCommand` arrives.

## Dependencies

### Internal

`@dineug/erd-editor` (the element), `@dineug/erd-editor-vscode-bridge` (command protocol),
`@dineug/erd-editor-vscode-replication-store-worker` (pre-inlined `?worker&inline`), `@dineug/erd-editor-shiki-worker` (lazy), `@dineug/shared` (declared, unimported).

### External

`base64-arraybuffer` for binary payloads, `core-js/stable` imported wholesale at the top of `src/index.ts`,
`@types/vscode-webview` for the `acquireVsCodeApi` typing.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
