<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-09-22 -->

# vscode-extension

## Purpose

The published VSCode extension (`vuerd-vscode`, publisher `dineug`) — the Node-side host. It registers the `editor.erd` custom editor for `*.erd`, `*.erd.json`, `*.vuerd` and `*.vuerd.json`, owns the document bytes, serves the bundle `vscode-webview` builds into `public/`, and answers the `webview-bridge` commands. `private: true`; published through `vsce`.

## Key Files

| File | Description |
| --- | --- |
| `package.json` | Also the extension manifest: `contributes` (custom editor, four `vuerd.*` commands, three `dineug.erd-editor.theme.*` settings, `dineug.erd-editor.agentHub.enabled`), `activationEvents`, `engines` |
| `src/extension.ts` | `activate`: the provider, the four `vuerd.*` commands and the document hub; `deactivate` awaits the hub's close, which VSCode waits for and a subscription's `dispose` does not get |
| `src/hub/` | The document hub for coding agents: a per-window pipe advertised by `~/.erd-editor/ide/<pid>.json`, built on `@dineug/erd-editor-agent-hub`. `io.ts` is the only file touching `node:fs` / `node:net` (`HubIo`); `server.ts` authenticates `hello` and hands every later request, path already authorized, to a `HubHandler` |
| `src/hub/documentRegistry.ts` | `DocumentRegistry` — open documents keyed by real path, their webviews (it owns `docToWebviewMap`), the ready set, joined peers, `observedVersion`, the active document; `deliverToPeer` / `injectToWebviews` are the only ways out |
| `src/hub/handlers.ts` | `createDocumentHandler(registry, io)` — the `HubHandler`: `listDocuments`, `openDocument`, `join`, `applyActions`, `leave`, `save`; `ERD_FILE_EXTENSIONS` (the custom editor selector, unit-asserted) builds `ERD_FILE_GLOB`, the activation glob, and refuses any other path with `badRequest` |
| `src/hub/joinWindow.ts` | The pure half of a join: the quiet wait for replica saves, `filterJoinQueue`, version helpers |
| `src/hub/readonlyUri.ts` | `isReadonlyUri` — the one readonly rule, used by `Editor.readonly` and the hub |
| `src/erd-editor-provider.ts`, `src/erd-document.ts` | The `CustomEditorProvider` (registers documents and panels with the `DocumentRegistry`, tracks the active panel) and the `CustomDocument` owning the bytes |
| `src/editor.ts` | Abstract `Editor` — the `Bridge`, `buildHtmlForWebview` (`{{extension-base-url}}`), `readonly` through `isReadonlyUri` |
| `src/erd-editor.ts` | `ErdEditor` — every host-side command: initial value, save, replication broadcast, import/export dialogs, theme push |
| `vite.config.ts` | CJS lib build to `dist/extension.js` (`ssr`, `ssr.noExternal: true`, `target: 'node20'`, only `vscode` and builtins external) plus `run.tasks`. `publicDir: false`, or Vite copies `public/` into `dist/` and the VSIX ships the webview twice |
| `tsconfig.unit.json` | The type gate over `src`, specs and the stub. `exclude: []` is load-bearing: inheriting the parent's typechecks zero specs and still exits 0 |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `test/mocks/` | The `vscode` stub the unit suite aliases in; `hubIo.ts`, the memory `HubIo` and socket pair the hub specs run on; `documentHarness.ts`, a registry + handler + provider building the real `ErdEditor` |
| `test/integration/` | Mocha specs for a live Extension Host over `test/fixtures/workspace/`; `erd-json-only/` holds the specs of the run over `test/fixtures/erd-json-only/` |
| `public/`, `dist/`, `out/` | Generated: the webview bundle (never edit), the extension bundle, the compiled integration specs |

## For AI Agents

### Working In This Directory

