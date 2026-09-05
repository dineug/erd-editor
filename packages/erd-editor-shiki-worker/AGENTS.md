<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-08-27 -->

# erd-editor-shiki-worker

## Purpose

Runs [Shiki](https://shiki.style) syntax highlighting off the main thread. `getShikiService()` creates
a named `SharedWorker` from `new URL('./shiki.shared-worker.ts', import.meta.url)` and returns a Comlink
proxy of `ShikiService`, whose only method is `codeToHtml(code, { lang, theme })` over nine grammars (sql,
typescript, graphql, csharp, java, kotlin, scala, go, python) and the github-dark / github-light themes.
Published to npm at v0.2.0; `app`, `vscode-webview` and `intellij-webview` load it lazily, while the
editor dev and e2e fixtures wire the same callback statically. The worker is a file of its own,
`dist/workers/shiki.shared-worker.js`, and `shiki`, `@shikijs/langs`, `@shikijs/themes` and `comlink` are
`dependencies` the consumer's bundler resolves; nothing is inlined.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public surface: `getShikiService` plus the `ShikiService` type |
| `src/services/index.ts` | Spawns the shared worker through `spawn.ts`, `Comlink.wrap`s its port, memoizes a successful proxy |
| `src/services/spawn.ts`, `spawn.inline.ts` | The one place the worker is constructed: from its URL, or, in the twin the umd config aliases in, from a `?sharedworker&inline` data url |
| `vite.umd.config.ts` | The script-tag build the `build` task runs after the es one: `formats: ['umd']`, `name: 'ErdEditorShikiWorker'`, no `external`, the spawn alias, and `base64InlineWorkers`, because the percent-encoded form of this worker passes Chromium's 2 MiB url cap |
| `src/services/shikiService.ts` | The service itself — `createHighlighterCore`, the exact grammar/theme tables, `codeToHtml` |
| `src/services/shiki.shared-worker.ts` | `SharedWorker` entry; `Comlink.expose`s the service per connection |
| `package.json` | `unpkg` and `jsdelivr` point at `dist/erd-editor-shiki-worker.umd.js`, which the `exports` map never names; `dependencies` are what shipped code imports on either side of the worker boundary; `files` publishes `dist/` minus the `.d.ts.map` files; `exports` points at `dist/index.js` |
| `vite.config.ts` | `run.tasks.build` (which appends `vp build -c vite.umd.config.ts`), ES lib build with `external` from `createExternal(manifest)`, a `worker` block with the same `external`, `format: 'es'` and the unhashed `workers/[name].js` name, `__APP_VERSION__` define, `dts()` with `declarationMap`, and `libraryWorkerUrls()` from `tools/vite/worker-url.ts`, which rewrites the URL Vite writes for the worker into `new URL('./workers/shiki.shared-worker.js', import.meta.url)` |
| `tsconfig.json` | `lib` carries `DOM` for the `SharedWorker` constructor on the page side and `WebWorker` for the worker entries; drop either and one half stops typechecking |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/services/` | Everything: the service, both worker entries, and the client-side factory |

## For AI Agents

### Working In This Directory

- **Only the shared worker is wired up.** `shiki.worker.ts` is a dedicated-worker entry nothing imports;
  construction failure logs, leaves no service, and is not retried. Keep both worker forms on one API if
  the fallback is restored.
- `getShikiService()` is synchronous and memoizes only a successfully created proxy. `codeToHtml()`
  awaits the highlighter, accepts exactly the nine languages listed above, and maps any theme other
  than `'light'` to the dark theme.
- **Everything crossing the Comlink boundary must be structured-cloneable or a Comlink proxy.**
  Returning a class instance or DOM node from `shikiService.ts` fails at runtime, not at build.
- **`createHighlighterCore` over static `@shikijs/langs/*` / `@shikijs/themes/*` imports** — `shiki`'s default entry pulls every grammar into the worker chunk the consumer's bundler builds.
- **The engine is `createJavaScriptRegexEngine({ forgiving: true })`, not Oniguruma** — no WASM, so no
  `wasm-unsafe-eval` in a host CSP. `forgiving` hides an untranspilable grammar as missing colour, so check Shiki's engine-js compat list when adding one.
- Grammars and themes drive the size of the worker chunk, and of the data URL the VSCode webview alone
  turns it back into: `vscode-webview` inlines it through `tools/vite/inline-worker.ts`, which fails
  that build past Chromium's 2 MiB URL cap, so a grammar added here is measured there.

### Testing Requirements

- No `test` task, and `scripts` is empty, so the build is the only gate:
  `pnpm exec vp run --filter @dineug/erd-editor-shiki-worker --fail-if-no-match build`.
- **The build never spawns the worker, so green proves nothing about the highlighter starting.** Verify
  in a browser: `pnpm --filter @dineug/erd-editor dev`, then the Schema SQL and Generator Code panels;
  the app and IntelliJ bundles exercise the same callback with the worker as a file, and the VSCode
  bundle is where the inline form runs.

### Common Patterns

- The worker is reached as `new SharedWorker(new URL('./shiki.shared-worker.ts', import.meta.url), { type: 'module', name })`,
  the spelling Vite, webpack 5 and Rspack all recognise and bundle as an entry of its own, so a consumer
  emits `shiki.shared-worker.<hash>.js` beside its chunks and needs `worker-src 'self'`, not `data:`.
- **Vite writes a library's worker URL joined to `base` and marked `@vite-ignore`**, which resolves under
  the consumer's URL root and no bundler re-reads. `libraryWorkerUrls()` rewrites it to the relative
  spelling above at `renderChunk`; `tools/vite-config.test.ts` pins the rewrite.
- The worker is named `@dineug/erd-editor-shiki-worker?v${__APP_VERSION__}` — `SharedWorker` is keyed
  by name, so the version stamp keeps two editor versions off one stale highlighter.

## Dependencies

### Internal

None — leaf package.

### External

- `shiki` / `@shikijs/langs` / `@shikijs/themes` `^4.4.3` — engine plus fine-grained grammar and theme entries, `dependencies` that move as a set and resolve in the consumer's bundle
- `comlink` `^4.4.2` — worker RPC on both sides of the boundary, the same range `erd-editor` declares, so one copy serves both

<!-- MANUAL: notes added below this line are preserved on regeneration -->
