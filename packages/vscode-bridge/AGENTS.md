<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-08 -->

# vscode-bridge (`@dineug/erd-editor-vscode-bridge`)

## Purpose

The message protocol spoken between an editor **host** and a **webview**. It is host-agnostic despite
the name: the VSCode extension, the VSCode webview, and the IntelliJ webview all import it, and only
the transport differs (`vscode.postMessage` vs. `window.cefQuery` vs. `worker.postMessage`).

The design is a tiny typed command bus. `createCommand<Payload>(type)` mints a command token,
`Bridge#registerCommand` subscribes a listener, `Bridge.executeCommand` builds a plain
`{ type, payload }` action that can cross any transport, and `Bridge#executeAction` dispatches a
received action to its listeners. Actions are validated (`isAction`) before dispatch, so untrusted
messages from a webview cannot invoke arbitrary handlers.

## Key Files

| File                          | Description                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/index.ts`                | Public surface — the `Bridge` class, `createCommand`, the command catalogue, and theme types                                                           |
| `src/bridge.ts`               | `Bridge` implementation: `registerCommand`, `executeAction`, static `executeCommand` / `mergeRegister`, plus `AnyAction` / `Command` / `Dispose` types |
| `src/commands.ts`             | The command catalogue — every `host*` and `webview*` command and its payload type                                                                      |
| `src/theme.ts`                | `Appearance`, `GrayColor`, `AccentColor` enums and `ThemeOptions`, mirroring the extension's `contributes.configuration`                               |
| `src/internal-types/index.ts` | Internal type helpers                                                                                                                                  |

### Command directions

Command names encode who _receives_ them:

| Prefix     | Direction      | Examples                                                                                                                                             |
| ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `host*`    | webview → host | `hostInitialCommand`, `hostSaveValueCommand`, `hostSaveReplicationCommand`, `hostSaveThemeCommand`, `hostExportFileCommand`, `hostImportFileCommand` |
| `webview*` | host → webview | `webviewInitialValueCommand`, `webviewReplicationCommand`, `webviewUpdateThemeCommand`, `webviewUpdateReadonlyCommand`, `webviewImportFileCommand`   |

## For AI Agents

### Working In This Directory

- **This file set is a wire protocol shared by four packages.** Adding or renaming a command in
  `src/commands.ts` requires matching changes in `vscode-extension` (host side), `vscode-webview`,
  `intellij-webview`, and often `vscode-replication-store-worker`. Grep the command name across
  `packages/` before changing it.
- **Payloads must be structured-cloneable.** They travel through `postMessage` and, for IntelliJ,
  through `JSON.stringify` — no functions, no class instances, no `undefined`-only shapes.
- **The IntelliJ transport is JSON string based** (`window.cefQuery({ request: JSON.stringify(action) })`),
  so payloads must survive a JSON round trip. Binary data is base64-encoded by the callers
  (`base64-arraybuffer`), not by this package.
- **Do not add a transport here.** `Bridge` only knows about actions and listeners; each host wires its
  own `dispatch`. Keeping it transport-free is what lets IntelliJ reuse the "vscode" bridge.
- `Bridge.mergeRegister(...disposables)` is the standard cleanup idiom — collect every `Dispose`
  returned by `registerCommand` and call the merged disposer on teardown.
- `@dineug/shared` is a `peerDependency`; `private: true`, `sideEffects: false`.

### Testing Requirements

- No `test` target. Verify with `pnpm --filter @dineug/erd-editor-vscode-bridge build`, then a full
  `pnpm build` — a protocol change that breaks a consumer shows up as a type error there.
- End-to-end verification requires launching the VSCode extension host
  (`packages/vscode-extension/.vscode/` has the launch config) and opening a `.erd` file. Protocol
  bugs are runtime-silent: an unhandled command simply does nothing, so check both directions.

### Common Patterns

- Commands are declared once as module-level constants, and the wire `type` string matches the
  constant name exactly: `export const hostSaveValueCommand = createCommand<{ value: string }>('hostSaveValueCommand')`.
  Keep that convention — it makes a raw `postMessage` payload greppable back to its declaration.
- Binary payloads are typed as `type Base64 = string` (see `hostExportFileCommand`); callers encode
  with `base64-arraybuffer` before dispatching.
- Listeners are registered on mount and disposed on unmount; never leave a `Dispose` uncollected.
- Theme enums are `as const` objects paired with same-named types.

## Dependencies

### Internal

- `@dineug/shared` (peer) — `isObject`, `isString`, `safeCallback`

### External

Build-only.

### Consumers

`vuerd-vscode`, `@dineug/erd-editor-vscode-webview`,
`@dineug/erd-editor-vscode-replication-store-worker`, `@dineug/erd-editor-intellij-webview`.

<!-- MANUAL: -->
