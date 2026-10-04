<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-10-03 -->

# webview-bridge

## Purpose

`@dineug/erd-editor-webview-bridge` is the typed command protocol between an IDE host and its webview: `createCommand<Payload>(type)` mints a token, `Bridge#registerCommand` subscribes, `Bridge.executeCommand` builds a plain `{ type, payload }` action and `Bridge#executeAction` dispatches a received one. It carries no transport; each side wires its own. `private: true`.

## Key Files

| File | Description |
| --- | --- |
| `src/bridge.ts` | `Bridge` (`registerCommand`, `executeAction`, static `executeCommand` / `mergeRegister`) and `createCommand` |
| `src/commands.ts` | The wire catalogue: six `host*` commands (webview → host) and five `webview*` (host → webview); `webviewUpdateThemeCommand` also carries an optional `systemAppearance`, the light or dark `'auto'` shows, from a host that knows it outside the page (IntelliJ) |
| `src/theme.ts` | `Appearance` / `GrayColor` / `AccentColor` `as const` maps and `ThemeOptions`; a value added or removed fails a spec in each of three hosts until that host follows: `vscode-extension`'s manifest enums, which its `src/configuration.test.ts` holds to these maps; the Obsidian plugin's `readSettings`, which takes these values and falls back to the default for any other, and whose `settings.test.ts` pins six gray and 26 accent colors; the IntelliJ plugin's settings page, whose `ErdEditorThemeTest` reads this file, holds the page's lists equal to these maps in source order, `auto` added to the appearances, and pins the same counts |
| `src/safeCallback.ts` | Runs one listener and logs its exception, so one bad listener does not stop the rest |
| `vite.config.ts` | `defineLibraryConfig(import.meta.url, { dts, minify: false, preserveModules: true })` — the private-library shape |

## For AI Agents

### Working In This Directory

- **`src/commands.ts` is a wire protocol.** Adding, renaming or retyping a command, or changing what a payload field means, ripples to:
  - `packages/webview-client/src/mountWebview.ts` and its spec — the webview side of every command;
  - `packages/replication-store-worker/src/services/replicationStore.worker.ts` — `webviewInitialValueCommand`, `webviewReplicationCommand`, `hostSaveValueCommand`;
  - `packages/vscode-extension/src/erd-editor.ts` and `src/hub/documentRegistry.ts` — the VSCode host, and the hub registry that injects agent batches as `webviewReplicationCommand` and counts each replica save for the hub's quiet wait;
  - `packages/obsidian-plugin/src/ErdView.ts` and `src/hub/registry.ts` — the Obsidian host, which drives its own replica worker with `webviewInitialValueCommand`, `webviewReplicationCommand` and `hostSaveValueCommand`, and the hub registry whose quiet wait counts each replica save;
  - `packages/intellij-plugin/src/main/kotlin/…/editor/WebviewBridge.kt` and `ErdEditor.kt`, a hand-kept Kotlin mirror that no TypeScript build sees, pinned by its `WebviewBridgeCommandTest`, and `…/hub/document/DocumentRegistry.kt`, whose quiet wait counts each replica save;
  - `src/commands.test.ts`, which pins the exact set of eleven.
- **A payload field a consumer ignores fails no build, and neither does a new meaning for an old field**, so the list above is walked by hand: `changed` on `hostSaveValueCommand` reached every host's save and every hub's quiet wait that way.
- **A command's `type` string is its identity and equals its export name** (`commands.test.ts` asserts it). Listeners are keyed by that string, not by token, so two commands sharing a string receive each other's payloads.
- **Payloads must survive `JSON.stringify` / `JSON.parse`** — IntelliJ carries every action as a string. Binary is base64-encoded by the caller (`webview-client`), never here.
- `executeAction` checks only that the value is a plain object with a string `type`; payload shape is never validated.
- The import `type` union (`json | sql | graphql | dbml | aml`) is written twice, in `hostImportFileCommand` and `webviewImportFileCommand` — widen both. The build then fails until `webview-client`'s import `switch` and `vscode-extension`'s `IMPORT_FILE_TYPES` gain a case, which is intended.
- Both import commands carry an optional `mode` (`ImportMode`, `replace | append`), which the editor names only for Import and Add and every reader takes as a replace when it is absent: `vscode-extension` relays it from one command to the other, `webview-client` hands it to the editor, and the Kotlin mirror holds it as a nullable string the mapper leaves out.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/erd-editor-webview-bridge --fail-if-no-match test` (node environment).
- This suite cannot see consumer breakage: after a protocol change run `pnpm build`, where a removed or retyped command fails the TypeScript consumers, and update the Kotlin mirror by hand — nothing compares it with this file.

### Common Patterns

- The prefix is the direction: `host*` is received by the host, `webview*` by the webview.
- Theme enums are `as const` objects paired with a same-named type through `ValuesType` (`src/internal-types/`).

## Dependencies

### External

`es-toolkit` — `isPlainObject` / `isString` in `executeAction`; a `dependencies` entry the build leaves external.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
