<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-17 | Updated: 2026-08-17 -->

# erd-editor-shiki-worker

## Purpose

Runs [Shiki](https://shiki.style) syntax highlighting off the main thread. `getShikiService()` spawns
a `SharedWorker` and returns a Comlink proxy of `ShikiService`, whose only method is
`codeToHtml(code, { lang, theme })` over nine grammars (sql, typescript, graphql, csharp, java,
kotlin, scala, go, python) and the github-dark / github-light themes. Published to npm at v0.1.2; `app`,
`vscode-webview` and `intellij-webview` `import()` it lazily and pass the factory to
`@dineug/erd-editor`'s `setGetShikiServiceCallback`.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public surface: `getShikiService` plus the `ShikiService` type |
| `src/services/index.ts` | Constructs the shared worker, `Comlink.wrap`s its port, memoizes the proxy |
| `src/services/shikiService.ts` | The service itself — WASM load, grammar/theme tables, `codeToHtml` |
| `src/services/shiki.shared-worker.ts` | `SharedWorker` entry; `Comlink.expose`s the service per connection |
| `vite.config.ts` | `run.tasks.build`, ES lib build, `__APP_VERSION__` define, `dts()` |
| `tsconfig.json` | Adds `WebWorker` to `lib` — without it the worker entries do not typecheck |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/services/` | Everything: the service, both worker entries, and the client-side factory |

## For AI Agents

### Working In This Directory

- **Only the shared worker is wired up.** `getShikiService` builds `ShikiSharedWorker`; the
  dedicated-worker fallback (`src/services/shiki.worker.ts`) is commented out in the `catch`, so a
  host without `SharedWorker` logs the error and returns no proxy. Keep both entries on the same API.
- **Everything crossing the Comlink boundary must be structured-cloneable or a Comlink proxy.**
  Returning a class instance or DOM node from `shikiService.ts` fails at runtime, not at build.
- **`shiki` is pinned to exactly `0.14.7`.** `shikiService.ts` binds to `setWasm` / `toShikiTheme` and to
  `shiki/languages/*.tmLanguage.json`, `shiki/themes/*.json`, `shiki/dist/onig.wasm` — a bump rewrites it.
- Grammars and themes drive bundle size (built bundle ~1.4 MB); add one only when the editor uses it.

### Testing Requirements

- No `test` task, and `scripts` is empty, so the build is the only gate:
  `pnpm exec vp run --filter @dineug/erd-editor-shiki-worker --fail-if-no-match build`.
- Behavioural check: `pnpm --filter @dineug/erd-editor dev` (its `src/index.dev.ts` imports `getShikiService`), then open the Schema SQL and Generator Code panels.

### Common Patterns

- Worker entries import through Vite suffixes: `'./shiki.shared-worker?sharedworker&inline'`.
  `&inline` embeds the worker as a `data:` URI so consumers re-bundling this package never fetch a
  second asset under a webview CSP; `shiki/dist/onig.wasm?url` inlines as base64 the same way.
- The worker is named `@dineug/erd-editor-shiki-worker?v${__APP_VERSION__}` — `SharedWorker` is keyed
  by name, so the version stamp keeps two editor versions off one stale highlighter.

## Dependencies

### Internal

None — leaf package.

### External

- `shiki` `0.14.7` — highlighting engine, exact pin
- `comlink` `4.4.1` — worker RPC, exact pin; inlined into the bundle, so consumers need not depend on it

<!-- MANUAL: notes added below this line are preserved on regeneration -->
