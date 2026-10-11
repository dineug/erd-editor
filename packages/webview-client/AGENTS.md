<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-09-06 | Updated: 2026-10-11 -->

# webview-client

## Purpose

`mountWebview(host)` puts `<erd-editor>` into an IDE webview and wires the whole host protocol: the `webview-bridge` commands in both directions, the replica worker from `replication-store-worker`, and file export as base64. `vscode-webview` and `intellij-webview` are thin adapters over it that supply only a `WebviewHost`. The package is `private: true`. A change here keeps the mount order, the `'auto'` / `'system'` mapping and the unchanged relay of the replica's saves intact, and constructs no worker (Rules).

## Making a Change

1. **Read the AGENTS.md files across the boundary** (root step 1). For a bridge command, read `packages/webview-bridge/AGENTS.md` and the host side that answers it, `packages/vscode-extension/AGENTS.md` and `packages/intellij-plugin/AGENTS.md`. For a `WebviewHost` field or the mount order, read `packages/vscode-webview/AGENTS.md` and `packages/intellij-webview/AGENTS.md`, since each supplies a `WebviewHost`. For the replica worker or `hostSaveValueCommand`, read `packages/replication-store-worker/AGENTS.md`.
2. **Give the change its case in `src/mountWebview.test.ts`** (Testing Requirements), because it is the only spec of every command. A `WebviewHost` field added or removed also updates the field list in Rules § Host Adapters (root step 2).
3. **Run this package's `test` task** (root step 3), `tsc --noEmit` then Vitest:

   ```
   pnpm exec vp run --filter @dineug/erd-editor-webview-client --fail-if-no-match test
   ```

   A change to `WebviewHost`, `WebviewClient` or the exports of `src/index.ts` reaches both adapters. Neither has a `test` task, so root step 5's `pnpm build` is what type-checks them.
4. **Run the coverage gate** (root step 4), which measures every `src/**/*.ts` file but the spec at 80% per file:

   ```
   pnpm --filter @dineug/erd-editor-webview-client --fail-if-no-match test:coverage
   ```

5. **Run root step 5.** `pnpm build` rebuilds `vscode-webview` and `intellij-webview` with the change inlined.
6. **Run `pnpm --filter vuerd-vscode e2e`** (root step 6) for a change to the mount, the replication or the save path, because its `agent-hub.test.ts` drives the built bundle and asserts this wiring end to end (Testing Requirements). For a change the IntelliJ page shows, open it in the sandbox IDE as `packages/intellij-webview/AGENTS.md` (Making a Change, step 4) says, since `pnpm test` and that e2e run this wiring only in happy-dom and VS Code.
7. **Report as root step 7 says.** When the e2e or the IntelliJ check did not run, name it with the reason: the e2e needs VS Code (`xvfb-run -a` on Linux), and the IntelliJ check needs a desktop JetBrains IDE.

## Key Files

| File | Description |
| --- | --- |
| `src/mountWebview.ts` | The whole client: `WebviewHost` (what a host supplies), `WebviewClient` (`editor`, `refreshAppearance`, `dispose`) and the command wiring |
| `src/base64.ts` | `encodeBase64`: `btoa` over 32 KiB slices, because `String.fromCharCode` takes its bytes as arguments |
| `src/mountWebview.test.ts` | The happy-dom spec: every command; each import type with its placement and mode; `'auto'` as `'system'` both ways for the theme and the display language (`setSystemLocale` before `setLocale`); the theme builder on when the host's value arrives; the locale picker and the welcome screen on before the append; export; dispose |
| `vite.config.ts` | `defineLibraryConfig(import.meta.url, { dts, minify: false, preserveModules: true })` |

## Rules

### Host Adapters

