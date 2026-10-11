<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-10-11 -->

# webview-bridge

## Purpose

`@dineug/erd-editor-webview-bridge` (`private: true`) is the typed command protocol between an IDE host and its webview. `createCommand<Payload>(type)` mints a token, `Bridge#registerCommand` subscribes, `Bridge.executeCommand` builds a plain `{ type, payload }` action, and `Bridge#executeAction` dispatches a received one. It carries no transport; each side wires its own. Its commands reach `webview-client`, `replication-store-worker`, `vscode-extension`, `obsidian-plugin` and a hand-kept Kotlin mirror in `intellij-plugin`. A change here keeps each command's `type` string and payload in step with those consumers, and the theme and locale lists in step with the hosts and packages that hold them (Rules § Theme and Locale Lists).

## Making a Change

1. Read the `AGENTS.md` on each side of the boundary (root step 1). A command or payload change reaches the consumers Rules § Wire Protocol lists for it. A change to `src/theme.ts` or `src/locale.ts` reaches `vscode-extension`, `obsidian-plugin`, `intellij-plugin` and `webview-client` (Rules § Theme and Locale Lists).
2. Change every consumer in the same change: walk the list in Rules § Wire Protocol for a command, or Rules § Theme and Locale Lists for a value. A consumer that ignores a field fails no build, so only the walk finds it. For a locale change, compare `erd-editor`'s `src/i18n/locales.ts` by hand, since no gate compares its order or names.
3. Run this package's `test` task (root step 3):

   ```
   pnpm exec vp run --filter @dineug/erd-editor-webview-bridge --fail-if-no-match test
   ```

   A change to a command, a payload, a list or an exported type also runs `pnpm test`, since the consumers type-check against this package's `dist/**/*.d.ts`.
4. Run root step 4 where source under `src/` changed: `pnpm --filter @dineug/erd-editor-webview-bridge --fail-if-no-match test:coverage`.
5. Run root step 5. Its `pnpm build` is where a removed or retyped command fails the TypeScript consumers, which this package's suite cannot see (Testing Requirements).
6. Run `ERD_MCP_CONFORMANCE=required ./gradlew check` in `packages/intellij-plugin` for any change here (root step 6), because the Gradle tests read `src/theme.ts` and `src/locale.ts`. For a command change, first update the Kotlin mirror by hand, because nothing compares it with `src/commands.ts`. For a command whose effect a user sees in VS Code, also run `pnpm --filter vuerd-vscode e2e` (root step 6).
7. Report as root step 7 says. Name each host check left out with its reason, such as the Obsidian or IntelliJ editor smoke and the platform it needs (root § Testing Requirements).

## Key Files

| File | Description |
| --- | --- |
| `src/bridge.ts` | `Bridge` (`registerCommand`, `executeAction`, static `executeCommand` / `mergeRegister`) and `createCommand` |
| `src/commands.ts` | The wire catalogue: seven `host*` commands (webview → host) and six `webview*` (host → webview); field rules in Rules § Payload Fields |
| `src/commands.test.ts` | Pins the exact set of thirteen commands and asserts that each `type` equals its export name |
| `src/locale.ts` | `LocaleLabel`, the 25 display languages the editor offers, code to native name in its picker's order (each by its own name, English among them); `Locale`, its keys; `LocaleSetting`, a code or `'auto'`, the host's spelling of the editor's System. Who holds it: Rules § Theme and Locale Lists |
| `src/theme.ts` | `Appearance` / `GrayColor` / `AccentColor` `as const` maps and `ThemeOptions`. Who holds them: Rules § Theme and Locale Lists |
| `src/safeCallback.ts` | Runs one listener and logs its exception, so one bad listener does not stop the rest |
| `vite.config.ts` | `defineLibraryConfig(import.meta.url, { dts, minify: false, preserveModules: true })`, the private-library shape (root § Working In This Directory, Library builds) |

## Rules

### Wire Protocol

- **`src/commands.ts` is a wire protocol.** Adding, renaming or retyping a command, or changing what a payload field means, reaches every file below. Walk the list by hand, because a payload field a consumer ignores fails no build, and neither does a new meaning for an old field. `changed` on `hostSaveValueCommand` reached every host's save and every hub's quiet wait that way.
  - `packages/webview-client/src/mountWebview.ts` and its spec: the webview side of every command.
  - `packages/replication-store-worker/src/services/replicationStore.worker.ts`: `webviewInitialValueCommand`, `webviewReplicationCommand` and `hostSaveValueCommand`.
  - `packages/vscode-extension/src/erd-editor.ts`, the VS Code host, and `src/hub/documentRegistry.ts`, the hub registry. The registry injects agent batches as `webviewReplicationCommand` and counts each replica save for the hub's quiet wait.
  - `packages/obsidian-plugin/src/ErdView.ts`, the Obsidian host, and `src/hub/registry.ts`, the hub registry. The host drives its own replica worker with `webviewInitialValueCommand`, `webviewReplicationCommand` and `hostSaveValueCommand`, and the registry's quiet wait counts each replica save.
  - `packages/intellij-plugin/src/main/kotlin/…/editor/WebviewBridge.kt` and `ErdEditor.kt`, a hand-kept Kotlin mirror that no TypeScript build sees, pinned by its `WebviewBridgeCommandTest`. Also `…/hub/document/DocumentRegistry.kt`, whose quiet wait counts each replica save.
  - `src/commands.test.ts`, which pins the exact set of thirteen.
