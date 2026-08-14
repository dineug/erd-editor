<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-08 -->

# vscode-extension (`vuerd-vscode`)

## Purpose

The published VSCode extension (**ERD Editor**, publisher `dineug`, v2.1.1) — the Node-side host
process. It registers a `CustomEditorProvider` for `*.erd`, `*.erd.json`, `*.vuerd`, and `*.vuerd.json`,
owns the document on disk, hosts the webview bundle from `@dineug/erd-editor-vscode-webview`, and
translates between VSCode APIs and the `@dineug/erd-editor-vscode-bridge` command protocol.

This is the only package that touches the `vscode` module.

## Key Files

| File                         | Description                                                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/extension.ts`           | `activate()` — registers the provider and the four `vuerd.*` commands                                                                                                |
| `src/erd-editor-provider.ts` | `ErdEditorProvider` — the `vscode.CustomEditorProvider` implementation (open/save/backup/revert, webview resolution)                                                 |
| `src/erd-document.ts`        | `ErdDocument implements vscode.CustomDocument` — holds file content as `Uint8Array`, with `onDidChangeContent` / `onDidDispose` events                               |
| `src/editor.ts`              | Abstract `Editor` base — owns a `Bridge`, the webview, the `docToWebviewMap`, and the `readonly` determination (true for `git` and `conflictResolution` URI schemes) |
| `src/erd-editor.ts`          | Concrete `ErdEditor extends Editor` — the whole host-side command wiring, theme sync, file import/export, and cross-webview broadcast                                |
| `src/configuration.ts`       | Reads/writes `dineug.erd-editor.theme.*` settings at the right `ConfigurationTarget` scope (folder → workspace → global)                                             |
| `src/constants/viewType.ts`  | `VIEW_TYPE = 'editor.erd'` — must match `contributes.customEditors[].viewType`                                                                                       |
| `src/utils/index.ts`         | Shared `textEncoder` / `textDecoder`                                                                                                                                 |
| `package.json`               | Also the extension manifest — `contributes`, `activationEvents`, `capabilities`                                                                                      |
| `webpack.config.js`          | Node-target bundle to `dist/extension`                                                                                                                               |
| `CHANGELOG.md`               | User-facing release notes — update on every published change                                                                                                         |
| `vitest.config.mts`          | Unit suite — aliases the `vscode` specifier to the stub, `@` to `src`; coverage thresholds are `perFile: 80`                                                         |
| `test/mocks/vscode.ts`       | The `vscode` stub. `EventEmitter`/`Uri`/`Disposable`/enums are real implementations; `workspace`/`window`/`commands` are `vi.fn()` spies                             |
| `.vscode-test.mjs`           | Integration suite — `@vscode/test-cli` config; also relocates `--user-data-dir` off the unix-socket path limit                                                       |
| `tsconfig.unit.json`         | Typechecks `src` + the stub (ESM/bundler resolution, since `tsconfig.json` is commonjs/node10 for webpack)                                                           |
| `tsconfig.integration.json`  | Compiles `test/integration` to `out/` for the Extension Host, with no `@/` alias                                                                                     |

## Manifest surface (`package.json` → `contributes`)

| Item          | Value                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ |
| Custom editor | `editor.erd`, default priority, for `*.erd`, `*.erd.json`, `*.vuerd`, `*.vuerd.json`       |
| Commands      | `vuerd.showSource`, `vuerd.showEditor`, `vuerd.showSourceToSide`, `vuerd.showEditorToSide` |
| Settings      | `dineug.erd-editor.theme.appearance` (auto/light/dark), `.grayColor`, `.accentColor`       |
| Activation    | `workspaceContains:**/*.{erd,vuerd}`                                                       |
| Trust         | `untrustedWorkspaces.supported: true`                                                      |
| Engine        | VSCode `^1.90.0`                                                                           |

## For AI Agents

### Working In This Directory

- **`package.json` is both a manifest and a package descriptor.** Editing `contributes` changes user-
  visible behaviour. `VIEW_TYPE` in `src/constants/viewType.ts` must equal the manifest `viewType`; the
  theme setting keys in `src/erd-editor.ts` (`THEME_KEYS`) must equal the manifest configuration keys.
- **`engines.vscode: ^1.90.0` is a Node baseline, not just a UI one.** 1.90 is the first VSCode on
  Electron 29.4 / Node 20.9; 1.85–1.89 were Node 18. That is what makes global `fetch` and
  `globalThis.crypto` usable here without a polyfill (the latter is unflagged only from Node 19).
  Moving this field changes which Node APIs the host actually provides, so `@types/node` is pinned to
  the matching major (`^20`) — keep the two in step.
- **The extension sends nothing over the network and has no telemetry.** That is a deliberate
  property, not an accident of the current code: it also means `activate()` needs no consent prompt
  and the extension stays honest under `untrustedWorkspaces`. Don't reintroduce reporting silently.
- **Untrusted workspaces are supported**, so the extension may run against files it should not trust.
  Never `eval` document content or execute anything derived from it.
- **`docToWebviewMap: Map<ErdDocument, Set<Webview>>`** is how one document open in several editor
  groups stays consistent — `ErdEditor` broadcasts to every _other_ webview for that document. Any new
  state-changing command must go through the broadcast path, or split views desynchronize.
- **Readonly is derived from the URI scheme** in `Editor#readonly` (`git`, `conflictResolution`). The
  `TODO` there about `isWritableFileSystem` is a known gap — extend it deliberately.
- **Theme is bidirectional**: the host pushes `webviewUpdateThemeCommand` on config change, and the
  webview's theme builder pushes back `hostSaveThemeCommand`, which `configuration.ts` writes at the
  most specific scope already in use. Don't hardcode `ConfigurationTarget.Global`.
- **Binary payloads arrive base64-encoded** (`decode` from `base64-arraybuffer`) — export writes go
  through `vscode.workspace.fs`, defaulting to the OS home/desktop path via `os` + `path`.
- The extension bundles with **webpack targeting Node** and `ts-loader` (not swc, unlike the webviews),
  on TypeScript 5.4.5. `pnpm build:vsce` packages with `--no-dependencies` because everything is bundled.
- Marked `private: true` in the workspace even though it is published — publishing goes through
  `vsce`, not `pnpm publish`.

### Testing Requirements

- `pnpm --filter vuerd-vscode build`. Note `vscode:prepublish` runs `pnpm build`, so packaging always
  rebuilds.

Tests come in two layers, and which one a change belongs in is decided by whether it needs the real
`vscode` module:

- **Unit (`pnpm test`, part of `pnpm test` at the root).** Vitest, specs next to the source as
  `src/**/*.test.ts`. `vitest.config.mts` aliases the `vscode` specifier to `test/mocks/vscode.ts`
  because webpack declares `vscode` as an external and the module does not exist outside the host.
  Types still come from `@types/vscode`, so a spec that needs a stub helper imports it by relative
  path (`import { resetVscodeMock } from '../test/mocks/vscode'`) and casts at the call boundary.
  Call `resetVscodeMock()` in `beforeEach` — the stub module is shared across a file.
  `pnpm test:coverage` enforces 80% per file, with nothing excluded — every `src` file is
  currently at 100%.
- **Integration (`pnpm e2e`, not part of `pnpm test`).** `@vscode/test-cli` downloads a real VSCode,
  launches it with this folder as `--extensionDevelopmentPath` and `test/fixtures/workspace` open,
  and runs Mocha specs from `test/integration/` inside the Extension Host — so `require('vscode')`
  is the genuine API. The script compiles `tsconfig.integration.json` to `out/` first; the Extension
  Host has no TS loader and no bundler, so those specs must import only from `vscode`/node builtins,
  never through the `@/` alias. **`nx build vuerd-vscode` must have run**, because the host loads
  `dist/extension.js` and `Editor#buildHtmlForWebview` reads `public/index.html`. On Linux, wrap it
  in `xvfb-run -a`.
