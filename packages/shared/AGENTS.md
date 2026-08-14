<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-15 -->

# shared (`@dineug/shared`)

## Purpose

The lowest leaf of the dependency graph: dependency-free helpers used by every other package.
Type guards, small array/number utilities, callback safety wrappers, and a re-exported nanoid.
It is declared as a `peerDependency` by `erd-editor-schema` and `vscode-bridge` so that the whole
workspace resolves a single copy. The other six consumers take it as a plain `workspace:*` link —
a `dependency` in `app`, `intellij-webview` and `vscode-webview`, a `devDependency` in `erd-editor`,
`vscode-extension` and `vscode-replication-store-worker`, where the bundler inlines it.

Marked `"sideEffects": false` — everything here must stay pure and tree-shakeable.

## Key Files

| File                  | Description                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/index.ts`        | Barrel re-exporting all five modules with `export *`                                                                                       |
| `src/is-types.ts`     | Runtime type guards built on a `createIsTypeof` factory — `isString`, `isObject`, `isNill`, `isInteger`, `isPromise`, `nonNullable`, …     |
| `src/fn.ts`           | `safeCallback` (invoke-and-`console.error`) and `asap` (`queueMicrotask` with a `Promise.resolve().then` fallback)                         |
| `src/array.utils.ts`  | `arrayHas` — builds a `Set`-backed membership predicate (the only export)                                                                  |
| `src/number.utils.ts` | `createInRange(min, max)` — curried `Math.min`/`Math.max` clamp (the only export)                                                          |
| `src/nanoid.ts`       | `customRandom(urlAlphabet, 21, …)` seeded straight from `globalThis.crypto.getRandomValues`; produces the 21-char entity IDs of the schema |
| `src/*.test.ts`       | One Vitest file per module, colocated with the source (`is-types.test.ts`, `fn.test.ts`, `nanoid.test.ts`, `index.test.ts`, …)             |
| `vite.config.ts`      | ESM lib build + `vite-plugin-dts` (with declaration maps) + typescript plugin                                                              |
| `vitest.config.ts`    | `src/**/*.test.ts`, `node` environment, v8 coverage with per-file 80% thresholds                                                           |
| `tsconfig.json`       | Extends the root app config; adds `@/* → src/*`                                                                                            |
| `tsconfig.build.json` | Build/dts variant — excludes `src/**/*.test.ts` so tests never reach `dist/`                                                               |

## For AI Agents

### Working In This Directory

- **Keep it dependency-free.** The only runtime dependency is `nanoid` (declared under
  `devDependencies` and inlined by the lib build). Adding a real runtime dependency here propagates
  to every package in the workspace.
- **Keep every export pure.** `sideEffects: false` is a build contract; a module-level side effect
  would be silently dropped by consumers' bundlers.
- New utilities go into the matching existing module and are re-exported automatically by the
  `export *` barrel — no manual edit to `src/index.ts` is needed. `index.test.ts` asserts the exact
  set of public names, so a new export must be added there too.
- `arrayHas` and `safeCallback` are hot paths (used per-action in the editor's rx pipeline). Prefer
  allocation-free implementations.
- **`nanoid` has no randomness fallback.** Commit 25f56eb5 removed the non-crypto path, so
  `globalThis.crypto` must exist in every target runtime (browser, worker, Node ≥ 22, Extension
  Host). Do not reintroduce a `Math.random` branch — a test asserts the throw propagates.

### Testing Requirements

- A Vitest suite lives next to the sources: `src/*.test.ts`, one file per module plus
  `index.test.ts` for the barrel. Run it with `pnpm --filter @dineug/shared test`
  (`test:dev` for watch mode, `test:coverage` for the v8 report). It is part of `pnpm test`
  (`nx run-many -t test`).
- `vitest.config.ts` enforces **per-file** coverage thresholds of 80% for lines, functions, branches
  and statements over `src/**/*.ts`. A new module without a matching `*.test.ts` fails
  `test:coverage`, not just lowers a number.
- `tsconfig.build.json` excludes `*.test.ts`, so the build never type-checks the tests — the suite is
  the only thing that does. Conversely `pnpm --filter @dineug/shared build` type-checks the sources
  via `@rollup/plugin-typescript` with `noEmitOnError: true`.
- Because this package sits at the bottom of the graph, run a full `pnpm build` after changing a
  signature — every downstream package recompiles against the emitted `.d.ts`.

### Common Patterns

- One concern per file, named exports only.
- Type guards are written as `value is T` predicates so callers get narrowing for free.
- Tests import through the `@/*` alias (mirrored in `vitest.config.ts`), not relative paths.

## Dependencies

### Internal

None — this is a leaf package.

### External

- `nanoid` — ID generation
- `vite`, `vite-plugin-dts`, `@rollup/plugin-typescript`, `tslib`, `@types/node` — build only
- `vitest`, `@vitest/coverage-v8` — test only

<!-- MANUAL: -->
