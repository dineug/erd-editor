<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-16 -->

# vscode-extension (`vuerd-vscode`)

## Purpose

The published VSCode extension (**ERD Editor**, publisher `dineug`, v2.2.0) — the Node-side host
process. It registers a `CustomEditorProvider` for `*.erd`, `*.erd.json`, `*.vuerd`, and `*.vuerd.json`,
owns the document on disk, hosts the webview bundle from `@dineug/erd-editor-vscode-webview`, and
translates between VSCode APIs and the `@dineug/erd-editor-vscode-bridge` command protocol.

This is the only package that touches the `vscode` module.

## Key Files

| File                         | Description                                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/extension.ts`           | `activate()` — registers the provider and the four `vuerd.*` commands, each wrapped in an arrow so the extra arguments `editor/title` passes never land in `viewColumn`                                                                    |
| `src/erd-editor-provider.ts` | `ErdEditorProvider` — the `vscode.CustomEditorProvider` implementation (open/save/backup/revert, webview resolution), registered with `retainContextWhenHidden` and `supportsMultipleEditorsPerDocument`                                   |
| `src/erd-document.ts`        | `ErdDocument implements vscode.CustomDocument` — holds file content as `Uint8Array`, with `onDidChangeContent` / `onDidDispose` events                                                                                                     |
| `src/editor.ts`              | Abstract `Editor` base — owns a `Bridge`, the webview, the `docToWebviewMap`, `buildHtmlForWebview` (global `{{extension-base-url}}` substitution), and the `readonly` determination (true for `git` and `conflictResolution` URI schemes) |
| `src/erd-editor.ts`          | Concrete `ErdEditor extends Editor` — the whole host-side command wiring, theme sync, file import/export, and cross-webview broadcast                                                                                                      |
| `src/configuration.ts`       | `getTheme` / `saveTheme` — reads/writes `dineug.erd-editor.theme.*` at the narrowest scope already in use (folder → workspace → global)                                                                                                    |
| `src/constants/viewType.ts`  | `VIEW_TYPE = 'editor.erd'` — must match `contributes.customEditors[].viewType`                                                                                                                                                             |
| `src/utils/index.ts`         | Shared `textEncoder` / `textDecoder`                                                                                                                                                                                                       |
| `package.json`               | Also the extension manifest — `contributes`, `activationEvents`, `capabilities`, `engines`                                                                                                                                                 |
| `vite.config.ts`             | Vite library build to `dist/extension.js` (cjs, `build.ssr`, `target: 'node20'`, `publicDir: false`, `vscode` + node builtins external), plus this package's `run.tasks` — `build` and `test`, each fronted by a `tsc --noEmit` gate       |
| `README.md`                  | The marketplace description page — `.vscodeignore` does not exclude it, so it ships in the VSIX                                                                                                                                            |
| `CHANGELOG.md`               | User-facing release notes — update on every published change                                                                                                                                                                               |
| `.vscodeignore`              | What stays out of the VSIX — notably `src/**`, `test/**`, `out/**`, `.vscode-test*`, every tsconfig, `vitest.config.mts`, `vite.config.ts`, `coverage`, `.omc`, and `AGENTS.md`                                                            |
| `vitest.config.mts`          | Unit suite — aliases the `vscode` specifier to the stub, `@` to `src`; coverage thresholds are `perFile: 80`                                                                                                                               |
| `test/mocks/vscode.ts`       | The `vscode` stub. `EventEmitter`/`Uri`/`Disposable`/enums are real implementations; `workspace`/`window`/`commands` are `vi.fn()` spies                                                                                                   |
| `.vscode-test.mjs`           | Integration suite — `@vscode/test-cli` config. Runs the specs twice (`stable` and the `engines.vscode` floor) and relocates `--user-data-dir` off the unix-socket path limit                                                               |
| `tsconfig.json`              | The commonjs half — `rootDir: src`, `@/*` paths, `exclude: ["src/**/*.test.ts"]`, and no `moduleResolution` (TS7 removed `node10`; the value inferred from `module: commonjs` is the only one all three configs survive)                   |
| `tsconfig.unit.json`         | The type gate — `src` + the specs + the stub (esnext/bundler, `rootDir: .`, `exclude: []`), because `tsconfig.json` cannot read an ESM-only package's `exports` map. Run by `pnpm typecheck` and by both `run.tasks` commands              |
| `tsconfig.integration.json`  | Compiles `test/integration` to `out/` for the Extension Host, with `paths: {}` so no `@/` alias survives                                                                                                                                   |
| `.vscode/launch.json`        | "Launch Extension" — an `extensionHost` config whose `preLaunchTask` runs the `dev` script (`vp build --watch`)                                                                                |

