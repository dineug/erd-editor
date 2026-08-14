<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-15 -->

# erd-editor-shiki-worker (`@dineug/erd-editor-shiki-worker`)

## Purpose

Moves [Shiki](https://shiki.style) syntax highlighting off the main thread. Shiki loads WASM plus
grammar and theme JSON, which is far too heavy to run inline while the diagram canvas is animating —
so the editor lazily imports this package, which spins up a worker and exposes a Comlink-proxied
`ShikiService`.

Used to highlight generated output in the editor's **Schema SQL** and **Generator Code** panels.

This is one of only two publicly published packages (alongside `@dineug/erd-editor`); the `files`
field ships `dist/*.js` and type declarations.

## Key Files

| File                                  | Description                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/index.ts`                        | Public surface — `getShikiService` and the `ShikiService` type                                 |
| `src/services/index.ts`               | Spawns the shared worker and wraps its port with Comlink                                       |
| `src/services/shikiService.ts`        | The service implementation and its interface — the contract exposed across the worker boundary |
| `src/services/shiki.worker.ts`        | Dedicated `Worker` entry — a fallback, commented out in `services/index.ts`                    |
| `src/services/shiki.shared-worker.ts` | `SharedWorker` entry — one highlighter shared by several editor instances/tabs                 |
| `src/vite-env.d.ts`                   | Vite worker/asset ambient types                                                                |

## For AI Agents

### Working In This Directory

- **The service is consumed through Comlink**, so everything crossing the boundary must be structured-
  cloneable or a Comlink proxy. Returning a class instance, a function, or a DOM node from
  `shikiService.ts` will fail at runtime, not at build time.
- **Two worker entries are maintained in parallel, but only the shared one is wired up.**
  `getShikiService` constructs `ShikiSharedWorker` and `Comlink.wrap`s its `port`; the dedicated-worker
  fallback in the `catch` block is commented out, so a host without `SharedWorker` currently logs the
  error and returns `null`. Keep the two entries exposing the same API — re-enabling the fallback should
  stay a two-line change.
- Consumers do not import the service directly — they register it:
  `setGetShikiServiceCallback(getShikiService)` from `@dineug/erd-editor`, always behind a dynamic
  `import()` so the Shiki payload stays out of the initial bundle. Preserve that lazy boundary.
- **Shiki is pinned to `0.14.7`.** Shiki 1.x renamed the API (`getHighlighter` → `createHighlighter`,
  different theme/lang loading). Upgrading is a real migration, not a version bump.
- Grammars and themes are the bundle-size driver — load only the languages the editor actually renders.

### Testing Requirements

- No `test` target. Verify with `pnpm --filter @dineug/erd-editor-shiki-worker build`.
- Behavioural check: run the editor (`pnpm --filter @dineug/erd-editor dev`) and open the Schema SQL
  and Generator Code panels — highlighted output means the worker resolved. Do **not** expect a
  separate worker chunk: `?sharedworker&inline` embeds it, so a correct build is the single
  `dist/erd-editor-shiki-worker.js` (~1.3 MB) plus the `.d.ts` files.
- Worth verifying in more than one host: the web app, the VSCode webview, and the IntelliJ webview all
  consume this package under different worker/CSP constraints.

### Common Patterns

- Worker entries are referenced through Vite's import suffixes —
  `import ShikiSharedWorker from './shiki.shared-worker?sharedworker&inline'`. `&inline` is deliberate:
  the worker is embedded in the bundle so consumers that re-bundle it (webpack in both webviews) never
  have to resolve a second asset URL under a webview CSP.
- The shared worker is named `@dineug/erd-editor-shiki-worker?v${__APP_VERSION__}` (`__APP_VERSION__`
  is `define`d from `package.json` in `vite.config.ts`) — a `SharedWorker` is keyed by name, so the
  version stamp is what stops two editor versions from sharing one stale highlighter.
- ESM-only output; single `es` format.

## Dependencies

### Internal

None — leaf package.

### External

- `shiki@0.14.7` — highlighting engine (pinned)
- `comlink@4.4.1` — worker RPC. `erd-editor` and `app` pin the same version; `vscode-webview` and
  `intellij-webview` consume this package without depending on comlink at all, since it is inlined here

### Consumers

`@dineug/erd-editor-app`, `@dineug/erd-editor-vscode-webview`, `@dineug/erd-editor-intellij-webview` —
each registers it into `@dineug/erd-editor` via `setGetShikiServiceCallback`.

<!-- MANUAL: -->
