<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-08 -->

# go (`@dineug/go`)

## Purpose

A Promise extension library that brings Go/CSP-style concurrency to TypeScript: goroutines driven by
generator functions, buffered channels, and redux-saga-like effect operators. The editor uses it for
long-running side-effect flows (`generator.actions.ts` throughout `erd-editor`) where a sequence of
awaits must be cancellable, debounced, or restarted on the newest event.

## Key Files

| File               | Description                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `src/index.ts`     | Public barrel — re-exports buffers, channel, go, operators                                 |
| `src/index.dev.ts` | Dev-server entry used by `vite dev` (paired with `index.html`)                             |
| `src/go.ts`        | The runner: drives a generator, resolving yielded effects until completion or cancellation |
| `src/channel.ts`   | Channel primitive — `put`/`take` with pluggable buffering                                  |
| `src/is-type.ts`   | Internal guards for distinguishing effect shapes                                           |
| `src/buffers/`     | Buffer strategies — `buffers.ts` (fixed/sliding/dropping), `limitBuffer.ts`, `type.ts`     |
| `src/operators/`   | Effect creators, one per file                                                              |
| `index.html`       | Scratch page for `pnpm --filter @dineug/go dev`                                            |

### Operators

| Operator                | Behaviour                                                 |
| ----------------------- | --------------------------------------------------------- |
| `take` / `put`          | Receive from / send to a channel                          |
| `takeEvery`             | Spawn a handler for every message                         |
| `takeLatest`            | Cancel the in-flight handler when a newer message arrives |
| `takeLeading`           | Ignore messages while a handler is running                |
| `debounce` / `throttle` | Rate-limit message handling                               |
| `all` / `race`          | Await every effect / the first to settle                  |
| `delay`                 | Timed pause                                               |
| `cancel` / `kill`       | Cancel a task / tear down a channel                       |
| `flush`                 | Drain a channel's buffer                                  |

## For AI Agents

### Working In This Directory

- `private: true` — this package is workspace-internal despite having a version number.
- Every operator lives in its own file and is re-exported from `src/operators/index.ts`; adding one
  means adding both the file and the barrel line.
- Cancellation is the invariant that matters. Any new operator must propagate cancellation to the
  tasks it spawns, or `destroy()` in the editor will leak running generators.
- The public entry is `src/index.ts`; `src/index.dev.ts` exists only for the local dev server and must
  never be referenced by consumers.

### Testing Requirements

- No `test` target. Verify with `pnpm --filter @dineug/go build` (type-checked, `noEmitOnError`).
- Behavioural changes are best exercised through the editor's generator actions — after changing an
  operator, run a full `pnpm build` and drive the editor via `pnpm --filter @dineug/erd-editor dev`.

### Common Patterns

- Effects are plain descriptor objects; `go.ts` interprets them. Never perform work inside an effect
  creator — creators are pure and the runner executes.
- `@/*` path alias points at `src/*`.

## Dependencies

### Internal

None — leaf package.

### External

Build-only: `vite`, `vite-plugin-dts`, `@rollup/plugin-typescript`, `tslib`.

### Consumers

`@dineug/erd-editor` (generator actions), `@dineug/erd-editor-app`.

<!-- MANUAL: -->