- **Add a host difference as a `WebviewHost` field.** Make the field optional and keep one copy of the wiring in `mountWebview`, never a fork of it. The two adapters supply only a `WebviewHost`, so the protocol is decided once for both hosts. The fields are:
  - `dispatch` (the transport to the host).
  - `workerName` (the name the replica worker carries, one per IDE; every `mountWebview` call spawns its own dedicated `Worker`).
  - `resolveAppearance` (what `'auto'` shows; absent, dark).
  - `importFile` (true sends file dialogs to the host, false keeps the editor's own input).
  - `onMounted` (runs once the editor is in the document, where a host clears its placeholder).

### Mount Order

- **Mount only after the host's value arrives.** `mountWebview` sends `hostInitialCommand` at once. On `webviewInitialValueCommand` it then, in this order:
  1. seeds the replica worker with the value;
  2. sets the editor's value;
  3. turns on `enableThemeBuilder`, `enableLocalePicker` and `enableWelcomeScreen`;
  4. starts forwarding the store's actions (Replication);
  5. appends the editor to `document.body`;
  6. calls `onMounted`.
- **Set the value and props before the append.** The element's first render then already has the toolbar's theme and language buttons. It also shows the welcome screen only over an empty document.
- **Expect no editor until the host answers.** A host that never answers leaves the page without an editor: VS Code's `Loading...` placeholder stays, and IntelliJ's page stays blank.

### Replication

- **The shared store tracks no cursors.** It is `editor.getSharedStore({ mouseTracker: false, focusTracker: false })`.
- **Send local actions to worker and host.** Local actions go to the worker as `webviewReplicationCommand` and to the host as `hostSaveReplicationCommand`. The replica serializes the value the host writes (`packages/replication-store-worker/AGENTS.md`).
- **Apply the host's batch without echoing it.** The host's `webviewReplicationCommand` goes to the store and the worker, and is never sent back to the host.
- **Relay the replica's save exactly as sent.** The worker's `hostSaveValueCommand` goes to the host as the worker sent it, `changed` flag and `runtimeValue` included, whether the editor is read-only or not. VS Code decides from `changed` whether the tab turns dirty. What each field means: `packages/replication-store-worker/AGENTS.md` § What the Replica Posts.

### Imports

- **Give every import file type its own case.** The import `switch` exhausts the bridge's file-type union with `never`, so widening the union without a case is a build error. The host has already read the file, and an unhandled type would be lost silently.
- **Place a host import by its relationships.** A SQL, GraphQL, DBML or AML import goes to its setter with `placement: 'auto'` (`HOST_IMPORT`). That is the rule the editor's own file picker follows, so a file from the host's dialog lands laid out by its relationships.
- **Append only on `mode: 'append'`.** A `mode: 'append'` that the host relays back from an Import and Add goes to the setter together with the placement. A json file then goes to `setSchemaJSON` rather than `value`, so the file joins the document. Any other mode, or none, replaces the document.

### Appearance

- **Map the host's `'auto'` to the editor's `'system'`.** `'system'` is the theme builder's System. A theme update hands `'auto'` over as `'system'`, and a builder pick of System goes back to the host as `'auto'`. So a color picked under System saves `'auto'`.
- **Send what System shows through `setSystemAppearance`.** It goes out on every theme update and as soon as `mountWebview` runs, before the host answers. The value is the `systemAppearance` a theme update named last, when the host names one. IntelliJ does, because its page cannot see the IDE's look and feel. Otherwise the value is `resolveAppearance()`.
- **Resend it on every `refreshAppearance()`.** `refreshAppearance()` sends it again whatever the current appearance, since the theme builder can pick System at any time.

### Display Language

- **Map the display language's `'auto'` the same way.** `webviewUpdateLocaleCommand` hands `'auto'` to `setLocale` as `'system'` and any code as it is. A `changeLocale` pick from the editor's picker or palette goes back as `hostSaveLocaleCommand`, with System as `'auto'`.
- **Set the system locale before the locale.** The update's `systemLocale`, when the host names it, goes to `setSystemLocale` first, so a switch to `'auto'` shows the host's language at once. Both IDE hosts always name it.
- **Open the page in the saved language.** Both IDE hosts send the locale update before the value. An explicit `setLocale` holds whether or not `enableLocalePicker` is on, so the page opens in the saved language.
- **Type the locale mappings against both sides.** `toEditorLocale` / `toHostLocale` type the bridge's `LocaleSetting` against the parameter of the editor's `setLocale`. A code only one side has then fails this package's `tsc --noEmit` gate.

### Workers

- **Construct no worker in this package.** Take the replica worker from `createReplicationStoreWorker`. `vscode-webview`'s same-origin rewrite matches only the `erd-editor` and `replication-store-worker` dist files, and a url worker it misses fails that build.

## Testing Requirements

- **The `test` task runs the spec in happy-dom** (Making a Change, steps 3 and 4). The spec mocks `@dineug/erd-editor` and `@dineug/erd-editor-replication-store-worker`, and stubs `document.createElement('erd-editor')` with a node carrying spies. So it needs no Konva, shadow root or real worker; the bridge is real.
- **The one spec of every command lives here.** The two webview bundles have none of their own, so a new command or `WebviewHost` field gets its case in `src/mountWebview.test.ts`.
- **`vuerd-vscode`'s e2e drives the built VS Code bundle.** Its Extension Host spec `test/integration/agent-hub.test.ts` (`pnpm --filter vuerd-vscode e2e`, outside `pnpm test`) asserts this wiring end to end:
  - the `hostInitialCommand` that makes a webview ready;
  - a peer's batch arriving as `webviewReplicationCommand`;
  - the replica's `hostSaveValueCommand`, whose `changed` flag decides whether the tab turns dirty.

## Common Patterns

- **Two `Bridge`s, one per message source.** `bridge` takes host messages from `window`'s `message` event, and `workerBridge` takes the replica worker's. Handlers register up front and are collected with `Bridge.mergeRegister`, so `dispose` drops them in one call.

## Dependencies

### Internal

`@dineug/erd-editor`, `@dineug/erd-editor-replication-store-worker` and `@dineug/erd-editor-webview-bridge`, all `dependencies` and all external; the webview bundle resolves them (root § Working In This Directory, Externals).

### External

None at runtime. `happy-dom` (a devDependency) is the spec's environment.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
