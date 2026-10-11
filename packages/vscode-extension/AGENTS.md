<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-10-11 -->

# vscode-extension

## Purpose

The published VS Code extension of ERD Editor (`vuerd-vscode`, publisher `dineug`), the Node-side host. It registers the `editor.erd` custom editor for `*.erd`, `*.erd.json`, `*.vuerd` and `*.vuerd.json`, owns the document bytes, serves the bundle `vscode-webview` builds into `public/` and answers the `webview-bridge` commands. Each window is also the document side of the hub coding agents join, built on `agent-hub-host`. The package is `private: true` and published through `vsce`. A change keeps `dist/extension.js` activating with only `vscode` and node builtins external, every panel of a document in step, and the runtime value out of the file.

## Making a Change

Deltas from root § Making a Change.

1. **Read the sibling files the change reaches** (root step 1). A hub change reads `packages/agent-hub-host/AGENTS.md`, which owns the connection side, and `packages/agent-hub/AGENTS.md`. A rule the other hubs apply alike reads `packages/obsidian-plugin/AGENTS.md` and `packages/intellij-plugin/AGENTS.md`. A bridge command reads `packages/webview-bridge/AGENTS.md`; the replica's save marking (`changed`) is in `packages/erd-editor/src/engine/AGENTS.md` § Values and `changed`.
2. **Change the manifest with its specs** (root step 2). Each src ↔ manifest invariant has a unit spec (Rules § Manifest). The Extension Host suite pins the locale entry by hand: its count, first values and `ko-KR`'s label (Rules § Manifest). It also keeps its own copies of the hub's protocol version (Testing Requirements § Extension Host suite).
3. **Run the `test` task** (root step 3), `tsc -p tsconfig.unit.json --noEmit` and then Vitest:

   ```sh
   pnpm exec vp run --filter vuerd-vscode --fail-if-no-match test
   ```

   CI's `hub-windows` job also runs this task on `windows-latest`, so keep the hub specs passing there (root § Testing Requirements).
4. **Run the coverage gate** (root step 4): `pnpm --filter vuerd-vscode --fail-if-no-match test:coverage`.
5. **Run root step 5.** This package's build task is in Testing Requirements § Build and debugging.
6. **Run the Extension Host suite** (root step 6) for behaviour a user or an agent sees in VS Code: `pnpm --filter vuerd-vscode e2e`, under `xvfb-run -a` on Linux. It is the only check of the hand-pinned locale entry and the hand-kept protocol version.
7. **Check a key change by hand.** No spec drives a key through VS Code. So a change to a key the element or the webview takes is checked over CDP (Rules § Find and Replace key).
8. **Update `README.md` for a user-visible change.** It is the Marketplace listing (root § Common Patterns).
9. **Report what ran** (root step 7): which Extension Host runs ran, and each hand check left out with the reason.

## Key Files

