<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-15 -->

# vscode-bridge (`@dineug/erd-editor-vscode-bridge`)

## Purpose

The message protocol spoken between an editor **host** and a **webview**. It is host-agnostic despite
the name: the VSCode extension, the VSCode webview, and the IntelliJ webview all import it, and only
the transport differs (`vscode.postMessage` vs. `window.cefQuery` vs. `worker.postMessage`).

The design is a tiny typed command bus. `createCommand<Payload>(type)` mints a command token,
`Bridge#registerCommand` subscribes a listener, `Bridge.executeCommand` builds a plain
`{ type, payload }` action that can cross any transport, and `Bridge#executeAction` dispatches a
received action to its listeners. Actions are shape-checked by the module-private `isAction`
(`isObject(action) && isString(action.type)`) before dispatch, and each listener runs inside
`safeCallback`, so a malformed message from a webview is dropped and a throwing listener cannot take
down the others.

## Key Files

| File                          | Description                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/index.ts`                | Public surface — explicit re-export of `Bridge`, `createCommand`, its types, `export *` of the command catalogue, and the theme enums                  |
| `src/bridge.ts`               | `Bridge` implementation: `registerCommand`, `executeAction`, static `executeCommand` / `mergeRegister`, plus `AnyAction` / `Command` / `Dispose` types |
| `src/commands.ts`             | The command catalogue — eleven `host*` / `webview*` commands and their payload types                                                                   |
| `src/theme.ts`                | `Appearance`, `GrayColor`, `AccentColor` enums and `ThemeOptions`, mirroring the extension's `contributes.configuration`                               |
| `src/internal-types/index.ts` | Internal type helpers; only `ValuesType` is consumed (by `theme.ts`). Excluded from coverage.                                                          |
| `src/*.test.ts`               | Vitest suites colocated with the sources — `bridge.test.ts`, `commands.test.ts`, `theme.test.ts`, `index.test.ts`                                      |
| `vite.config.ts`              | ESM lib build; `peerDependencies` + `dependencies` are turned into a `rolldownOptions.external` regex, so `@dineug/shared` is never inlined            |
| `vitest.config.ts`            | `src/**/*.test.ts`, `node` environment, v8 coverage with per-file 80% thresholds                                                                       |

### Command directions

Command names encode who _receives_ them:

| Prefix     | Direction      | Commands                                                                                                                                             |
| ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `host*`    | webview → host | `hostInitialCommand`, `hostSaveValueCommand`, `hostSaveReplicationCommand`, `hostSaveThemeCommand`, `hostExportFileCommand`, `hostImportFileCommand` |
| `webview*` | host → webview | `webviewInitialValueCommand`, `webviewReplicationCommand`, `webviewUpdateThemeCommand`, `webviewUpdateReadonlyCommand`, `webviewImportFileCommand`   |

`hostInitialCommand` is the only payload-free command (`createCommand<void>`); the import/export
pair carries `{ type: 'json' | 'sql', op: 'set' | 'diff', … }`, and both replication commands carry
an untyped `{ actions: any }` — the store's action array, whose shape belongs to
`erd-editor-schema`, not here.

## For AI Agents

### Working In This Directory

- **This file set is a wire protocol shared by four packages.** Adding or renaming a command in
  `src/commands.ts` requires matching changes in `vscode-extension` (host side), `vscode-webview`,
  `intellij-webview`, and often `vscode-replication-store-worker`. Grep the command name across
  `packages/` before changing it — and update the eleven-name assertions in `src/commands.test.ts`.
- **Payloads must be structured-cloneable.** They travel through `postMessage` and, for IntelliJ,
  through `JSON.stringify` — no functions, no class instances, no `undefined`-only shapes.
- **The IntelliJ transport is JSON string based** (`window.cefQuery({ request: JSON.stringify(action) })`
  in `packages/intellij-webview/src/main.ts`), so payloads must survive a JSON round trip. Binary
  data is base64-encoded by the callers (`base64-arraybuffer`), not by this package.
- **Do not add a transport here.** `Bridge` only knows about actions and listeners; each host wires its
  own `dispatch`. Keeping it transport-free is what lets IntelliJ reuse the "vscode" bridge.
- `Bridge.mergeRegister(...disposables)` is the standard cleanup idiom — collect every `Dispose`
  returned by `registerCommand` and call the merged disposer on teardown.
- **Listeners are keyed by `command.type`, not by command identity.** Two `createCommand` tokens with
  the same string are interchangeable at dispatch time, so a duplicated type string silently crosses
  wires.
- `@dineug/shared` is a `peerDependency`; `private: true`, `sideEffects: false`.

### Testing Requirements

- A Vitest suite covers the protocol: `pnpm --filter @dineug/erd-editor-vscode-bridge test`
  (`test:dev` watch, `test:coverage` for the v8 report). It runs as part of `pnpm test`. The suites
  assert the `createCommand`/`executeCommand` contract, listener registration, dedup and disposal,
  the exact eleven-command catalogue with `type === export name`, the theme enum values, and that the
  barrel re-exports by identity without leaking `isAction`.
- `vitest.config.ts` enforces **per-file** 80% coverage thresholds (lines/functions/branches/statements)
  over `src/**/*.ts`, with `src/internal-types/**` excluded. A new module needs its own `*.test.ts`.
- The suite verifies this package in isolation; it cannot see consumer breakage. After a protocol
  change also run `pnpm build` — a removed or retyped command shows up as a type error in the
  consuming packages there.
- End-to-end verification requires launching the VSCode extension host
  (`packages/vscode-extension/.vscode/` has the launch config) and opening a `.erd` file. Protocol
  bugs are runtime-silent: an unhandled command simply does nothing, so check both directions.

### Common Patterns

- Commands are declared once as module-level constants, and the wire `type` string matches the
  constant name exactly: `export const hostSaveValueCommand = createCommand<{ value: string }>('hostSaveValueCommand')`.
  Keep that convention — `commands.test.ts` asserts it for every export, and it makes a raw
  `postMessage` payload greppable back to its declaration.
- Binary payloads are typed as `type Base64 = string` (see `hostExportFileCommand`); callers encode
  with `base64-arraybuffer` before dispatching.
- Listeners are registered on mount and disposed on unmount; never leave a `Dispose` uncollected.
- Theme enums are `as const` objects paired with same-named types via `ValuesType`.
- `src/index.ts` re-exports `bridge.ts`/`theme.ts` explicitly (types marked `type`) and only
  `commands.ts` with `export *` — internal helpers stay unexported by construction.

## Dependencies

### Internal

- `@dineug/shared` (peer) — `isObject`, `isString`, `safeCallback`

### External

Build- and test-only: `vite`, `vite-plugin-dts`, `@rollup/plugin-typescript`, `tslib`, `vitest`,
`@vitest/coverage-v8`.

### Consumers

`vuerd-vscode` (`src/editor.ts`, `src/erd-editor.ts`, `src/configuration.ts`),
`@dineug/erd-editor-vscode-webview` (`src/index.ts`),
`@dineug/erd-editor-vscode-replication-store-worker` (`src/services/replicationStore.worker.ts`),
`@dineug/erd-editor-intellij-webview` (`src/main.ts`, `src/services/replicationStore.worker.ts`).

<!-- MANUAL: -->
