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

| File                           | Description                                                                                                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/extension.ts`             | `activate()` — registers the provider and the four `vuerd.*` commands                                                                                                |
| `src/erd-editor-provider.ts`   | `ErdEditorProvider` — the `vscode.CustomEditorProvider` implementation (open/save/backup/revert, webview resolution)                                                 |
| `src/erd-document.ts`          | `ErdDocument implements vscode.CustomDocument` — holds file content as `Uint8Array`, with `onDidChangeContent` / `onDidDispose` events                               |
| `src/editor.ts`                | Abstract `Editor` base — owns a `Bridge`, the webview, the `docToWebviewMap`, and the `readonly` determination (true for `git` and `conflictResolution` URI schemes) |
| `src/erd-editor.ts`            | Concrete `ErdEditor extends Editor` — the whole host-side command wiring, theme sync, file import/export, and cross-webview broadcast                                |
| `src/configuration.ts`         | Reads/writes `dineug.erd-editor.theme.*` settings at the right `ConfigurationTarget` scope (folder → workspace → global)                                             |
| `src/constants/viewType.ts`    | `VIEW_TYPE = 'editor.erd'` — must match `contributes.customEditors[].viewType`                                                                                       |
| `src/utils/index.ts`           | Shared `textEncoder` / `textDecoder`                                                                                                                                 |
| `src/utils/googleAnalytics.ts` | Anonymous usage reporting (uses `macaddress` + `crypto-js` to derive a stable hashed client id)                                                                      |
| `package.json`                 | Also the extension manifest — `contributes`, `activationEvents`, `capabilities`                                                                                      |
| `webpack.config.js`            | Node-target bundle to `dist/extension`                                                                                                                               |
| `CHANGELOG.md`                 | User-facing release notes — update on every published change                                                                                                         |

## Manifest surface (`package.json` → `contributes`)

| Item          | Value                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ |
| Custom editor | `editor.erd`, default priority, for `*.erd`, `*.erd.json`, `*.vuerd`, `*.vuerd.json`       |
| Commands      | `vuerd.showSource`, `vuerd.showEditor`, `vuerd.showSourceToSide`, `vuerd.showEditorToSide` |
| Settings      | `dineug.erd-editor.theme.appearance` (auto/light/dark), `.grayColor`, `.accentColor`       |
| Activation    | `workspaceContains:**/*.{erd,vuerd}`                                                       |
| Trust         | `untrustedWorkspaces.supported: true`                                                      |
| Engine        | VSCode `^1.85.0`                                                                           |

## For AI Agents

### Working In This Directory

- **`package.json` is both a manifest and a package descriptor.** Editing `contributes` changes user-
  visible behaviour. `VIEW_TYPE` in `src/constants/viewType.ts` must equal the manifest `viewType`; the
  theme setting keys in `src/erd-editor.ts` (`THEME_KEYS`) must equal the manifest configuration keys.
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
- **Launch the extension host** (`packages/vscode-extension/.vscode/` holds the launch config) and
  verify the full matrix, because none of it is covered by automated tests:
  - open/edit/save a `.erd` file; confirm dirty state and undo behave;
  - the four `vuerd.*` commands and their editor-title icons;
  - the same file in two editor groups (broadcast sync);
  - a file opened from git history (readonly);
  - changing `dineug.erd-editor.theme.*` and `workbench.colorTheme`;
  - import/export file dialogs.
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

- `@types/vscode` ^1.85 — the host API
- `base64-arraybuffer` — binary payload decoding
- `crypto-js`, `macaddress`, `node-fetch` — anonymous analytics
- webpack 5 + `ts-loader`, TypeScript 5.4.5

<!-- MANUAL: -->