## Subdirectories

| Directory                  | Purpose                                                                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/`                     | The whole extension host, with each unit spec beside its source as `*.test.ts`                                                                                                                                     |
| `test/mocks/`              | The in-memory `vscode` stand-in the Vitest suite resolves `vscode` to                                                                                                                                              |
| `test/integration/`        | Mocha specs for the real Extension Host — `extension.test.ts` (manifest, command registry, contributed configuration) and `custom-editor.test.ts` (tabs, `openWith`, to-the-side, two editors on one document)     |
| `test/fixtures/workspace/` | The folder VSCode opens for the integration run — `sample.erd` (a v3 document) and an empty `.vscode/settings.json` the theme-scope specs write into and reset                                                     |
| `assets/`                  | `erd-editor.png` (the manifest `icon`) and its svg source                                                                                                                                                          |
| `public/`                  | **Generated, gitignored** — `packages/vscode-webview/vite.config.ts` writes its bundle straight into here (`build.outDir: '../vscode-extension/public'`), and `buildHtmlForWebview` reads `index.html` out of it   |
| `dist/`                    | Generated — `extension.js` + source map, the manifest `main`. The name is a contract: `main` carries no extension, so a default `.cjs` means no activation                                                         |
| `out/`                     | Generated — `tsc -p tsconfig.integration.json` output, which is what `.vscode-test.mjs` points `files` at                                                                                                          |
| `.vscode/`                 | The local Extension Host launch config                                                                                                                                                                             |

## Manifest surface (`package.json` → `contributes`)

| Item            | Value                                                                                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom editor   | `editor.erd`, default priority, for `*.erd`, `*.erd.json`, `*.vuerd`, `*.vuerd.json`                                                                                                                                   |
| Commands        | `vuerd.showSource`, `vuerd.showEditor`, `vuerd.showSourceToSide`, `vuerd.showEditorToSide`                                                                                                                             |
| Menus           | Two contribution points: `editor/title` (each command carrying its to-the-side variant as `alt`, gated on `activeCustomEditorId`) and `commandPalette`, whose only job is to hide all four commands with `when: false` |
| Settings        | `dineug.erd-editor.theme.appearance` (auto/light/dark, default `dark`), `.grayColor` (default `slate`), `.accentColor` (default `indigo`)                                                                              |
| Config defaults | `files.associations` maps `*.erd` and `*.vuerd` to `json`, so `vuerd.showSource` opens JSON rather than plain text                                                                                                     |
| Activation      | `workspaceContains:**/*.{erd,vuerd}`                                                                                                                                                                                   |
| Trust           | `untrustedWorkspaces.supported: true`                                                                                                                                                                                  |
| Engine          | VSCode `^1.90.0`                                                                                                                                                                                                       |

## For AI Agents

### Working In This Directory

- **`package.json` is both a manifest and a package descriptor.** Editing `contributes` changes user-
  visible behaviour, and two src↔manifest invariants are guarded by the **unit** suite:
  `src/constants/viewType.test.ts` asserts `VIEW_TYPE === contributes.customEditors[0].viewType`, and
  `src/configuration.test.ts` asserts `getTheme()`'s defaults equal the contributed defaults.
  `test/integration/extension.test.ts` is a different check — it compares the manifest against its own
  hardcoded literals inside a live Extension Host, so it catches a manifest edit but not src drift.
- **`THEME_KEYS` is deliberately a superset of the contributed settings.** `src/erd-editor.ts` watches
  four keys — the three `dineug.erd-editor.theme.*` settings plus VSCode's built-in
  `workbench.colorTheme`, which this extension does not contribute. Nothing asserts this list against
  the manifest, so adding a contributed theme setting will not fail a test if you forget to watch it.
- **`engines.vscode: ^1.90.0` is a Node baseline, not just a UI one.** 1.90 is the first VSCode on
  Electron 29.4 / Node 20.9; 1.85–1.89 were Node 18. The floor exists to keep `@types/node` honest
  rather than to enable a specific call — the current source uses neither `fetch` nor
  `globalThis.crypto` (both arrived with the Node 20 host, and the code that would have needed them
  was removed along with usage reporting). Moving this field changes which Node APIs the host
  actually provides, so `@types/node` is pinned to
  the matching major (`^20`) — keep the two in step. `.vscode-test.mjs` parses the range and runs the
  whole suite against that floor, so lowering it is verified rather than asserted. `vite.config.ts`
  derives `build.target: 'node20'` from the same field (measured by running 1.90's own binary under
  `ELECTRON_RUN_AS_NODE=1`), so raising `engines.vscode` raises three values, not one. This package
  does **not** import the root `build-target.ts` `BROWSER_TARGET` the libraries and `app` share — it
  is a Node bundle, not a browser one.
- **The extension sends nothing over the network and has no telemetry.** That is a deliberate
  property, not an accident of the current code: it also means `activate()` needs no consent prompt
  and the extension stays honest under `untrustedWorkspaces`. Don't reintroduce reporting silently.
- **Untrusted workspaces are supported**, so the extension may run against files it should not trust.
  Never `eval` document content or execute anything derived from it.
- **`docToWebviewMap: Map<ErdDocument, Set<Webview>>`** is how one document open in several editor
  groups stays consistent — `ErdEditor` broadcasts to every _other_ webview for that document. Any new
  state-changing command must go through the broadcast path, or split views desynchronize. The set is
  populated in `resolveCustomEditor`, which subscribes to `onDidDispose` **before** awaiting
  `bootstrapWebview()` — that await reads `index.html` off disk, and a tab closed mid-bootstrap would
  otherwise leak both the webview entry and the editor's disposable. Keep that ordering.
- **Readonly is derived from the URI scheme** in `Editor#readonly` (`git`, `conflictResolution`). The
  `TODO` there about `isWritableFileSystem` is a known gap — extend it deliberately.
- **Theme is bidirectional**: the host pushes `webviewUpdateThemeCommand` on config change, and the
  webview's theme builder pushes back `hostSaveThemeCommand`, which `configuration.ts` writes at the
  most specific scope already in use. Don't hardcode `ConfigurationTarget.Global`, and don't test the
  inspected value for truthiness — `''`/`false`/`0` are set values (`!== undefined` is the check).
  A single `onDidChangeConfiguration` listener covers all of `THEME_KEYS`; one listener per key pushes
  the same theme several times for one event that reports several affected keys.
- **Import matching is extension-exact.** The pattern is built as ``new RegExp(`\\.${type}$`, 'i')`` —
  the escaped backslash has to survive the template literal or the dot becomes a wildcard and
  `sample.xjson` passes as JSON.
- **Binary payloads arrive base64-encoded** (`decode` from `base64-arraybuffer`) — export writes go
  through `vscode.workspace.fs`, defaulting to the first workspace folder and falling back to
  `os.homedir()`.
- The extension bundles with **Vite in library mode** targeting Node (`build.ssr`, `formats: ['cjs']`,
  `target: 'node20'`), on TypeScript 7.0.2. Rolldown strips types without reading them, so **the
  bundle step typechecks nothing** — the gate is explicit and lives in `run.tasks`: both the `build`
  and the `test` command are arrays whose first element is `tsc -p tsconfig.unit.json --noEmit`. That
  program covers `src` **and** the specs, which is new; the webpack build ran `ts-loader` with
  `onlyCompileBundledFiles: true`, so a type error in a `*.test.ts` used to go green. `pnpm typecheck`
  runs the same program standalone (CI's `check` job does), and `pnpm e2e:typecheck` is the gate for
  `test/integration`.
- ⚠️ **The task `input` lists are hand-maintained.** TypeScript 7's `tsc` is a Go binary, so Vite
  Task's automatic file tracking never sees what it read — every file the gate depends on has to be
  named in `input`, including the workspace deps' emitted `.d.ts`. Change `tsconfig.unit.json`'s
  `include` and the `input` must move with it, or the gate keeps replaying a cache hit against files
  it no longer covers. Only the dependency lines are enforced, by `scripts/check-task-inputs.mjs`
  (part of `pnpm check`).
- **`public/` is not ours to edit.** It is the build output of `@dineug/erd-editor-vscode-webview`,
  which writes straight into this package. That is also why `vite.config.ts` sets `publicDir: false`:
  Vite copies `publicDir` into `outDir`, and the default would duplicate the whole webview into
  `dist/` and from there into the VSIX. Build through the task graph
  (`pnpm exec vp run --fail-if-no-match --filter vuerd-vscode build`) — `dependsOn` is what builds the
  bridge and the webview first. ⚠️ `vp build` (the built-in) **ignores `run.tasks`**: no dependency
  build, no `tsc` gate. It reruns this package's bundle alone and leaves `public/` stale or missing,
  and that is also what `pnpm dev` (`vp build --watch`) does — fine for iterating on the host once
  `public/` is current, wrong as a build.
- ⚠️ **There is no `pnpm --filter vuerd-vscode build` and no `… test`.** Those two names belong to the
  tasks in `vite.config.ts`, and a `package.json` script sharing a task's name makes the whole task
  graph fail to load — so both scripts were deleted here. `vp run --filter vuerd-vscode <task>` is the
  only spelling, and flags go **before** the task name. Raw `vite` / `vitest` CLIs are not available
  either: the `vite` dependency is a pnpm-catalog alias for `@voidzero-dev/vite-plus-core`, so there
  is no `node_modules/.bin/vite`.
- Marked `private: true` in the workspace even though it is published — publishing goes through
  `vsce`, not `pnpm publish`. `vsce` is in no `package.json` and no lockfile entry, so `build:vsce` /
  `publish:vsce` resolve it from outside the workspace.

### Testing Requirements

- **Build**: `pnpm exec vp run --fail-if-no-match --filter vuerd-vscode build` — the task's `dependsOn`
  builds the bridge and the webview first, which is what fills `public/`. It lists all three dependency
  fields in `from` because every workspace edge in this repo is a devDependency; left at the default
  (`dependencies`) the graph comes back empty, and the result is not a failure but a green build against
  a stale `dist/`. ⚠️ `--fail-if-no-match` matters: a `--filter` that matches no package exits 0
  silently. `vscode:prepublish` now runs the same `vp run … build`, so packaging refreshes `public/`
  too — unlike the webpack era, where it reran this package's bundle only.
- `output: ['dist/**']` on the build task is not decoration: without it a cache hit replays the
  terminal output and restores nothing, leaving `dist/` as whatever the last real run left behind.

Tests come in two layers, and which one a change belongs in is decided by whether it needs the real
`vscode` module:

- **Unit (`vp run --filter vuerd-vscode test`, and part of `pnpm test` — `vp run -r test` — at the
  root).** Vitest 4 driven through Vite+, specs next to the source as `src/**/*.test.ts` — 135 specs
  across 8 files. They import `describe`/`it`/`expect`/`vi` from **`vite-plus/test`**, not from
  `vitest` — the root lint config makes `vite-plus/prefer-vite-plus-imports` an error, and
  `test/mocks/vscode.ts` takes its `vi` from there too. `vitest.config.mts` aliases the `vscode`
  specifier to `test/mocks/vscode.ts` because the bundle keeps `vscode` external and the module does
  not exist outside the host (the file stays `.mts` because this `package.json` is CommonJS). Types
  still come from `@types/vscode`, so a spec that needs a stub helper imports it by relative path
  (`import { resetVscodeMock } from '../test/mocks/vscode'`) and casts at the call boundary. Call
  `resetVscodeMock()` in `beforeEach` — the stub module is shared across a file. `pnpm test:coverage`
  enforces 80% per file, with nothing excluded — every `src` file is currently at 100%. `pnpm test:dev` is the watch mode. ⚠️ both of those are `vp test` built-ins,
  which bypass `run.tasks` and therefore run without the `tsc --noEmit` gate.
- **Integration (`pnpm e2e`, not part of `pnpm test`).** `@vscode/test-cli` downloads a real VSCode,
  launches it with this folder as `--extensionDevelopmentPath` and `test/fixtures/workspace` open,
  and runs Mocha specs from `test/integration/` inside the Extension Host — so `require('vscode')`
  is the genuine API. The script compiles `tsconfig.integration.json` to `out/` first; the Extension
  Host has no TS loader and no bundler, so those specs must import only from `vscode`/node builtins,
  never through the `@/` alias. 21 specs run twice — `stable` and the `engines.vscode` floor, and the
  floor is the only thing that catches an API used before it existed.
  The host loads `dist/extension.js` and `Editor#buildHtmlForWebview` reads `public/index.html`, so
  the extension **and** the webview must be built first; the `e2e` script chains that itself
  (`vp run --filter vuerd-vscode build && tsc -p tsconfig.integration.json && vscode-test`), and CI
  still runs the build as its own step so a cache miss shows up in its own log line. On Linux, wrap it
  in `xvfb-run -a`. Set `VSCODE_TEST_USER_DATA_DIR` to keep the profiles (and VSCode's IPC socket)
  somewhere short and collectable — CI does, and uploads `*/logs` from it on failure.
- Put an assertion in the integration layer when it depends on VSCode actually agreeing with us —
  manifest contributions really being registered, a command really existing, a setting really
  resolving to its contributed default, the custom editor really claiming `.erd`. The stub cannot
  falsify any of those, since it is our own idea of the API.
- Neither layer can see webview content: there is no API that returns it from the Extension Host, so
  everything past `postMessage` belongs to the Playwright suite in `packages/erd-editor`.
- Still **manual**, because neither layer reaches it — launch the extension host
  (`packages/vscode-extension/.vscode/launch.json`) and verify:
  - editing a `.erd` file end to end: dirty state, undo, save, and the webview actually rendering;
  - the same file in two editor groups stays in sync (the host-side broadcast is unit-tested and the
    two tabs are integration-tested, but the round trip through two live webviews is not);
  - a file opened from git history is readonly;
  - `dineug.erd-editor.theme.*` and `workbench.colorTheme` changes reaching the webview;
  - the import/export file dialogs.
- `pnpm build:vsce` produces the VSIX for a final install-from-file check.
- Update `CHANGELOG.md` and the `version` field for any user-visible change.

### Common Patterns

- Every disposable is pushed onto `context.subscriptions` or collected via `Bridge.mergeRegister`;
  `bootstrapWebview` returns one `vscode.Disposable` that releases both the bridge registrations and
  the raw `vscode.Disposable[]` listeners it opened.
- The `Editor` abstract class + `widthEditor(ErdEditor)` factory keeps provider wiring separate from
  editor behaviour — add new host features to `ErdEditor`, not to the provider.
- Command handlers registered against `editor/title` are always wrapped in an arrow that forwards only
  the uri; VSCode passes further arguments that a bare function reference would misread.

## Dependencies

### Internal

- `@dineug/erd-editor-vscode-bridge` — command protocol
- `@dineug/erd-editor-vscode-webview` — the webview bundle it serves, emitted into `public/`
- `@dineug/shared`

### External

- `@types/vscode` ^1.90 — the host API; `@types/node` ^20, pinned to the Node the oldest supported
  host ships
- `base64-arraybuffer` — binary payload decoding
- `vite` + `vite-plus` (catalog `0.2.9`; `vite` is a pnpm-catalog alias for
  `@voidzero-dev/vite-plus-core`) — bundler, task runner and test runner in one, with TypeScript 7.0.2
  pinned by the workspace `overrides`
- Vitest 4 + `@vitest/coverage-v8` — the unit suite, reached through `vite-plus/test`
- `@vscode/test-cli` + `@vscode/test-electron` + `@types/mocha` — the Extension Host suite

<!-- MANUAL: -->
