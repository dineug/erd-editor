<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-08-27 -->

# shared

## Purpose

`@dineug/shared` is the bottom leaf of the workspace graph: runtime type guards, two tiny
array/number helpers, callback safety wrappers, and a crypto-seeded `nanoid`. Six packages consume it
directly and `erd-editor-schema` plus `vscode-bridge` also declare it as a peer dependency. It is
`private: true` — never published; the library build currently inlines its only runtime dependency.

## Key Files

| File                  | Description                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| `src/index.ts`        | Barrel — `export *` over the five modules; the whole public surface                                       |
| `src/is-types.ts`     | 19 guards — 8 from a `createIsTypeof` factory (`isString`, `isNumber`, …), the rest written out by hand |
| `src/fn.ts`           | `safeCallback` (invoke, `console.error` on throw) and `asap` (`queueMicrotask` with a Promise fallback)    |
| `src/nanoid.ts`       | `customRandom(urlAlphabet, 21, …)` fed by `globalThis.crypto.getRandomValues` — shared URL-safe IDs |
| `src/array.utils.ts`  | `arrayHas`, a `Set`-backed membership predicate; `src/number.utils.ts` holds `createInRange`, a clamp      |
| `vite.config.ts`      | `run.tasks` `build`/`test`, plus the ESM lib build (`BROWSER_TARGET`, `vite-plugin-dts` + declaration maps) |
| `tsconfig.build.json` | dts-only program; excludes `src/**/*.test.ts` so tests never land in `dist/`                               |

## For AI Agents

### Working In This Directory

- **Keep `src` dependency-light.** `nanoid` is the only external the bundle carries, and the lib
  build inlines it — `dist/index.js` imports nothing. A signature change affects the direct consumers
  listed in the root package map.
- **Avoid module-load side effects.** `sideEffects: false` is the package contract, but exported
  helpers are not mathematically pure: `safeCallback` logs, `asap` schedules, and `nanoid` reads
  `globalThis.crypto`.
- `index.test.ts` pins the 24 public names with `expect.arrayContaining` plus a uniqueness check. That
  catches a removed or renamed export; an **added** one passes untouched, so add the name yourself.
- **`nanoid` has no fallback randomness source** — `globalThis.crypto` must exist in every target
  runtime (browser, worker, Extension Host); a test asserts the throw propagates.
- `safeCallback` returns the callback result, or `undefined` when absent or when the callback throws;
  thrown errors are logged and swallowed by design. `isObjectRaw(null)` follows `typeof`, while
  `isObject` excludes `null` and arrays. `arrayHas` snapshots its input into a `Set`.
- The library factory derives task inputs from `tsconfig.json` and local config files even though this
  leaf has no sibling `dist/`; `scripts/check-task-inputs.mjs` independently checks that exact contract.

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

- Public helpers live in five barrel modules; `isPrimitive` is the only guard returning plain
  `boolean` rather than a type predicate. Keep the intentionally spelled `isNill` name.
- Specs import `describe`/`it`/`expect`/`vi` from `vite-plus/test` and reach sources through `@/*`.

## Dependencies

### Internal

None — leaf package.

### External

- `nanoid` — ID generation; a `devDependency`, bundled into `dist/index.js`
- `vite-plugin-dts` (+ `@typescript/typescript6`, which only exists for it) — declaration emit
- `@vitest/coverage-v8` — the v8 provider behind `test:coverage`

<!-- MANUAL: notes added below this line are preserved on regeneration -->