| File | Description |
| --- | --- |
| `package.json` | Also the extension manifest: `contributes` (custom editor, four `vuerd.*` commands, three `dineug.erd-editor.theme.*` settings, `dineug.erd-editor.locale`, `dineug.erd-editor.agentHub.enabled`, and `configurationDefaults`: `files.associations` and the revision schemes' `workbench.editorAssociations`), `activationEvents`, `engines` |
| `src/extension.ts` | `activate`: `DocumentRegistry.makeUnsafe(platform)`, the provider, the four `vuerd.*` commands and one `ManagedRuntime` of `extensionLive(registryLive(registry), documentHubLive(version))`. `deactivate` awaits that runtime's dispose under a 5 second timeout, then closes the registry. VS Code waits for `deactivate`, and not for a subscription's `dispose` |
| `src/hub/index.ts` | The three layers `activate` composes. `registryLive`: the registry over `agent-hub-host`'s native realpath. `documentHubLive`: `agent-hub-host`'s `documentHubLayer` given this window's handlers, `vscodeHost`, the registry as its documents, `nodeHubServices(version)` and `agent-hub-host`'s `nativeFileSystemLayer`, the `FileSystem` the handlers and the hub's layer both require. `extensionLive`: `agent-hub-host`'s `withDocumentHub`, which builds the registry first and the hub on it, and logs a hub that fails to build instead of failing the runtime |
| `src/hub/config.ts` | `isHubEnabled()` (Rules § Hub lifecycle) |
| `src/hub/vscodeHost.ts` | `vscodeHost`, this window as the hub's `HubHost`: `ide` `vscode`, `isHubEnabled`, the file-scheme workspace folders (`fileFolders`, which `openDocument` spells its editor under too), trust and the setting as the enabled event, folder changes as the folder event. `registryDocuments`, the registry as its `HubDocuments` |
| `src/hub/documentRegistry.ts` | `DocumentRegistry`: open documents keyed by real path, resolved on the effect `FileSystem` its `DocumentRegistry.layer` is given, those registered before that layer built resolved one at a time in arrival order. It holds their webviews (it owns `docToWebviewMap`), the ready set, joined peers, `observedVersion` and the active document. `deliverToPeer` / `injectToWebviews` are the only ways out |
| `src/hub/handlers.ts` | `createDocumentHandler(registry, fs)`, the `HubHandler` (`listDocuments`, `openDocument`, `join`, `applyActions`, `leave`, `save`), and its `HubHandlerService` layer. `spelledUnder`, the workspace folder and the names below it that `openDocument` joins into the uri it opens (Rules § Agent requests). `agent-hub-host`'s `ERD_FILE_EXTENSIONS` (the custom editor selector, unit-asserted) builds `ERD_FILE_GLOB`, the activation glob, and `assertErdFile` refuses any other path with `badRequest`. Every refusal the Obsidian plugin answers alike comes from `agent-hub-host`'s `documentRules.ts` constructors; only the read-only view ones are this host's own |
| `src/hub/readonlyUri.ts` | `READONLY_SCHEMES` and `isReadonlyUri`, the one read-only rule, used by `Editor.readonly` and the hub |
| `src/erd-editor-provider.ts`, `src/erd-document.ts` | The `CustomEditorProvider`, which registers documents and panels with the `DocumentRegistry` and tracks the active panel. The `CustomDocument`, which owns the bytes and, in memory only, the runtime value its replicas last saved (`runtimeValue`, `seedValue`) |
| `src/editor.ts` | Abstract `Editor`: the `Bridge`, `buildHtmlForWebview` (`{{extension-base-url}}`), `readonly` through `isReadonlyUri` |
| `src/erd-editor.ts` | `ErdEditor`, every host-side command: initial value, save, replication broadcast, import/export dialogs, theme push and save, display language push and save |
| `vite.config.ts` | CJS lib build to `dist/extension.js` (`ssr`, `ssr.noExternal: true`, `target: 'node22'`, `minify: true`, `sourcemap: false`, only `vscode` and builtins external) plus `run.tasks`. `publicDir: false`, since otherwise Vite copies `public/` into `dist/` and the VSIX ships the webview twice |
| `tsconfig.unit.json` | The type gate over `src`, specs and the stub. Keep its `exclude: []`: inheriting the parent's typechecks zero specs and still exits 0 |
| `.vscode-test.mjs` | The Extension Host runs (Testing Requirements § Extension Host suite) |
| `.vscodeignore` | Holds `dist/**/*.map` (Rules § Build and bundle) |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/hub/` | The document side of the hub coding agents join: the registry, the handlers and the host adapter, on effect layers. The connection side is `@dineug/erd-editor-agent-hub-host`'s, and `packages/agent-hub-host/AGENTS.md` holds its rules: the per-window pipe advertised by `~/.erd-editor/ide/<pid>.json`, serving `hello` and every later request, path authorization, the lock file, the node layers and the hub's lifecycle |
| `test/mocks/` | The `vscode` stub the unit suite aliases in. `hubLayers.ts`: the memory `FileSystem`, `HubEnvironment` and `HubListener` layers, the memory `Socket` pair the hub specs run on, `agent-hub-host`'s production layers over them with this window's adapter (`startMemoryHub`), and the registry over them, built (`createMemoryRegistry`) or not yet (`createPendingRegistry`). `documentHarness.ts`: a registry, handler and provider building the real `ErdEditor` |
| `test/integration/` | Mocha specs for a live Extension Host over `test/fixtures/workspace/`. `erd-json-only/` holds the specs of the run over `test/fixtures/erd-json-only/`. `linked/` holds those of the run over a linked copy of the workspace, where an agent's open and the Explorer's must land on one tab |
| `public/`, `dist/`, `out/` | Generated: the webview bundle (never edit it), the extension bundle, the compiled integration specs |

## Rules

### Manifest

- **Manifest invariants are unit-asserted.** `package.json` is the manifest, and each src ↔ manifest invariant has a spec:
  - `src/constants/viewType.test.ts`, which also holds the editor associations (§ Revisions and read-only views).
  - The defaults check in `src/configuration.test.ts`, which also holds the `dineug.erd-editor.locale` `enum` and `enumItemLabels` to `webview-bridge`'s `LocaleLabel`.
  - The commands and menu entries in `src/extension.test.ts`.
  - The `agentHub.enabled` key and default in `src/hub/config.test.ts`.
  - In `src/hub/autoOpen.test.ts`, `ERD_FILE_EXTENSIONS` against `customEditors[].selector` and `ERD_FILE_GLOB` against `activationEvents`.
- **The Extension Host pins the locales by hand.** The Extension Host's `test/integration/extension.test.ts` pins the parsed `dineug.erd-editor.locale` entry by hand: 26 values, `auto` first and the languages after it in their own names' order (`id-ID`, `de-DE`, `en`), and `ko-KR`'s label. That suite cannot import the bridge, so adding a language to `LocaleLabel` or removing one also changes this count, which only `pnpm --filter vuerd-vscode e2e` checks.
- **`engines.vscode` is the floor.** It is `^1.101.0`, the first release running on Node 22. `.vscode-test.mjs` derives its `minimum-supported` run from it. Raise `build.target: 'node22'`, `@types/node` `^22` and `@types/vscode` `^1.101` by hand with it, because nothing gates them.
- **Activation and the selector share one extension set.** File support lives in two manifest places: `activationEvents` (`workspaceContains:**/*.{erd,vuerd,erd.json,vuerd.json}`) and `customEditors[].selector`. Keep their extension sets equal, because the hub's lock exists only once the extension is active.
  - A glob of `**/*.{erd,vuerd}` alone leaves a folder holding only `.erd.json` / `.vuerd.json` files with the extension inactive and no lock.
  - The `erd-json-only` Extension Host run asserts that such a folder activates it.
- **Add no `vuerd.*` command.** `extension.test.ts` and the Extension Host suite pin the registered set to the manifest's four.
- **No file icon for ERD files**, an owner decision (2026-09-27). VS Code draws a file's icon only from the file icon theme or a contributed language's `icon`. An `erd` language would take `.erd.json` files out of JSON validation and formatting, so the owner dropped the icon. The IntelliJ plugin draws a file icon and the Obsidian plugin a tab icon all the same.
- **Never eval or execute document content.** `capabilities.untrustedWorkspaces.supported` is `true`, so the extension also runs in a workspace the user has not trusted.
- **Put `vsce` on `PATH`.** `build:vsce` / `publish:vsce` run a `vsce` that no package.json declares.

### Build and bundle

- **`dist/extension.js` is a contract.** `main` is `./dist/extension`, so a `.cjs` emit never activates. Everything but `vscode` and builtins inlines, because the VSIX ships no `node_modules` (`--no-dependencies`). A bare `require` left in the bundle fails activation.
- **Minified, and the VSIX carries no map.** Vite writes no map unless asked and leaves an `ssr` build unminified. So `build.minify: true` is what strips this bundle, and `build.sourcemap` is `false`.
  - `rolldownOptions.output.minify` on top emits the same bytes (sha256 equal, measured 2026-09-23), so only the one option is set.
  - The reason is effect, decided 2026-09-23 while `@dineug/erd-editor-agent-hub` was the only thing pulling it in. Inlined, it grew the unminified bundle about sixfold, mostly its JSDoc, and minifying shrank the VSIX too.
  - A map of the minified bundle measured about 18 times the bundle. The hub has run on effect since.
- **`.vscodeignore` keeps maps out structurally.** It holds `dist/**/*.map`. The build task's `tsc` step snapshots `dist/**` before `vp build` empties it. So a cache entry recorded while maps were on restores one beside the minified bundle on every later cache hit. `vsce` packs whatever sits in `dist/` (measured 2026-09-23: 17 files with such a map present).
- **Reproduce a shipped trace on a local build.** A stack trace from the Extension Host names `dist/extension.js` and a column on one of its few lines. Reproduce it with a local build that writes a map (Testing Requirements § Build and debugging) rather than read the shipped trace.

### Revisions and read-only views

- **A revision opens as text.** `configurationDefaults` maps `<scheme>:/**/*.{erd,erd.json,vuerd,vuerd.json}` to `default` in `workbench.editorAssociations`. It does so for each scheme under which a revision, a comparison side or a snapshot of an ERD file opens. VS Code matches such a key against `scheme:path` because the key holds a `/`, and merges it with a user's own associations. A diff takes the text editor once either side resolves to it.
- **Without the keys, revisions open as diagrams.** Measured 2026-10-11:
  - The minimum-supported release opens Source Control's diff of a change as two diagram viewers side by side.
  - Every release opens a revision `vscode.open` hands over (a deleted file, a file of a past commit) in the diagram viewer.
  - A newer release already diffs a custom editor's files as text.
- **The schemes are an owner decision (2026-10-11).**
  - VS Code's own: `conflictResolution` (the disk side of a save conflict), `showModifications` (Compare with Saved), `vscode-local-history`, `clipboardCompare*` (its number grows with each compare), `private` (the search replace preview), `chat-editing-text-model`, `chat-editing-snapshot-text-model` and `vscode-chat-code-block` (an agent's edit review), `vscode-edit-sessions` (Cloud Changes).
  - Its built-in extensions': `git`, `merge-conflict.conflict-diff`, `copilot-cli-readonly`, `copilot-pr`.
  - GitLens (`gitlens`, `gitlens-virtual`), GitHub Pull Requests (`review`, `pr`, `githubcommit`, `githubpr`, `gitpr`), GitLab Workflow (`gl-review`, `gitlab-remote`, `gitlab-snapshot`), GitHub Repositories (`github`, `github-enterprise`).
  - Claude Code's proposed-edit diff (`_claude_vscode_fs_left` / `_right`, `_claude_fs_left` / `_right`).
  - Git Graph (`git-graph`). Its revision path starts with no slash, and a key without a `/` is matched against the basename alone. So its key is `{git-graph:/**/*,git-graph:*}.{…}`.
  - SVN, Mercurial and Perforce were left out.
- **`viewType.test.ts` ties the keys to both lists.** `src/constants/viewType.test.ts` holds every key to the `customEditors[].selector` extensions and every `READONLY_SCHEMES` entry to a key. It keeps the writable workspace schemes out: `file`, `untitled`, `vscode-remote`, `vscode-vfs`, `vscode-userdata`, `vscode-agent-host`, `vsls`.
- **An untracked file still opens as a diagram.** A file Git does not track is a `file:` uri that Source Control opens with `vscode.open`, so it opens in the diagram editor.
- **`custom-editor.test.ts` pins four forms live.** It pins the `git`, `gitlens`, `git-graph` and `clipboardCompare*` forms on both runs. The `git` ones run on a scratch repository the built-in git extension serves. The minimum-supported release opens it outside the workspace only while `git.openRepositoryInParentFolders` is `always`, so the spec sets that for the open alone.
- **Read-only is a scheme of `READONLY_SCHEMES`.** `src/hub/readonlyUri.ts` lists the revisions and snapshots above that a file system serves read-only.
  - Only those, because the editor reads a document through `vscode.workspace.fs.readFile`, which fails with `ENOPRO` on a scheme only a text content provider serves.
  - `conflictResolution` is such a scheme, and stays for the day VS Code serves it as a file.
  - A writable scheme (`githubpr`, `gitpr`, Claude Code's) is never there. `vscode.workspace.fs.isWritableFileSystem` was considered and not used.
- **Keep every read-only scheme in `READONLY_SCHEMES`.** The association only sets what opens by default. Reopen Editor With… still opens a revision in the diagram editor, and so can a user's own association, so every read-only scheme stays in `READONLY_SCHEMES`.
- **A revision shares its file's path.** A git revision or the disk side of a save conflict shares its file's path: the registry prefers the file. With only the view open, `join` says `readonly: true` and writes are refused. `openDocument` neither answers from the view nor waits on it; it opens the file itself.

### Hub lifecycle

- **The hub serves only while enabled.** `isHubEnabled()` (`src/hub/config.ts`) holds while the window is trusted and `dineug.erd-editor.agentHub.enabled` (default `true`) is not off. It re-applies on `onDidGrantWorkspaceTrust` and on a change to that setting, the enabled event of `vscodeHost`. Off or untrusted, the window still writes a `hub: false` lock.
- **The lock covers file-scheme folders only.** A virtual folder guards no path on disk.
- **The connection side is `agent-hub-host`'s.** `packages/agent-hub-host/AGENTS.md` holds its rules: serving a connection and its frames, the reader and writer halves, `fromNetSocket`, path authorization with its `lstat` climb, and the native realpath every path the hub takes goes through. It also holds the lock file and stale sweep, the publisher and its `PUBLISH_WAIT`, and the one-runtime rule of `withDocumentHub`.
- **Supply only the document side.** This package supplies it through `HubHandlerService`, `HubHost` (`vscodeHost`) and `HubDocuments` (the registry). It never calls `releaseSync`, because `deactivate` awaits the runtime's dispose, which runs the hub's `close`.
- **The hub never throws at the editor.** Every failure goes to `console.warn` under `[erd-editor hub]`.
- **Documents can open before the hub starts.** `activate` makes the `DocumentRegistry` itself, with no IO, and registers the provider and the commands synchronously, so a document can open the moment it returns. Then it starts one `ManagedRuntime` of `extensionLive`.
  - Its registry layer builds first, cannot fail, and hands the registry its IO.
  - The hub's layer builds on it. When that fails, it is logged as `could not start the document hub`, and the registry serves every editor (`extension.test.ts` pins it).
  - The registry logs a publish that rejects.
- **`deactivate` catches every disposal cause.** It catches every cause of the runtime's disposal, then closes the registry. That settles whatever the registry still queues when the dispose interrupted its layer mid-build.
- **A stalled close is abandoned at 5 seconds.** A stalled task or a listen that never returns also holds the hub's close. `deactivate` abandons it at its 5 second timeout and leaves the lock for the stale sweep of a window that starts after this process is gone.
- **Keep the hub off merged layers.** The timeout can end the dispose only because `agent-hub-host`'s finalizer waits for that close interruptibly, effect running the rest of a scope's close uninterruptibly. That holds only while `documentHubLive` and `extensionLive` keep the hub off `Layer.merge`, `Layer.mergeAll` and array provides, whose forked close no timeout reaches (`packages/agent-hub-host/AGENTS.md` § Shutdown).

### Document registry

- **Registration is a queue the registry's layer drains.** `register` and `unregister` change what the editor side reads (`docToWebviewMap`, the entries) at once. They queue only their IO step: the native realpath of a new document, run on the `FileSystem` of `DocumentRegistry.layer` through a `FiberSet` of its scope.
  - Steps queued before that layer built wait for it, then run one at a time in arrival order. Each runs after the IO of the one before it and never after its publish, so the lock takes that backlog in the order it came.
  - A step that comes later runs at once, on its own. So a realpath that hangs on a stalled mount holds up only its own document. Its editor does not open until the realpath returns, so it takes no edit its lock entry would guard.
  - Each step is followed by a publish, and the lock lists only paths a step resolved.
  - Closing the layer interrupts the steps in flight and settles the rest without IO.
  - A realpath that fails or dies keys the document by the path given. A path that is not absolute, an untitled document's, always gets that key.
  - The platform, which decides how keys compare from the first call on, goes to `makeUnsafe`; only the realpath is IO.
- **A landed realpath wakes the open waits.** When a realpath lands and a webview of the document is ready, the registry hands the document to the open waits on its real path. The Kotlin registry's `land()` does the same. That is `wake`, which `onWebviewReady` calls too. `openCustomDocument` awaits `register`, so today no webview reports ready before its document's realpath. The wake only keeps an open from timing out should one ever do so.
- **`openCustomDocument` waits for the lock listing.** It awaits `register`, which never rejects and awaits the publisher the hub hands the registry. The publisher resolves at once while the hub is coming up. Once the hub is up it waits for the lock rewrite that lists the document, one second at most (`PUBLISH_WAIT`, `agent-hub-host`'s `src/services/DocumentHub.ts`).
  - So an agent resolving the file finds this window's lock before the editor takes an edit.
  - And a stalled task ahead of that rewrite holds no editor opening. `extension.test.ts` pins both.
- **Keys are the native realpath's.** `registryLive` provides the registry layer with `agent-hub-host`'s `nativeFileSystemLayer`, as every other path the hub takes. So a folder VS Code hands over in NFC whose name the disk holds in NFD, or a differently cased path on macOS, is keyed as the disk spells it. That is also how the MCP server resolves it. `src/hub/nodeRegistry.test.ts` holds both spellings to the disk's.
- **One way to peers, one into webviews.** Everything bound for a peer goes through `DocumentRegistry.deliverToPeer`: the join queue, then the two filters (a version at or below `snapshotVersion`, or no version at all). Everything an agent sends webviews goes through `injectToWebviews`: ready webviews only, with no exclusion.
  - Ready only, because a webview that has not sent `hostInitialCommand` would wipe an injected batch with its initial value.
  - Only batches queued before the snapshot is captured go through the filters. One queued between the capture and the timer that ends the window is not in the snapshot and goes out whole.

### Agent requests

- **`applyActions` needs a ready, joined document.** A peer's batch is `applyActions`, refused unless the document has a ready webview and the peer joined that very `ErdDocument`. A webview never relays it back, since it arrives tagged shared. So `injectToPeers` is the only way the other peers hear of it.
- **`join` and `save` wait for owed replica saves.** `join` (500 ms cap) and `save` (2 s cap) first wait for the replica saves a change is owed. They wait because `document.content` and `runtimeValue` lag an edit by the replica's 200 ms debounce.
  - Which saves count and when the wait ends is `agent-hub-host`'s `joinWindow.ts` (`packages/agent-hub-host/AGENTS.md` § Join window), with the webview as the view.
  - This host feeds it the ready set with every change, and each save through `onValueSaved`, which carries the webview whose replica saved. It feeds each closed panel through `removeWebview`'s `dropRecipient`.
  - `join` captures at its cap regardless. `save` answers `saved: false` at its cap and writes nothing, since the bytes may lack the edit.
- **`openDocument` opens the editor the Explorer opens.** VS Code keys a custom editor by its uri. The Explorer spells a file under its workspace folder as the user opened that folder (a `subst` or mapped drive, a symlink or junction), while a handler gets the real path.
  - Opening `Uri.file(realPath)` gave a second tab, registered as a second document on the same real path. The tab agents did not edit could then save stale bytes over the other's. Measured 2026-09-27 on VS Code 1.139.1: an agent's saved table was lost that way.
  - So it opens the registered document's own uri. Else it takes the real path's names below the deepest file-scheme workspace folder whose real path holds it (the first on a tie).
  - It joins those onto that folder's uri with `Uri.joinPath`, as the Explorer builds its uris (`spelledUnder`, over `agent-hub`'s `longestPrefixIndex` and `toSegments`). Else it opens the real path.
  - Results and refusals still name the real path, whichever uri the editor opens.
  - The IntelliJ plugin's `openInEditor` applies the same rule (`packages/intellij-plugin/AGENTS.md`).
- **Take the names from the native realpath.** They carry the disk's letter case, which the Explorer lists too. A name in another case opens a second tab, so the names never come from the path an agent typed.
- **Cap the folder realpaths at 1 s.** The folders' realpaths run concurrently before the ready wait starts and are capped at 1 s (`FOLDER_REALPATH_CAP_MS`), after which the real path opens. So a stalled mount costs that second and never the 5 s wait.
- **Two spellings stay apart.**
  - A link inside a folder to elsewhere in the same folder opens under the target's spelling. So the user opening it through the link still gets a second tab.
  - A file reachable both locally and through a loopback mapped drive (`N:` → `\\localhost\C$\…`) has two real paths. The lock keeps the one the folder was opened by. The MCP server refuses the other spelling with `invalidPath`, naming the window's path (`packages/mcp-server/AGENTS.md` § Windows paths).

### Panels and saves

- **Read no `panel.webview` in `onDidDispose`.** VS Code marks the panel disposed before firing the event, and the getter throws `Webview is disposed` (seen on 1.138.0). That once left a closed split-view panel counted ready, so `save` waited on a replica that no longer existed.
  - `removeWebview` finds the webview by its panel, and the stub's panel throws the same way.
  - It then calls `dropRecipient` (`agent-hub-host`'s `joinWindow.ts`) for that webview. The closed replica's save never comes, so a pending change whose remaining replicas already saved settles right then, not at the next edit.
- **A `changed` false save leaves the tab clean.** The replica sends a value after every change action, a change to a locked setting the file keeps nothing of included (a scroll, a zoom, a tab switch). It marks the one that left its value as it was (`packages/erd-editor/src/engine/AGENTS.md` § Values and `changed`).
  - `ErdEditor` calls `ErdDocument.update`, whose `onDidChangeContent` is the tab's dirty flag, only for `changed` true. So `content` keeps the bytes it had, the file's own after an open.
  - The runtime value the save carries replaces `runtimeValue` all the same (next bullet). `onValueSaved` still runs for every save, since the hub's quiet wait counts it.
  - The flag decides, not a byte comparison with `content`, because a file an older release or a hand edit wrote need not equal the replica's value.
  - A read-only view (`Editor.readonly`, a scheme of `READONLY_SCHEMES`: a revision, a snapshot or the disk side of a save conflict) skips `update` whatever `changed` says. Otherwise a scroll in a file that saves it would dirty a tab no save can write back. It still reports to `onValueSaved` (`erd-editor.test.ts`).
  - The Extension Host suite (`agent-hub.test.ts`) pins it live on a file without the origin and on a new empty file. A peer's scroll and zoom leave the tab clean and the bytes as they were, and a table after them dirties it. The empty file's save writes a new document, every lock on, at origin 0,0 and zoom 1.
- **Two forms of the document.** Every `hostSaveValueCommand` carries the file form (`value`) and the runtime value the replica holds (`runtimeValue`: removed entities, column sequences, z-index, widths and anchors kept).
  - `content` takes the file form only, and only for `changed` true in a writable view. Save, save as, backup and the dirty flag read `content` alone, so the runtime value never reaches a file.
  - `ErdDocument.runtimeValue` takes every save's runtime value, `changed` false and read-only views included, and lives in memory only.
  - `seedValue()` (`runtimeValue ?? content`) is what `hostInitialCommand` hands a second panel or a reloaded webview. It is also what the registry's `join` captures in the tick it reads `observedVersion`.
  - Seed from it, not from the file form. A peer seeded from the file form that hears an undo of a removal would bring back a nameless entity with no columns. Its replica would then save that entity.
  - A document no editor has open joins from the file. A revert reloads `content` alone and leaves `runtimeValue`, since it reloads no webview.
  - `src/runtime-value.test.ts` runs that undo through `@dineug/erd-editor`'s peer stores and holds every write path to the file form.
- **Broadcast state changes over `docToWebviewMap`.** State-changing commands go through `dispatchBroadcast` over `docToWebviewMap` in `src/erd-editor.ts`, or one document open in two groups desynchronizes. `dispatchBroadcast` skips the webview a command came from.
  - The one exception is the hub. An agent's batch goes through `DocumentRegistry.injectToWebviews` to every ready webview, since no webview sent it.

### Theme and display language

- **Other panels follow a pick through the setting.** A pick in one panel (`hostSaveThemeCommand`, `hostSaveLocaleCommand`) only writes the setting and sends nothing through `dispatchBroadcast`. It writes to the narrowest scope that already holds it (`getConfigurationScope`). Each `ErdEditor`'s one `onDidChangeConfiguration` listener then pushes the new value to its own webview, the picking one included.
- **The locale update carries `systemLocale`.** It carries `vscode.env.language` as `systemLocale` every time, which `auto` follows. `getLocale` reads a value settings.json holds that names none of the bridge's codes as `auto`, as the IntelliJ and Obsidian plugins do.
- **The appearance defaults to `auto`.** `dineug.erd-editor.theme.appearance` defaults to `auto`, as the IntelliJ and Obsidian settings do, so a diagram follows a light VS Code theme instead of opening dark. A value the user stored stays as it is, and `src/configuration.test.ts` and the Extension Host's `extension.test.ts` pin the default.
- **The handshake order is fixed.** The handshake sends theme, locale, readonly and value in that order (`erd-editor.test.ts`).

### Commands and imports

- **Write the `vuerd.*` handlers as arrows.** Never pass bare references, because `editor/title` passes more than the uri and the second argument would land as `viewColumn`.
- **`IMPORT_FILE_TYPES` feeds the dialog and the check.** It is keyed by the bridge's import `type` union and feeds both the dialog filter and the extension check. The check is an alternation because `graphql` has three extensions.
- **Return the import `mode` as it came.** The request's `mode` goes back on `webviewImportFileCommand` unchanged, and only when the page named one.

### Find and Replace key

- **The element takes `Ctrl`/`Cmd`+`F`, not VS Code.** VS Code's find widget stays off in the webview (no `enableFindWidget`, pinned by `src/erd-editor-provider.test.ts`), and the manifest contributes no keybinding.
  - On every tab the element binds `Ctrl`/`Cmd`+`F` to its own Find and Replace, bringing the ERD tab up, and stops the keydown. So the webview never hands it to the workbench.
  - While the diff viewer, time travel or the automatic placement preview covers the ERD tab, the element lets the keydown go on, and the workbench gets it.
- **Only a hand check covers the key.** No spec drives a key through VS Code. It was checked by hand on 2026-09-30 on VS Code 1.139.1, the keys sent over CDP to a throwaway window (`--remote-debugging-port`, its own `--user-data-dir`), which skips the native menu.
  - On the ERD tab, `Cmd`+`F` opened the panel and took what was typed next. The keydown never reached the webview document's window.
  - That window holds VS Code's host script (`pre/index.html`, `handleInnerKeydown`), which listens in the bubble phase to prevent a find key and forward every key to the workbench.
  - On the Schema SQL tab, then left to the host, the key reached that window, which prevented it, and nothing opened.
  - The element has taken the key on its other tabs too since 2026-10-03, which no one has checked in VS Code. A key pressed on a real keyboard, which the native menu may also see, was not checked.

## Testing Requirements

### Unit

- **Run the `test` task.** `pnpm exec vp run --filter vuerd-vscode --fail-if-no-match test`. `pnpm --filter vuerd-vscode typecheck` runs the type gate alone.
- **Call `resetVscodeMock()` in `beforeEach`.** The stub is shared per file.
- **Build the memory layers of `test/mocks/hubLayers.ts`.** Unit specs never provide the node layers: `agent-hub-host`'s `hubEnvironmentLayer`, `hubListenerLayer`, `nativeFileSystemLayer` and `nodeHubServices`, `NodeFileSystem.layer`, or `registryLive` and `documentHubLive`, which carry them. Those bind a socket and write a lock under the real home directory.
  - The one exception is `src/hub/nodeRegistry.test.ts`, which runs the registry over `registryLive` against a `mkdtemp` directory and builds no hub.
- **The stub spells drive paths like VS Code.** Its `Uri.fsPath` gives `c:\…`: the letter lowercased, backslashes on Windows. So a key taken as given compares with what VS Code hands over there. Every other path, the POSIX paths the memory specs use included, comes back as `Uri.path`.

### Extension Host suite

- **`pnpm --filter vuerd-vscode e2e` runs four runs.** It builds, compiles `tsconfig.integration.json` to `out/`, then runs each of these with its own specs:
  - `stable` and `minimum-supported` over `test/fixtures/workspace/`.
  - `erd-json-only` (stable only) over a folder whose one file is `sample.erd.json`.
  - `linked-folder` (stable only) over a link, a junction on Windows, to a copy of `test/fixtures/workspace/` that `.vscode-test.mjs` makes afresh in the temp folder.
- **Run it under `xvfb-run -a` on Linux.** `VSCODE_TEST_USER_DATA_DIR` shortens the IPC socket path.
- **Import only `vscode` and node builtins.** That holds for the fake peers of `agent-hub.test.ts` too, because the host runs the emitted JS unbundled and `@/` does not resolve. `agent-hub.test.ts` speaks the hub's JSON lines by hand over `net` and restores the `sample.erd.json` it saves.
- **Bump both hand-kept `PROTOCOL_VERSION` copies.** Both hand-written peers, `agent-hub.test.ts` and `linked/linked-folder.test.ts`, keep their own `PROTOCOL_VERSION`, because these specs cannot import `agent-hub`'s `HUB_PROTOCOL_VERSION`. A bump there must change both by hand. Otherwise the hub refuses every `hello` with the mismatch message, and only this suite, which runs outside `pnpm test`, shows it.
- **Compare paths through `fs.realpathSync.native`.** The specs compare paths through `fs.realpathSync.native`, the realpath the hub keys by: the JS one keeps the drive-letter case and the 8.3 short names it is given. The one exception is `custom-editor.test.ts`'s git revision block, which resolves its scratch repository with the JS one and compares it with the git extension's `rootUri.fsPath`.
- **`vscode.workspace.save(uri)` saves a custom document.** It saves a custom editor document and clears its dirty flag. Measured 2026-09-22 on VS Code 1.138.0: two tabs of one document went from dirty to clean within 1 ms of one call, and the disk held the new table. So the hub's save ladder ends at its first rung on stable.
- **Replica round trip, measured in a real host.** Measured 2026-09-22: each of two webviews answered an injected batch with `hostSaveValueCommand` 209–239 ms later. `document.content` grew 900 → 1936 B, and the tab turned dirty at 256 ms. The `Tag.shared` batch never came back through `hostSaveReplicationCommand`.
- **`agent-hub.test.ts` prints its timings.** It prints one `[agent-hub e2e] vscode <version> <spec>:` line per timed spec: `one peer` (`join`, `applyActions`, `applyToDirty`, `save`) and `two peers` (`applyToOtherPeer`). `applyToDirty` is the replica round trip that `join` and `save` wait on, about 210–225 ms on 1.138.0, against their 500 ms and 2 s caps.

### Build and debugging

- **Build with the `build` task.** `pnpm exec vp run --filter vuerd-vscode --fail-if-no-match build`; its `dependsOn` builds `vscode-webview` first, which fills `public/`.
- **The bundle requires only `vscode` and builtins.** It carries no `ws`, no `undici` and no dynamic `import(`.
- **Nothing gates the bundle's size.** Two minified spikes, measured 2026-09-23, set what to expect of it. One was a minimal `Layer.effect` + `ManagedRuntime` + one `Schema.Struct` extension. The other was shaped like this hub (Stream, Queue, Deferred, a Socket adapter, Ndjson, a tagged error, a Logger). The bundle, measured 2026-10-11, sits above the hub-shaped spike and inside 1.5 times either one.
- **Debug with F5 `Launch Extension`.** From this folder it builds the dependencies once (the `build:deps` task of `.vscode/tasks.json`), then watches the extension only, so rebuild the webview after changing it.
  - The watch build is the shipping one, so it is minified and mapless too. `launch.json`'s `outFiles` still finds `dist/extension.js`, but a breakpoint belongs in it, not in `src/`.
  - For a debugging session set `build.sourcemap` to `true`, and do not commit that.

## Common Patterns

- **New host behaviour goes on `ErdEditor`.** The provider only wires documents and panels into the registry.
- **`bootstrapWebview` returns one `Disposable`.** It releases both the `mergeRegister` handle and the raw listeners.

## Dependencies

### Internal

- `@dineug/erd-editor-webview-bridge`, `@dineug/erd-editor-agent-hub` and `@dineug/erd-editor-agent-hub-host`: all inlined into `dist/`. `agent-hub-host` keeps `agent-hub` a bare import, so one copy of `agent-hub` serves this package and `agent-hub-host` (root § Working In This Directory, Externals decide what ships).
- `@dineug/erd-editor-vscode-webview`: fills `public/`.
- `@dineug/erd-editor`: unit specs only. Its `peer.js` plays the editors of `src/runtime-value.test.ts`, and nothing `src/extension.ts` reaches imports it, so nothing of it ships.
- All five are `devDependencies`, which the build's `dependsOn` still follows.

### External

- `effect` (core modules from `effect`; `Socket` from `effect/socket` in `test/mocks/` only) and `@effect/platform-node`: `devDependencies` from the root catalog's exact pin, inlined into `dist/extension.js`. They are the same copies `@dineug/erd-editor-agent-hub` and `@dineug/erd-editor-agent-hub-host` name as their peers.
- Nothing here imports `@effect/platform-node`. It is listed for `agent-hub-host`, whose `NodeFileSystem` the bundle inlines, imported by module path because the barrel needs `redis`, which nothing here installs.
- Effect imports follow root § Dependencies, External. `src/hub/imports.test.ts` holds all of `src/` and `test/` to them.
- `@vscode/test-cli` and `@vscode/test-electron`, for the Extension Host suite.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
