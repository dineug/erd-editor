<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-16 -->

# intellij-webview (`@dineug/erd-editor-intellij-webview`)

## Purpose

The webview bundle for the [IntelliJ ERD Editor plugin](https://plugins.jetbrains.com/plugin/23594-erd-editor).
It is the JCEF-hosted twin of `vscode-webview`: same `<erd-editor>` element, same
`@dineug/erd-editor-vscode-bridge` command protocol — only the transport differs.

The IntelliJ plugin itself (Kotlin/JVM) lives in a **separate repository**; this package only produces
the HTML/JS bundle it embeds. `build:webview` is the `run.tasks` task that emits the plugin-shaped
output.

### Transport difference

|                    | VSCode webview                                                          | IntelliJ webview                                                                                                 |
| ------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| webview → host     | `vscode.postMessage(action)`                                            | `window.cefQuery({ request: JSON.stringify(action), persistent: false, onSuccess, onFailure })`                  |
| host → webview     | `globalThis.addEventListener('message')`                                | **Identical** — `src/main.ts:115` matches `vscode-webview/src/index.ts:148`. Only the outbound direction differs |
| Replication worker | `@dineug/erd-editor-vscode-replication-store-worker` (inline `?worker`) | local `src/services/replicationStore.worker.ts` via `new Worker(new URL(...))`                                   |

Because `cefQuery` takes a **string**, every payload must survive `JSON.stringify`/`parse`.

## Key Files

| File                                      | Description                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/main.ts`                             | The whole client — element creation, `bridge` (host) + `workerBridge` (worker), replication worker spawn, theme/readonly handling, lazy shiki registration   |
| `src/services/replicationStore.worker.ts` | Local headless replica built on `createReplicationStore` from `@dineug/erd-editor/engine.js`                                                                 |
| `src/utils/text.ts`                       | `toWidth` text metrics for the worker — a **byte-identical** copy of `vscode-replication-store-worker/src/utils/text.ts`; fix one and you must fix the other |
| `src/webview.css`                         | Layout for the editor host element                                                                                                                           |
| `src/env.d.ts`                            | Ambient types, including `window.cefQuery`                                                                                                                   |
| `index.html`                              | HTML shell **and** build entry, at the package root. `publicDir: false` — there is no static asset directory beside it                                       |
| `vite.config.ts`                          | Both outputs (`dist/` and `--mode webview`), the `stripCrossorigin` plugin, the `worker` block, and the `run.tasks` `build` / `build:webview` tasks          |
| `tsconfig.json`                           | Adds `WebWorker` to `lib` for the worker entry; its `include: ["src"]` is what the task `input` mirrors                                                      |

## For AI Agents

### Working In This Directory

- **This bundle is consumed by a different repository.** Changing the command protocol or the HTML
  shell's element ids can break the Kotlin plugin with no signal in this repo. Coordinate protocol
  changes with the plugin repo and keep them additive where possible.
- **`build:webview` writes outside this repo.** With `--mode webview`, `build.outDir` is
  `../../../erd-editor-intellij-plugin/src/main/resources/assets` — out of this package, out of this
  monorepo, into a sibling checkout of the plugin repo — and `emptyOutDir: true` applies there. It
  only lands somewhere useful if that checkout exists next to this one under exactly that name; run
  it deliberately, and use plain `build` (→ `dist/`) for anything else. ⚠️ It is also why the task is
  `cache: false`: Vite Task never archives files outside the package, so a cache hit would replay the
  log without writing anything and the plugin would be packaged from yesterday's assets.
- **`base` must stay `/`.** The plugin's CEF `SchemeHandlerFactory` maps the request path straight
  onto the classpath, so the URL path *is* the resource path — the relative `base` that
  `vscode-webview` needs resolves to nothing here. That same handler assigns a MIME type from a
  three-way check on the extension — `.html`, `.js`, `.css` — and nothing outside those three may be
  emitted, because anything else is served with no MIME type at all. `sourcemap: false` is that rule,
  not a size decision.
- **`crossorigin` is stripped from the tags Vite injects.** The local `stripCrossorigin` plugin
  (`transformIndexHtml`, `order: 'post'`) does it, because the scheme handler returns a body and a
  MIME type and nothing else — no CORS headers. ⚠️ Leave the attribute in and the module script is
  refused: the panel stays blank with a clean, green build behind it.
- **The `worker` block repeats the output naming on purpose.** Workers do not inherit
  `build.rolldownOptions.output`, so without it the worker chunks land outside `static/js` with
  base64 hashes. `worker.format: 'es'` is there for the same reason `main.ts` constructs its worker
  with `{ type: 'module' }`: Vite's default `iife` worker loads its split pieces with
  `importScripts`, which a module worker is not allowed to call.
- **`window.cefQuery` is fire-and-forget over a JSON string.** No structured clone, no transferables,
  no `undefined` survival. Binary data is base64-encoded (`base64-arraybuffer`) by the caller.
- **It reuses the _vscode_ bridge package** — that is intentional, not a mistake. Do not fork the
  protocol; if IntelliJ needs a new command, add it to `@dineug/erd-editor-vscode-bridge`.
- **No file _import_ dialog here.** Unlike the VSCode webview, `main.ts` registers only
  `setExportFileCallback` (plus `setGetShikiServiceCallback`); import is driven from the host via
  `webviewImportFileCommand`. Don't add `setImportFileCallback` without host support.
- **The replication worker is a local copy**, not the shared package — JCEF's module-worker support
  differs from VSCode's, so it uses a plain `new Worker(new URL('./services/replicationStore.worker.ts', import.meta.url), { type: 'module' })`.
  When fixing a bug in `packages/vscode-replication-store-worker`, check whether this copy needs the
  same fix.
- **`mouseTracker: false`** — the shared store is for host replication only.
- **The `build` task carries a type gate this package did not have before.** `run.tasks.build` is
  `['tsc --noEmit', 'vp build']`. Under webpack, `swc-loader` stripped types without reading them, so
  `src/` was never typechecked by anything — a deliberate type error here used to build green. It is
  red now. ⚠️ Running `vp build` yourself is the built-in command and ignores `run.tasks` altogether:
  no typecheck, no `dependsOn`, and a bundle that looks exactly like a good one.
- **The task's `input` list is written by hand, and `tsconfig.json` `include` is coupled to it.**
  TypeScript 7's `tsc` is a Go binary, so Vite Task cannot observe which files it read; the globs
  (`src/**`, `index.html`, `package.json`, `vite.config.ts`, `tsconfig.json`, the workspace
  `tsconfig.app.json`, and one `packages/<dep>/dist/**/*.d.ts` per workspace dependency) are the only
  reason a source or dependency edit invalidates the cached typecheck. ⚠️ Widen the tsconfig
  `include` without widening `input` and nothing fails — the gate replays a cache hit and reports
  green over source it never read. `scripts/check-task-inputs.mjs` (run by `pnpm check`) enforces
  only the workspace-dependency half of that list. `build:webview` declares no `input` because it is
  `cache: false`. `output: ['dist/**']` on `build` matters in reverse: drop it and a cache hit
  replays the log without restoring `dist/`.
- **No `build.target` here.** This is one of the two webviews that deliberately do not import
  `BROWSER_TARGET` from the root `build-target.ts` — the only browser that ever runs this bundle is
  the Chromium JCEF ships, so the public-web floor would say nothing useful. What it consumes from
  the libraries is already capped by that value regardless.
- Build-only package (`dev` runs `vp dev` for isolated UI work, but the real target is
  `build:webview`). `private: true`.

### Testing Requirements

- **No `test` task and no test files.** `run.tasks` declares `build` and `build:webview` and nothing
  else, so `pnpm test` (`vp run -r test`) walks straight past this package. The build is the
  verification:

  ```
  pnpm exec vp run --filter @dineug/erd-editor-intellij-webview --fail-if-no-match build
  pnpm exec vp run --filter @dineug/erd-editor-intellij-webview --fail-if-no-match build:webview
  ```

  ⚠️ `pnpm --filter @dineug/erd-editor-intellij-webview build` no longer exists — a task name can
  live in `vite.config.ts` or in `package.json`, not both, so `scripts` keeps only `dev` and
  `typecheck`. ⚠️ Keep `--fail-if-no-match`: a filter that matches no package exits 0 and builds
  nothing (measured), so a mistyped package name reads as a pass. ⚠️ Flags go **before** the task
  name.
- A correct `dist/` is `index.html` plus four hashed files — `static/js/bundle.<hex8>.js`,
  `static/css/bundle.<hex8>.css`, `static/js/replicationStore.worker.<hex8>.js`, and the lazily
  imported `static/js/erd-editor-shiki-worker.<hex8>.js`. The two things worth eyeballing in the
  emitted HTML are the absolute `/static/...` hrefs and the absence of `crossorigin`; both are
  load-bearing for the scheme handler and neither has a test.
- `pnpm --filter @dineug/erd-editor-intellij-webview typecheck` (`tsc -p tsconfig.json --noEmit`) is
  the same program the `build` task runs first, as a fast standalone gate. CI does not run it: the
  `check` job typechecks only `app` and `vuerd-vscode`, the two packages whose builds do not.
- `pnpm --filter @dineug/erd-editor-intellij-webview dev` gives a browser dev server — the script
  builds this package's dependencies (`vp run --filter @dineug/erd-editor-intellij-webview^... build`)
  and then starts `vp dev` on the root `index.html` — but `cefQuery` is undefined there, so host
  round trips cannot be verified this way. Full verification requires running the IntelliJ plugin
  from its own repository against this bundle.
- `pnpm check` is the only thing that typechecks this package's `vite.config.ts` — the root
  `tsconfig.json` program covers every `packages/*/vite.config.ts`, and no package program does. A
  typo inside the `run.tasks` block (`from: ['devDependencie']`, `input: ['scr/**']`) is a TS2769
  there and silently accepted everywhere else.
- Because a protocol mismatch fails silently (the host simply ignores an unknown action), log or
  breakpoint both directions when changing commands.

### Common Patterns

- Mirrors `packages/vscode-webview/src/index.ts` closely — when changing one, diff against the other
  and decide deliberately whether the change applies to both.
- Command handlers registered up front, collected with `Bridge.mergeRegister`.

## Dependencies

### Internal

- `@dineug/erd-editor` — the element and the `engine.js` entry
- `@dineug/erd-editor-vscode-bridge` — command protocol (reused, despite the name)
- `@dineug/erd-editor-shiki-worker` — highlighting (lazy)
- `@dineug/shared`

All four are `dependencies` here, but both `run.tasks` entries still name `dependsOn` across
`dependencies`, `devDependencies` and `peerDependencies` — the uniform form every package in this
repo uses, because elsewhere the workspace edges sit in `devDependencies` and a default
`dependencies`-scoped graph comes out empty rather than failing.

### External

- `base64-arraybuffer`
- `core-js@^3.36.1` — `src/main.ts` still opens with `import 'core-js/stable'`. `app` dropped its
  copy; this package kept it, and it is now bundled by rolldown rather than by webpack
- `typescript@7.0.2` (pinned workspace-wide by `pnpm-workspace.yaml` `overrides`), plus `vite` and
  `vite-plus` from the pnpm catalog. ⚠️ `vite` there is an alias for
  `@voidzero-dev/vite-plus-core@0.2.9`, so there is no `node_modules/.bin/vite` — `vp` is the CLI.
  No `vite-plugin-dts` and no `@typescript/typescript6`: this package emits no `.d.ts`

<!-- MANUAL: -->
