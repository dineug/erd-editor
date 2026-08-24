<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-17 | Updated: 2026-08-24 -->

# erd-editor-shiki-worker

## Purpose

Runs [Shiki](https://shiki.style) syntax highlighting off the main thread. `getShikiService()` spawns
a `SharedWorker` and returns a Comlink proxy of `ShikiService`, whose only method is
`codeToHtml(code, { lang, theme })` over nine grammars (sql, typescript, graphql, csharp, java, kotlin,
scala, go, python) and the github-dark / github-light themes. Published to npm at v0.1.2; `app`,
`vscode-webview` and `intellij-webview` `import()` it lazily into `setGetShikiServiceCallback`.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public surface: `getShikiService` plus the `ShikiService` type |
| `src/services/index.ts` | Constructs the shared worker, `Comlink.wrap`s its port, memoizes the proxy |
| `src/services/shikiService.ts` | The service itself — `createHighlighterCore`, grammar/theme tables, `codeToHtml` |
| `src/services/shiki.shared-worker.ts` | `SharedWorker` entry; `Comlink.expose`s the service per connection |
| `vite.config.ts` | `run.tasks.build`, ES lib build, `__APP_VERSION__` define, `dts()`, `base64InlineWorker()` |
| `tsconfig.json` | Adds `WebWorker` to `lib` — without it the worker entries do not typecheck |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/services/` | Everything: the service, both worker entries, and the client-side factory |

## For AI Agents

### Working In This Directory

- **Only the shared worker is wired up.** The `shiki.worker.ts` fallback is commented out in
  `getShikiService`'s `catch` — no `SharedWorker` means a logged error and no proxy. Keep both on one API.
- **Everything crossing the Comlink boundary must be structured-cloneable or a Comlink proxy.**
  Returning a class instance or DOM node from `shikiService.ts` fails at runtime, not at build.
- **`createHighlighterCore` over static `@shikijs/langs/*` / `@shikijs/themes/*` imports** — `shiki`'s default entry pulls every grammar, and inlined as one `data:` URI the worker cannot code-split.
- **The engine is `createJavaScriptRegexEngine({ forgiving: true })`, not Oniguruma** — no WASM, so no
  `wasm-unsafe-eval` in a host CSP. `forgiving` hides an untranspilable grammar as missing colour, so check Shiki's engine-js compat list when adding one.
- Grammars and themes drive both the bundle (~1.4 MB, ~176 kB gzipped) and the inlined worker URL (~1.62 MB of a 2 MiB cap) — and those two move independently.

### Testing Requirements

- No `test` task, and `scripts` is empty, so the build is the only gate:
  `pnpm exec vp run --filter @dineug/erd-editor-shiki-worker --fail-if-no-match build`.
- **The build never spawns the worker, so green proves nothing about the highlighter starting.** Verify
  in a browser: `pnpm --filter @dineug/erd-editor dev`, then the Schema SQL and Generator Code panels.

### Common Patterns

- Worker entries import through Vite suffixes: `'./shiki.shared-worker?sharedworker&inline'`. `&inline`
  embeds it as a `data:` URI, so consumers re-bundling this package fetch no second asset under a CSP.
- **`base64InlineWorker()` in `vite.config.ts` re-encodes that URI from percent to base64.** Percent
  inflates grammars 1.8x and blew past Chromium's 2 MiB URL cap, where `new SharedWorker` fails with an
  empty error event — no log, no stack, just panels that never fill. It fails the build over the cap.
- The worker is named `@dineug/erd-editor-shiki-worker?v${__APP_VERSION__}` — `SharedWorker` is keyed
  by name, so the version stamp keeps two editor versions off one stale highlighter.

## Dependencies

### Internal

None — leaf package.

### External

- `shiki` / `@shikijs/langs` / `@shikijs/themes` `4.4.3` — engine plus fine-grained grammar and theme entries; exact pins that move as a set
- `comlink` `4.4.1` — worker RPC, exact pin; inlined into the bundle, so consumers need not depend on it

<!-- MANUAL: notes added below this line are preserved on regeneration -->
