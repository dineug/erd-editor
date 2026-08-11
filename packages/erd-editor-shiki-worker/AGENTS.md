<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-08 -->

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
| `src/services/index.ts`               | Chooses the worker flavour and wraps it with Comlink                                           |
| `src/services/shikiService.ts`        | The service implementation and its interface — the contract exposed across the worker boundary |
| `src/services/shiki.worker.ts`        | Dedicated `Worker` entry                                                                       |
| `src/services/shiki.shared-worker.ts` | `SharedWorker` entry — one highlighter shared by several editor instances/tabs                 |
| `src/vite-env.d.ts`                   | Vite worker/asset ambient types                                                                |

## For AI Agents

### Working In This Directory

- **The service is consumed through Comlink**, so everything crossing the boundary must be structured-
  cloneable or a Comlink proxy. Returning a class instance, a function, or a DOM node from
  `shikiService.ts` will fail at runtime, not at build time.
- **Two worker entries are maintained in parallel.** `shiki.worker.ts` and
  `shiki.shared-worker.ts` must expose the same API; changing one without the other produces an
  environment-specific bug (shared workers are unavailable in some webview hosts).
- Consumers do not import the service directly — they register it:
  `setGetShikiServiceCallback(getShikiService)` from `@dineug/erd-editor`, always behind a dynamic
  `import()` so the Shiki payload stays out of the initial bundle. Preserve that lazy boundary.
- **Shiki is pinned to `0.14.7`.** Shiki 1.x renamed the API (`getHighlighter` → `createHighlighter`,
  different theme/lang loading). Upgrading is a real migration, not a version bump.
- Grammars and themes are the bundle-size driver — load only the languages the editor actually renders.

### Testing Requirements

- No `test` target. Verify with `pnpm --filter @dineug/erd-editor-shiki-worker build`.
- Behavioural check: run the editor (`pnpm --filter @dineug/erd-editor dev`) and open the Schema SQL
  and Generator Code panels — highlighted output means the worker resolved. Also confirm the worker
  chunk appears as a separate file in the build output.
- Worth verifying in more than one host: the web app, the VSCode webview, and the IntelliJ webview all
  consume this package under different worker/CSP constraints.

### Common Patterns

- Worker entries are referenced via `new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' })`,
  which both Vite and webpack understand.
- ESM-only output; single `es` format.

## Dependencies

### Internal

None — leaf package.

### External

- `shiki@0.14.7` — highlighting engine (pinned)
- `comlink@4.4.1` — worker RPC (pinned; the same version is pinned by consumers)

### Consumers

`@dineug/erd-editor-app`, `@dineug/erd-editor-vscode-webview`, `@dineug/erd-editor-intellij-webview` —
each registers it into `@dineug/erd-editor` via `setGetShikiServiceCallback`.

<!-- MANUAL: -->
