<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-09-19 -->

# webview-bridge

## Purpose

`@dineug/erd-editor-webview-bridge` is the typed command protocol between an IDE host and its webview: `createCommand<Payload>(type)` mints a token, `Bridge#registerCommand` subscribes, `Bridge.executeCommand` builds a plain `{ type, payload }` action and `Bridge#executeAction` dispatches a received one. It carries no transport; each side wires its own. `private: true`.

## Key Files

| File | Description |
| --- | --- |
| `src/bridge.ts` | `Bridge` (`registerCommand`, `executeAction`, static `executeCommand` / `mergeRegister`) and `createCommand` |
| `src/commands.ts` | The wire catalogue: six `host*` commands (webview → host) and five `webview*` (host → webview) |
| `src/theme.ts` | `Appearance` / `GrayColor` / `AccentColor` `as const` maps and `ThemeOptions` |
| `src/safeCallback.ts` | Runs one listener and logs its exception, so one bad listener does not stop the rest |
| `vite.config.ts` | `defineLibraryConfig(import.meta.url, { dts, minify: false, preserveModules: true })` — the private-library shape |

## For AI Agents

### Working In This Directory

- **`src/commands.ts` is a wire protocol.** Adding, renaming or retyping a command ripples to:
  - `packages/webview-client/src/mountWebview.ts` and its spec — the webview side of every command;
  - `packages/replication-store-worker/src/services/replicationStore.worker.ts` — `webviewInitialValueCommand`, `webviewReplicationCommand`, `hostSaveValueCommand`;
  - `packages/vscode-extension/src/erd-editor.ts` — the VSCode host;
  - `packages/intellij-plugin/src/main/kotlin/…/editor/WebviewBridge.kt` and `ErdEditor.kt` — a hand-kept Kotlin mirror that no TypeScript build sees;
  - `src/commands.test.ts`, which pins the exact set of eleven.
- **A command's `type` string is its identity and equals its export name** (`commands.test.ts` asserts it). Listeners are keyed by that string, not by token, so two commands sharing a string receive each other's payloads.
- **Payloads must survive `JSON.stringify` / `JSON.parse`** — IntelliJ carries every action as a string. Binary is base64-encoded by the caller (`webview-client`), never here.
- `executeAction` checks only that the value is a plain object with a string `type`; payload shape is never validated.
- The import `type` union (`json | sql | graphql | dbml | aml`) is written twice, in `hostImportFileCommand` and `webviewImportFileCommand` — widen both. The build then fails until `webview-client`'s import `switch` and `vscode-extension`'s `IMPORT_FILE_TYPES` gain a case, which is intended.

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
