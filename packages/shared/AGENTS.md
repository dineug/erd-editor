<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-17 | Updated: 2026-08-17 -->

# shared

## Purpose

`@dineug/shared` is the bottom leaf of the workspace graph: runtime type guards, two tiny
array/number helpers, callback safety wrappers, and a crypto-seeded `nanoid`. Eight packages depend
on it; `erd-editor-schema` and `vscode-bridge` additionally declare it as a `peerDependency` so the
workspace resolves one copy. It is `private: true` — never published, always inlined by the
consumer's bundler.

## Key Files

| File                  | Description                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/index.ts`        | Barrel — `export *` over the five modules; the whole public surface                                       |
| `src/is-types.ts`     | 19 guards — 8 from a `createIsTypeof` factory (`isString`, `isNumber`, …), the rest written out by hand |
| `src/fn.ts`           | `safeCallback` (invoke, `console.error` on throw) and `asap` (`queueMicrotask` with a Promise fallback)    |
| `src/nanoid.ts`       | `customRandom(urlAlphabet, 21, …)` fed by `globalThis.crypto.getRandomValues` — the 21-char entity IDs     |
| `src/array.utils.ts`  | `arrayHas`, a `Set`-backed membership predicate; `src/number.utils.ts` holds `createInRange`, a clamp      |
| `vite.config.ts`      | `run.tasks` `build`/`test`, plus the ESM lib build (`BROWSER_TARGET`, `vite-plugin-dts` + declaration maps) |
| `tsconfig.build.json` | dts-only program; excludes `src/**/*.test.ts` so tests never land in `dist/`                               |

## For AI Agents

### Working In This Directory

- **Keep it dependency-free.** `nanoid` is the only external the bundle carries, and the lib build
  inlines it — `dist/index.js` imports nothing. Anything added here reaches all eight consumers.
- **Every export must stay pure.** `sideEffects: false` lets bundlers drop a module-level effect.
- `index.test.ts` pins the 24 public names with `expect.arrayContaining` plus a uniqueness check. That
  catches a removed or renamed export; an **added** one passes untouched, so add the name yourself.
- **`nanoid` has no fallback randomness source** — `globalThis.crypto` must exist in every target
  runtime (browser, worker, Extension Host); a test asserts the throw propagates.
- `scripts/check-task-inputs.mjs` verifies nothing here — a leaf declares no sibling `dist/`. Widening
  `tsconfig.json`'s `include` past `src/` without widening `input` buys a stale cache hit, not a failure.

### Testing Requirements

- Suite: `src/*.test.ts`, one file per module plus `index.test.ts` — 6 files, 61 cases.
- `pnpm exec vp run --filter @dineug/shared --fail-if-no-match test` — `tsc --noEmit` then
  `vp test run`. Included in the root `pnpm test`.
- `pnpm --filter @dineug/shared test:dev` (`vp test dev`) and `test:coverage`
  (`vp test run --coverage`). Both call the built-in `vp test`, which skips the `tsc --noEmit` gate.
- `vitest.config.ts`: `node` environment, **per-file** 80% thresholds over `src/**/*.ts`. A new
  module with no `*.test.ts` fails `test:coverage`; nothing in CI runs it, so check by hand.
- An exported signature change reaches eight consumers; only `pnpm build` recompiles them.

### Common Patterns

- One concern per file, with a colocated `<name>.test.ts`; the barrel picks it up via `export *`.
- Type guards are `value is T` predicates so callers narrow for free — `isPrimitive` is the one
  exception, a plain `boolean`.
- Specs import `describe`/`it`/`expect`/`vi` from `vite-plus/test` and reach sources through `@/*`.

## Dependencies

### Internal

None — leaf package.

### External

- `nanoid` — ID generation; a `devDependency`, bundled into `dist/index.js`
- `vite-plugin-dts` (+ `@typescript/typescript6`, which only exists for it) — declaration emit
- `@vitest/coverage-v8` — the v8 provider behind `test:coverage`

<!-- MANUAL: notes added below this line are preserved on regeneration -->
