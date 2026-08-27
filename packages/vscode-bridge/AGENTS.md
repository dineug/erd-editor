<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-08-27 -->

# vscode-bridge

## Purpose

`@dineug/erd-editor-vscode-bridge` is the typed command protocol between an editor host and a webview:
`createCommand<Payload>(type)` mints a token, `Bridge#registerCommand` subscribes, `Bridge.executeCommand`
builds a plain `{ type, payload }` action, and `Bridge#executeAction` dispatches a received one to its
listeners. It carries no transport and is `private: true`, which is why the IntelliJ webview imports the
"vscode" bridge too rather than a second protocol package.

## Key Files

| File | Description |
| --- | --- |
| `src/bridge.ts` | `Bridge` (`registerCommand`, `executeAction`, static `executeCommand`/`mergeRegister`) and `createCommand` |
| `src/commands.ts` | The eleven-command catalogue: six `host*` (webview → host) and five `webview*` (host → webview) |
| `src/index.ts` | Public surface: bridge types/classes, all command constants, and the theme maps/options |
| `src/theme.ts` | `Appearance` / `GrayColor` / `AccentColor` `as const` maps and `ThemeOptions` |
| `vite.config.ts` | `run.tasks` (`build`, `test`) plus the ESM lib build; `peerDependencies` + `dependencies` become the `rolldownOptions.external` regex, so `@dineug/shared` stays unbundled |
| `tsconfig.build.json` | The `vite-plugin-dts` program — `tsconfig.json` minus `src/**/*.test.ts`, so no test types reach `dist/` |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/internal-types/` | Type helpers not re-exported; only `ValuesType` is used (by `theme.ts`). Excluded from coverage |

## For AI Agents

### Working In This Directory

- `src/commands.ts` is a wire protocol: renaming or adding a command means editing `vscode-extension`,
  `vscode-webview`, `vscode-replication-store-worker`, `intellij-webview` and `src/commands.test.ts`.
- Payloads must survive `JSON.stringify` — IntelliJ dispatches through `window.cefQuery` in
  `packages/intellij-webview/src/main.ts`. Binary data is base64-encoded by callers, never here.
- Keep `Bridge` transport-free: it maps `command.type` to listeners only; hosts wire their own dispatch.
- `executeAction` performs only the runtime boundary check that the value is an object with a string
  `type`; it does not validate a command's payload shape. `safeCallback` logs and swallows listener
  exceptions so one bad listener does not stop the remaining listeners.
- Listeners are keyed by the `type` string, not by token identity — two commands sharing a string
  silently receive each other's payloads.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/erd-editor-vscode-bridge --fail-if-no-match test` —
  `tsc --noEmit` then `vp test run` over `src/**/*.test.ts` in a `node` environment. `tsconfig.json`
  has `include: ["src"]`, so the four `*.test.ts` files are typechecked too.
- `pnpm --filter @dineug/erd-editor-vscode-bridge test:coverage` — v8, `perFile` 80% across
  `src/**/*.ts` minus `src/internal-types/**`; a module with no `*.test.ts` fails it. `test:dev` watches.
- This suite cannot see consumer breakage; run `pnpm build` after a protocol change, where a removed
  or retyped command surfaces as a type error in the four consuming packages.

### Common Patterns

- A command's wire `type` string equals its exported constant name; `commands.test.ts` asserts that
  for every export in the module.
- Prefix encodes direction: `host*` is received by the host, `webview*` by the webview.
- Theme enums are `as const` objects paired with a same-named type via `ValuesType`.

## Dependencies

### Internal

- `@dineug/shared` (peer) — `isObject`, `isString`, `safeCallback`

### External

Build- and test-only: `vite-plugin-dts` (with `@typescript/typescript6`) for declaration emit, `tslib`.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
