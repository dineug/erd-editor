<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-08-27 -->

# vscode-extension

## Purpose

The published VSCode extension (`vuerd-vscode`, "ERD Editor", publisher `dineug`) — the Node-side host.
It registers a `CustomEditorProvider` for `*.erd`, `*.erd.json`, `*.vuerd` and `*.vuerd.json`, owns the
document bytes, serves the bundle built by `@dineug/erd-editor-vscode-webview`, and translates VSCode
APIs into `@dineug/erd-editor-webview-bridge` commands. The only package importing `vscode`, and
`private: true` — publishing goes through `vsce` (`build:vsce` / `publish:vsce`).

## Key Files

| File | Description |
| --- | --- |
| `package.json` | Also the extension manifest: `contributes` (custom editor, four `vuerd.*` commands, three theme settings), `activationEvents`, `engines` |
| `src/erd-editor.ts` | All host-side bridge wiring: initial value, save, replication broadcast, import/export dialogs, theme push. `IMPORT_FILE_TYPES` is keyed by the bridge's `type` union and feeds both the open dialog's `filters` and the check on what was picked — widening that union without a row there is a build error, and `graphql` is why the check is an alternation and not the type string |
| `src/erd-document.ts` | `CustomDocument` implementation — owns raw bytes, dirty state and save/revert/backup updates for the provider |
| `src/erd-editor-provider.ts` | `ErdEditorProvider` — open/save/backup/revert, `resolveCustomEditor`, the `docToWebviewMap` |
| `src/editor.ts` | Abstract `Editor` — the `Bridge`, `buildHtmlForWebview` (`{{extension-base-url}}`), `readonly` by URI scheme |
| `vite.config.ts` | CJS lib build to `dist/extension.js` (`ssr`, `target: 'node20'`, `publicDir: false`, `vscode` + builtins external) plus `run.tasks` |
| `tsconfig.unit.json` | The type gate — `src` + specs + stub, `esnext`/`bundler`, `exclude: []`. Both `run.tasks` commands start with it |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/` | The whole extension host (plus `constants/` and `utils/`), each unit spec beside its source |
| `test/mocks/` | `vscode.ts` — `EventEmitter`/`Uri`/`Disposable`/enums real, host surfaces `vi.fn()` |
| `test/integration/` | Mocha specs for a live Extension Host: manifest/commands, custom-editor tab behaviour |
| `test/fixtures/workspace/` | The folder VSCode opens for the integration run (`sample.erd`, `.vscode/settings.json`) |
| `public/` | Generated — the webview package's `build.outDir`; `buildHtmlForWebview` reads `index.html` here |
| `dist/` / `out/` | Generated — the bundle (`main`) and the compiled integration specs (`.vscode-test.mjs` `files`) |

## For AI Agents

### Working In This Directory

- `package.json` is the manifest. Two src↔manifest invariants are unit-asserted: `src/constants/viewType.test.ts` and the defaults check in `src/configuration.test.ts`.
- `engines.vscode: ^1.90.0` feeds three places — `build.target: 'node20'`, `@types/node` `^20`, and `.vscode-test.mjs`'s `minimum-supported` run. Raise them together.
- The emitted name `dist/extension.js` is a contract: `main` is `"./dist/extension"`, so a `.cjs` emit means the extension never activates.
- Never edit `public/`. `publicDir: false` keeps the generated webview directory from being copied into the extension bundle's `dist/`; the webview build writes `public/` separately, where `vsce` packages it into the VSIX.
- `activationEvents` uses `workspaceContains:**/*.{erd,vuerd}`, while `contributes.customEditors[].selector` supports the four `*.erd`, `*.erd.json`, `*.vuerd` and `*.vuerd.json` forms. Keep both manifest surfaces in sync when changing file support.
- New state-changing bridge commands must go through the `docToWebviewMap` broadcast in `src/erd-editor.ts`, or one document open in two groups desynchronizes.
- `capabilities.untrustedWorkspaces.supported` is `true` — never eval or execute document content.

### Testing Requirements

- Unit: `vp run --filter vuerd-vscode --fail-if-no-match test` (`tsc -p tsconfig.unit.json --noEmit`, then `vp test run`). `src/**/*.test.ts`, `environment: 'node'`, `vscode` aliased to the stub — call `resetVscodeMock()` in `beforeEach`, the stub module is shared per file.
- `pnpm --filter vuerd-vscode test:coverage` (perFile 80%), `test:dev` to watch, `typecheck` for the gate alone. Both `test:*` call the `vp test` built-in and skip that gate.
- Integration: `pnpm --filter vuerd-vscode e2e` — builds, compiles `tsconfig.integration.json` to `out/`, then `vscode-test` downloads two VSCode builds. Prefix `xvfb-run -a` on Linux; `VSCODE_TEST_USER_DATA_DIR` moves the profiles to a short path. `e2e:typecheck` types those specs.
- Build: `vp run --filter vuerd-vscode --fail-if-no-match build`; `dependsOn` builds the bridge and webview first, which is what fills `public/`.

### Common Patterns

- Integration specs import only `vscode` and node builtins — `tsconfig.integration.json` sets `paths: {}` and the host runs the emitted JS unbundled, so `@/` would not resolve.
- New host behaviour goes on `ErdEditor`, not the provider; `bootstrapWebview` returns one `vscode.Disposable` releasing both the `Bridge.mergeRegister` handle and its raw listeners.
- The four `vuerd.*` handlers are arrows, never bare references — `editor/title` calls back with more than the uri, and the second argument would land as `viewColumn`.

## Dependencies

### Internal

`@dineug/erd-editor-webview-bridge` (command protocol), `@dineug/erd-editor-vscode-webview` (fills `public/`).

### External

`@types/vscode` `^1.90` + `@types/node` `^20`; `base64-arraybuffer` decodes exported binary payloads; `@vscode/test-cli` + `@vscode/test-electron` + `@types/mocha` run the Extension Host suite.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
