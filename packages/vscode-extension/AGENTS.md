<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-09-19 -->

# vscode-extension

## Purpose

The published VSCode extension (`vuerd-vscode`, publisher `dineug`) — the Node-side host. It registers the `editor.erd` custom editor for `*.erd`, `*.erd.json`, `*.vuerd` and `*.vuerd.json`, owns the document bytes, serves the bundle `vscode-webview` builds into `public/`, and answers the `webview-bridge` commands. `private: true`; published through `vsce`.

## Key Files

| File | Description |
| --- | --- |
| `package.json` | Also the extension manifest: `contributes` (custom editor, four `vuerd.*` commands, three `dineug.erd-editor.theme.*` settings), `activationEvents`, `engines` |
| `src/extension.ts` | `activate`: the provider and the four `vuerd.*` commands |
| `src/erd-editor-provider.ts`, `src/erd-document.ts` | The `CustomEditorProvider` (with `docToWebviewMap`) and the `CustomDocument` owning the bytes |
| `src/editor.ts` | Abstract `Editor` — the `Bridge`, `buildHtmlForWebview` (`{{extension-base-url}}`), `readonly` for `git` / `conflictResolution` URIs |
| `src/erd-editor.ts` | `ErdEditor` — every host-side command: initial value, save, replication broadcast, import/export dialogs, theme push |
| `vite.config.ts` | CJS lib build to `dist/extension.js` (`ssr`, `ssr.noExternal: true`, `target: 'node20'`, only `vscode` and builtins external) plus `run.tasks`. `publicDir: false`, or Vite copies `public/` into `dist/` and the VSIX ships the webview twice |
| `tsconfig.unit.json` | The type gate over `src`, specs and the stub. `exclude: []` is load-bearing: inheriting the parent's typechecks zero specs and still exits 0 |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `test/mocks/` | The `vscode` stub the unit suite aliases in |
| `test/integration/` | Mocha specs for a live Extension Host; `test/fixtures/workspace/` is the folder it opens |
| `public/`, `dist/`, `out/` | Generated: the webview bundle (never edit), the extension bundle, the compiled integration specs |

## For AI Agents

### Working In This Directory

- `package.json` is the manifest. Two src ↔ manifest invariants are unit-asserted: `src/constants/viewType.test.ts` and the defaults check in `src/configuration.test.ts`.
- `engines.vscode` (`^1.90.0`) is the floor. `.vscode-test.mjs` derives its `minimum-supported` run from it; `build.target: 'node20'`, `@types/node` `^20` and `@types/vscode` `^1.90` are raised by hand with it.
- **`dist/extension.js` is a contract**: `main` is `./dist/extension`, so a `.cjs` emit never activates. Everything but `vscode` and builtins inlines because the VSIX ships no `node_modules` (`--no-dependencies`); a bare `require` left in the bundle fails activation.
- File support lives in two manifest places — `activationEvents` (`workspaceContains:**/*.{erd,vuerd}`) and `customEditors[].selector` — change both.
- State-changing commands must go through `dispatchBroadcast` over `docToWebviewMap` in `src/erd-editor.ts`, or one document open in two groups desynchronizes.
- New host behaviour goes on `ErdEditor`, not the provider; `bootstrapWebview` returns one `Disposable` releasing both the `mergeRegister` handle and the raw listeners.
- The four `vuerd.*` handlers are arrows, never bare references: `editor/title` passes more than the uri, and the second argument would land as `viewColumn`.
- `IMPORT_FILE_TYPES` is keyed by the bridge's import `type` union and feeds both the dialog filter and the extension check; the check is an alternation because `graphql` has three extensions.
- `capabilities.untrustedWorkspaces.supported` is `true` — never eval or execute document content.
- `build:vsce` / `publish:vsce` run a `vsce` no package.json declares; it must be on `PATH`.

### Testing Requirements

- Unit: `pnpm exec vp run --filter vuerd-vscode --fail-if-no-match test`. Call `resetVscodeMock()` in `beforeEach`; the stub is shared per file. `pnpm --filter vuerd-vscode typecheck` is the gate alone.
- Integration: `pnpm --filter vuerd-vscode e2e` builds, compiles `tsconfig.integration.json` to `out/`, then runs `stable` and `minimum-supported` (`xvfb-run -a` on Linux; `VSCODE_TEST_USER_DATA_DIR` shortens the IPC socket path). Those specs import only `vscode` and node builtins — the host runs the emitted JS unbundled, so `@/` does not resolve.
- Build: `pnpm exec vp run --filter vuerd-vscode --fail-if-no-match build`; `dependsOn` builds `vscode-webview` first, which fills `public/`.
- Manual: F5 `Launch Extension` from this folder builds the dependencies once (`build:deps`), then watches the extension only — rebuild the webview after changing it.

## Dependencies

### Internal

`@dineug/erd-editor-webview-bridge` (inlined into `dist/`) and `@dineug/erd-editor-vscode-webview` (fills `public/`) — `devDependencies`, which the build's `dependsOn` still follows.

### External

`@vscode/test-cli` and `@vscode/test-electron` for the Extension Host suite.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
