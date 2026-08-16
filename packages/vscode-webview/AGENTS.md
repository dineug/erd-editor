<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-16 -->

# vscode-webview (`@dineug/erd-editor-vscode-webview`)

## Purpose

The bundle that runs _inside_ the VSCode webview iframe. It is the client half of the extension: it
creates the `<erd-editor>` element, wires it to the extension host over `acquireVsCodeApi()`
`postMessage`, and spawns the replication-store worker that keeps the host's copy of the document up
to date.

There is no copy step: `build.outDir` is `../vscode-extension/public`, so this build writes straight
into the extension's webview assets — a gitignored directory the extension reads at runtime and
`vsce` ships inside the VSIX. Two consequences follow from writing outside the package root. Vite
only warns and declines to clear such a directory, so `emptyOutDir: true` is set explicitly —
without it a stale hashed bundle survives every rebuild and gets shipped, which is exactly what the
directory was already carrying before the migration. And the Vite Task has to declare the same path
as its `output` (`packages/vscode-extension/public/**`, `base: 'workspace'`); ⚠️ omit it and a cache
hit replays the build log while restoring not one file.

### Wiring

```
extension host ──postMessage──▶ bridge ──▶ <erd-editor> (sharedStore)
               ◀──postMessage── bridge ◀── editor change / user command
                                   │
                                   └──▶ workerBridge ──▶ ReplicationStoreWorker ──▶ hostSaveValue
```

Three participants, two `Bridge` instances:

- `bridge` — host ↔ webview
- `workerBridge` — webview ↔ replication-store worker
- `sharedStore` — the editor's own action stream, obtained via
  `editor.getSharedStore({ mouseTracker: false })` (no cursor sharing in VSCode)

## Key Files

| File              | Description                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`    | The entire client — element creation, both bridges, worker spawn, theme/readonly/import-export handling, lazy shiki registration |
| `src/webview.css` | Layout for the editor host element and the `#loading` placeholder                                                                |
| `src/env.d.ts`    | Ambient types — `@types/vscode-webview` for `acquireVsCodeApi`, `vite/client` for the `*.css` module declaration                 |
| `index.html`      | The entry, at the package root — the `{{extension-base-url}}` base tag and the module script Vite rewrites to the hashed bundle  |
| `vite.config.ts`  | `run.tasks.build`, `base: './'`, `publicDir: false`, the `bundle.<hex8>` filenames, and the local `strip-crossorigin` plugin     |
| `tsconfig.json`   | Extends the root `tsconfig.app.json`; `include: ["src"]`, and a `lib` that adds `WebWorker`                                      |

## For AI Agents

### Working In This Directory

- **`acquireVsCodeApi()` may be called exactly once per webview.** It is called at module scope in
  `src/index.ts`; never call it again anywhere in the bundle.
- **Everything crossing to the host must be JSON-safe.** Binary payloads (file export) are encoded with
  `base64-arraybuffer` (`encode`) before dispatch and decoded on the host side.
- **File IO is delegated to the host**, because a webview has no file dialogs. `setExportFileCallback`
  and `setImportFileCallback` from `@dineug/erd-editor` are registered to emit
  `hostExportFileCommand` / `hostImportFileCommand` instead.
- **Shiki is imported lazily** (`import('@dineug/erd-editor-shiki-worker').then(...)` →
  `setGetShikiServiceCallback`). Keep it out of the initial chunk; webview startup latency is visible.
  It lands beside the entry as `erd-editor-shiki-worker.<hex8>.js` (1.28 MB against the entry's
  1.56 MB), named by `chunkFileNames: '[name].[hash:8].js'`; `hashCharacters: 'hex'` keeps the
  eight-hex-digit alphabet the webpack build used, since rolldown hashes in base64 by default.
  ⚠️ `[id]` is a webpack placeholder that rolldown does not have — writing it raises no error and
  emits a file literally named `[id].<hash>.js`.
- **`mouseTracker: false`** — the shared store is used for host replication, not collaboration. Turning
  it on would broadcast cursor positions with nothing to receive them.
- **Theme comes from the host**, via `webviewUpdateThemeCommand`; `appearance` defaults to `'dark'`.
  `'auto'` is resolved locally by `getSystemTheme()`, which reads VSCode's own theme kind off
  `document.body` (`data-vscode-theme-kind`, falling back to the `vscode-light` class) — not
  `prefers-color-scheme`. A `MutationObserver` on those two `body` attributes re-applies the preset
  while `appearance === 'auto'`. Everything else about the theme is resolved by the extension and
  pushed as `ThemeOptions`; don't reach into VSCode's CSS variables for it.
- **`base: './'` is a contract with the host.** `Editor#buildHtmlForWebview` substitutes the webview
  URI into `<base href="{{extension-base-url}}">` and lets relative asset URLs resolve against it.
  Vite's default `/` emits absolute paths, which resolve against the webview origin instead and
  render a blank panel. ⚠️ The `{{extension-base-url}}` token has to survive HTML processing
  verbatim — the extension replaces every occurrence with a regex, so a rewritten or dropped `<base>`
  breaks every asset at once.
- **`crossorigin` is stripped from the emitted tags.** Vite emits `<script type="module" crossorigin>`;
  the webview document runs on `vscode-webview://` while assets come through `asWebviewUri` from a
  different origin that answers with none of the CORS headers a crossorigin module script requires.
  The local `strip-crossorigin` plugin removes the attribute (`transformIndexHtml`, `order: 'post'`)
  and `modulePreload: false` removes the preload links that carry it too. ⚠️ Nothing tests this: the
  Extension Host harness blocks the webview document request itself (`Blocked vscode-webview
  request … index.html` in its log), so a panel that fails to load its bundle still passes.