- **A command's `type` string is its identity.** It equals the command's export name, which `commands.test.ts` asserts. Listeners are keyed by that string, not by token, so two commands sharing a string receive each other's payloads.
- **Keep every payload JSON-safe.** A payload survives `JSON.stringify` / `JSON.parse`, because IntelliJ carries every action as a string. The caller (`webview-client`) base64-encodes binary; this package never does.
- **`executeAction` checks the envelope, not the payload.** It checks only that the value is a plain object with a string `type`. It never validates a payload's shape.

### Payload Fields

- **`hostSaveValueCommand` carries both forms of the document.** `value` is the one a host writes and compares. `runtimeValue` is the one a host hands a second view or a joining agent and never writes (root § Purpose gives why).
- **`systemAppearance` is the light or dark `'auto'` shows.** `webviewUpdateThemeCommand` carries it as an optional field, from a host that knows it outside the page (IntelliJ).
- **`systemLocale` is what the locale's `'auto'` follows.** `webviewUpdateLocaleCommand` carries it as an optional field: the host's UI language as a BCP 47 tag. Both IDE hosts send it on every update: VS Code's `vscode.env.language`, and the language IntelliJ shows its own UI in. Left out, the page keeps the one it has.
- **The locale commands are a host setting.** The theme's commands are one too, and neither locale command is a replica command. `hostSaveLocaleCommand` carries a pick from the editor's language picker or palette (`'auto'` for its System). `webviewUpdateLocaleCommand` carries the saved setting. The replica worker and the hub registries never see either, and the display language never enters the document, the store or its history.
- **Widen the import `type` union twice.** The union (`json | sql | graphql | dbml | aml`) is written in both `hostImportFileCommand` and `webviewImportFileCommand`. The build then fails until `webview-client`'s import `switch` and `vscode-extension`'s `IMPORT_FILE_TYPES` gain a case, which is intended.
- **Both import commands carry an optional `mode`.** It is `ImportMode`, `replace | append`. The editor names it only for Import and Add, and every reader takes an absent `mode` as a replace. `vscode-extension` relays it from one command to the other, and `webview-client` hands it to the editor. The Kotlin mirror holds it as a nullable string the mapper leaves out.

### Theme and Locale Lists

- **A theme value change fails three hosts.** A value added to or removed from `src/theme.ts` fails a spec or a type check in each of three hosts until that host follows:
  - `vscode-extension`'s manifest enums, which its `src/configuration.test.ts` holds to these maps.
  - The Obsidian plugin's `readSettings`. It takes these gray and accent values, and for the appearance only `auto`, `light` and `dark` from `settings.ts`'s own `APPEARANCES`. It falls back to the default for any other. Its `settings.test.ts` pins six gray and 26 accent colors. An appearance added fails no Obsidian spec, only `tsc --noEmit` on `main.ts`'s `APPEARANCE_NAMES` record, and needs adding to `APPEARANCES` too.
  - The IntelliJ plugin's settings page, whose `ErdEditorThemeTest` reads this file. It holds the gray and accent lists equal to these maps in source order. It holds the appearances, `auto` added, equal to `Appearance` as a set, and pins the same counts.
- **A locale change fails these host specs.** A code added, removed or moved, or a name changed, fails each until that host follows:
  - `vscode-extension`'s `src/configuration.test.ts`, which holds the manifest's `enum` and `enumItemLabels` to `LocaleLabel`.
  - The IntelliJ plugin's `ErdEditorLocaleTest`, which reads `src/locale.ts` and holds `ErdEditorLocale` equal to it in source order.
- **Obsidian builds its locale lists from the map.** The plugin builds its `LOCALES` and `LOCALE_NAMES` from `LocaleLabel`. Its `settings.test.ts` pins 26 options, `auto` first and `ko-KR` last.
- **Keep `erd-editor`'s locale list in step by hand.** Against the editor, `LocaleLabel` is held only as a set: a code one side lacks fails `webview-client`'s `tsc --noEmit` gate (`toEditorLocale` / `toHostLocale`). Nothing compares the order or the names with `erd-editor`'s `src/i18n/locales.ts`.

## Testing Requirements

- **The `test` task runs in the node environment.** It is `pnpm exec vp run --filter @dineug/erd-editor-webview-bridge --fail-if-no-match test` (Making a Change step 3).
- **This suite cannot see consumer breakage.** After a protocol change, run `pnpm build`, where a removed or retyped command fails the TypeScript consumers. Update the Kotlin mirror by hand, because nothing compares it with this file.

## Common Patterns

- The prefix is the direction: `host*` is received by the host, `webview*` by the webview.
- Theme enums are `as const` objects paired with a same-named type through `ValuesType` (`src/internal-types/`).
- `LocaleLabel` is keyed the other way: its keys are the codes (`Locale` is `keyof typeof LocaleLabel`), and its values are the native names a host's setting shows.

## Dependencies

### Internal

None.

### External

`es-toolkit`: `isPlainObject` / `isString` in `executeAction`. It is a `dependencies` entry the build leaves external (root § Working In This Directory, Externals).

<!-- MANUAL: notes added below this line are preserved on regeneration -->