- Put an assertion in the integration layer when it depends on VSCode actually agreeing with us —
  manifest contributions really being registered, a command really existing, a setting really
  resolving to its contributed default, the custom editor really claiming `.erd`. The stub cannot
  falsify any of those, since it is our own idea of the API.
- Still **manual**, because neither layer reaches it — launch the extension host
  (`packages/vscode-extension/.vscode/` holds the launch config) and verify:
  - editing a `.erd` file end to end: dirty state, undo, save, and the webview actually rendering;
  - the same file in two editor groups stays in sync (the host-side broadcast is unit-tested, but
    the round trip through two live webviews is not);
  - a file opened from git history is readonly;
  - `dineug.erd-editor.theme.*` and `workbench.colorTheme` changes reaching the webview;
  - the import/export file dialogs.
- `pnpm build:vsce` produces the VSIX for a final install-from-file check.
- Update `CHANGELOG.md` and the `version` field for any user-visible change.

### Common Patterns

- Every disposable is pushed onto `context.subscriptions` or collected via `Bridge.mergeRegister`.
- The `Editor` abstract class + `widthEditor(ErdEditor)` factory keeps provider wiring separate from
  editor behaviour — add new host features to `ErdEditor`, not to the provider.

## Dependencies

### Internal

- `@dineug/erd-editor-vscode-bridge` — command protocol
- `@dineug/erd-editor-vscode-webview` — the webview bundle it serves
- `@dineug/shared`

### External

- `@types/vscode` ^1.90 — the host API
- `base64-arraybuffer` — binary payload decoding
- webpack 5 + `ts-loader`, TypeScript 5.4.5

<!-- MANUAL: -->