- **There is no `worker` block here**, and there should not need to be. The replication-store worker
  arrives already inlined — its own package imports it as `?worker&inline` — which is why the whole
  build is four files: `index.html`, `bundle.<hex8>.js`, `bundle.<hex8>.css` and the shiki chunk.
- **`build.target` is deliberately unset**, and the root `build-target.ts` is deliberately not
  imported. Both webviews run in the embedded Chromium their host ships, so their own sources have a
  much higher floor than the public web does; what they consume from the libraries is already capped
  by `BROWSER_TARGET` regardless. `src/index.ts` nonetheless still pulls in `core-js/stable` whole,
  as its second line.
- **The `build` target lives in `vite.config.ts`, not in `package.json`.** `run.tasks.build` is the
  two-step `['tsc --noEmit', 'vp build']`, with
  `dependsOn: [{ task: 'build', from: ['dependencies', 'devDependencies', 'peerDependencies'] }]`.
  All three fields, because the default is `dependencies` alone and most workspace edges in this repo
  sit in `devDependencies` (this package's five happen to be in `dependencies`) — a graph that
  resolves to nothing is not an error, it is a green build against a stale `dist/`. ⚠️ There is
  deliberately no `build` script in `package.json`: a script sharing a task name makes the task graph
  fail to load.
- **The `input` globs are written out by hand because TypeScript 7's `tsc` is a Go binary**, which
  Vite Task's automatic file tracking cannot see into. They list `src/**`, `index.html`,
  `package.json`, `vite.config.ts`, `tsconfig.json`, the root `tsconfig.app.json`, and the
  `dist/**/*.d.ts` of all five workspace dependencies. ⚠️ Change what `tsconfig.json` includes and
  the `input` globs have to move with it — nothing catches the mismatch; the typecheck simply stops
  waking up. The dependency half _is_ enforced: `scripts/check-task-inputs.mjs` (part of `pnpm check`)
  fails if a workspace dependency has no matching `.d.ts` glob.
- **This package's `src/` had no type gate at all before the migration.** webpack's swc-loader
  stripped types without reading them, so a deliberate type error compiled green. Now `tsc --noEmit`
  runs ahead of every `vp build`. `pnpm --filter @dineug/erd-editor-vscode-webview typecheck` runs
  the same program by hand; it has no CI slot of its own because CI reaches it through the build.
  ⚠️ One consequence is immediate: the root tsconfig sets `noUncheckedSideEffectImports`, and the
  `/// <reference types="vite/client" />` in `src/env.d.ts` is the only thing declaring `*.css`. Drop
  it and `import './webview.css'` is a TS2882 — which before the migration nobody would have seen.
- This package is **build-only** — `run.tasks` declares exactly one task (`build`) and
  `package.json` exactly one script (`typecheck`). There is no dev server: iterate by running the
  extension host.
- `private: true`.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/erd-editor-vscode-webview --fail-if-no-match build`, then build
  the extension — or just build the extension, which pulls this in first: `vuerd-vscode` has this
  package in its `devDependencies`, so `pnpm exec vp run --filter vuerd-vscode build` covers both.
  ⚠️ `pnpm --filter @dineug/erd-editor-vscode-webview build` no longer exists — `build` is a task
  name now, not a script. ⚠️ Bare `vp build` ignores `run.tasks`, so it skips both the `tsc --noEmit`
  gate and `dependsOn`, and happily bundles against a stale `dist/`. ⚠️ Flags go _before_ the task
  name, and `--fail-if-no-match` matters: a filter that matches no package exits 0 and prints a line
  nobody reads.
- There is no unit suite here — no `test` task, no `vitest.config.ts`. The `tsc --noEmit` step of the
  `build` task is the only automated check this package has.
- Real verification is the VSCode extension host (launch config in `packages/vscode-extension/.vscode/`):
  open a `.erd` file and check the round trip — edit → file saves; change VSCode theme → editor
  restyles; open the same file in two editor groups → both stay in sync (that path uses the host's
  broadcast, so test it with more than one webview).
- Also verify readonly (`webviewUpdateReadonlyCommand`) by opening a file from git history.

### Common Patterns

- Command handlers are registered up front and collected with `Bridge.mergeRegister`.
- The `#loading` element in `index.html` is removed once the initial value arrives.

## Dependencies

### Internal

- `@dineug/erd-editor` — the element
- `@dineug/erd-editor-vscode-bridge` — command protocol
- `@dineug/erd-editor-vscode-replication-store-worker` — host-side document replica
- `@dineug/erd-editor-shiki-worker` — highlighting (lazy)
- `@dineug/shared`

### External

- `base64-arraybuffer` — binary payload encoding
- `@types/vscode-webview` — the `acquireVsCodeApi` typing referenced from `src/env.d.ts`
- `core-js` — still imported wholesale (`core-js/stable`) at the top of `src/index.ts`
- Build-only: `vite` — which in this workspace is a pnpm-catalog alias for
  `@voidzero-dev/vite-plus-core`, so there is no `node_modules/.bin/vite` and every command goes
  through `vp` — plus `vite-plus` and `typescript` 7.0.2. No dts plugin: this package emits an app
  bundle, not a library.

### Consumers

`vuerd-vscode` — serves this bundle from its gitignored `public/` directory, which this package's
build owns and empties.

<!-- MANUAL: -->