- `package.json` is the manifest. Two src ↔ manifest invariants are unit-asserted: `src/constants/viewType.test.ts` and the defaults check in `src/configuration.test.ts`.
- `engines.vscode` (`^1.90.0`) is the floor. `.vscode-test.mjs` derives its `minimum-supported` run from it; `build.target: 'node20'`, `@types/node` `^20` and `@types/vscode` `^1.90` are raised by hand with it.
- **`dist/extension.js` is a contract**: `main` is `./dist/extension`, so a `.cjs` emit never activates. Everything but `vscode` and builtins inlines because the VSIX ships no `node_modules` (`--no-dependencies`); a bare `require` left in the bundle fails activation.
- File support lives in two manifest places — `activationEvents` (`workspaceContains:**/*.{erd,vuerd,erd.json,vuerd.json}`) and `customEditors[].selector` — and their extension sets must stay equal: the hub's lock exists only once the extension is active.
- The hub never throws at the editor: every failure goes to `console.warn` under `[erd-editor hub]`, and `activate` starts it last, inside a `try`. It listens before its lock names the pipe and rewrites the lock to `hub: false` before closing the pipe. A hub that cannot listen still writes a `hub: false` lock (empty `pipe`), because a window with no lock invites headless writes over its open editors.
- **One way to a peer, one way into webviews.** Everything bound for a peer goes through `DocumentRegistry.deliverToPeer` (join queue, then the two filters: version at or below `snapshotVersion`, or no version at all); everything an agent sends webviews goes through `injectToWebviews` (ready webviews only, no exclusion). A webview that has not sent `hostInitialCommand` would wipe an injected batch with its initial value. Only batches queued before the snapshot is captured go through the filters; one queued between the capture and the timer that ends the window is not in the snapshot and goes out whole.
- A peer's batch is `applyActions`, refused unless the document has a ready webview and the peer joined that very `ErdDocument`; a webview never relays it back (it arrives tagged shared), so `injectToPeers` is the only way the other peers hear of it. `join` (500 ms cap) and `save` (2 s cap) first wait for the replica saves a change is owed, since `document.content` lags an edit by the replica's 200 ms debounce. A save reaching the hub sooner than 200 ms after a peer batch was sent cannot hold it and is not counted; a relay bounds nothing, since it can arrive after its replica saved. `join` captures at its cap regardless; `save` answers `saved: false` at its cap and writes nothing, as the bytes may lack the edit.
- `readonly` is the two schemes of `src/hub/readonlyUri.ts`, `git` and `conflictResolution`; `vscode.workspace.fs.isWritableFileSystem` was considered and not used. A git or merge view shares its file's path: the registry prefers the file, and with only the view open `join` says `readonly: true` and writes are refused, but `openDocument` neither answers from the view nor waits on it — it opens the file itself.
- Path authorization (`src/hub/authz.ts`) climbs past a path's missing tail only on `ENOENT` with `lstat` also `ENOENT`. A dangling symlink, any other `realpath` error, or a `..` behind a missing directory is refused as `outsideWorkspace`: `realpath` cannot see where a write through it would land.
- Unit specs must not reach `nodeHubIo` — pass the memory `HubIo`, or `vi.mock('@/hub/io')` as `extension.test.ts` does. The one exception is `src/hub/io.test.ts`, which runs `nodeHubIo` (and `authorizePath` on it) against a `mkdtemp` directory.
- State-changing commands must go through `dispatchBroadcast` over `docToWebviewMap` in `src/erd-editor.ts`, or one document open in two groups desynchronizes.
- New host behaviour goes on `ErdEditor`, not the provider, which only wires documents and panels into the registry; `bootstrapWebview` returns one `Disposable` releasing both the `mergeRegister` handle and the raw listeners.
- No new `vuerd.*` command: `extension.test.ts` and the Extension Host suite pin the registered set to the manifest's four.
- The four `vuerd.*` handlers are arrows, never bare references: `editor/title` passes more than the uri, and the second argument would land as `viewColumn`.
- `IMPORT_FILE_TYPES` is keyed by the bridge's import `type` union and feeds both the dialog filter and the extension check; the check is an alternation because `graphql` has three extensions.
- `capabilities.untrustedWorkspaces.supported` is `true` — never eval or execute document content.
- `build:vsce` / `publish:vsce` run a `vsce` no package.json declares; it must be on `PATH`.

### Testing Requirements

- Unit: `pnpm exec vp run --filter vuerd-vscode --fail-if-no-match test`. Call `resetVscodeMock()` in `beforeEach`; the stub is shared per file. `pnpm --filter vuerd-vscode typecheck` is the gate alone.
- Integration: `pnpm --filter vuerd-vscode e2e` builds, compiles `tsconfig.integration.json` to `out/`, then runs `stable` and `minimum-supported` over `test/fixtures/workspace/` and `erd-json-only` (stable only) over a folder whose one file is `sample.erd.json`, with its own specs (`xvfb-run -a` on Linux; `VSCODE_TEST_USER_DATA_DIR` shortens the IPC socket path). Those specs import only `vscode` and node builtins — the host runs the emitted JS unbundled, so `@/` does not resolve; `agent-hub.test.ts` speaks the hub's JSON lines by hand and restores the `sample.erd.json` it saves.
- `vscode.workspace.save(uri)` saves a custom editor document and clears its dirty flag: measured 2026-09-22 on VS Code 1.138.0, two tabs of one document went from dirty to clean within 1 ms of one call and the disk held the new table, so the hub's save ladder ends at its first rung there.
- The replica round trip runs in a real Extension Host: measured 2026-09-22, each of two webviews answered an injected batch with `hostSaveValueCommand` 209–239 ms later, `document.content` grew 900 → 1936 B, the tab turned dirty at 256 ms, and the `Tag.shared` batch never came back through `hostSaveReplicationCommand`.
- Build: `pnpm exec vp run --filter vuerd-vscode --fail-if-no-match build`; `dependsOn` builds `vscode-webview` first, which fills `public/`.
- Manual: F5 `Launch Extension` from this folder builds the dependencies once (`build:deps`), then watches the extension only — rebuild the webview after changing it.

## Dependencies

### Internal

`@dineug/erd-editor-webview-bridge` and `@dineug/erd-editor-agent-hub` (both inlined into `dist/`) and `@dineug/erd-editor-vscode-webview` (fills `public/`) — `devDependencies`, which the build's `dependsOn` still follows.

### External

`@vscode/test-cli` and `@vscode/test-electron` for the Extension Host suite.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
