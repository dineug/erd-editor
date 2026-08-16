<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-16 -->

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
| `src/*.test.ts`       | One test file per module, colocated with the source (6 files / 61 cases); they import from `vite-plus/test`, not `vitest`                  |
| `vite.config.ts`      | The `run.tasks` `build`/`test` definitions plus the ESM lib build — `BROWSER_TARGET`, `vite-plugin-dts` with declaration maps              |
| `vitest.config.ts`    | `src/**/*.test.ts`, `node` environment, v8 coverage with per-file 80% thresholds                                                           |
| `tsconfig.json`       | Extends the root app config; adds `@/* → src/*`. Its `include: ["src"]` is the program `tsc --noEmit` gates — tests included               |
| `tsconfig.build.json` | dts variant — excludes `src/**/*.test.ts` so tests never reach `dist/`; `vite-plugin-dts` is now its only reader                           |

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
- **There is no `vite` binary.** `vite` is a pnpm-catalog alias for `@voidzero-dev/vite-plus-core`,
  so `node_modules/.bin/vite` does not exist. `vp` is the CLI; any instruction reading `vite build`
  or `vite dev` is stale and fails with "command not found", not with a useful message.
- **The `input` globs in `run.tasks` are written by hand, and they have to be.** TypeScript 7's
  `tsc` is a native binary, so Vite Task's automatic file tracking never observes what it reads —
  every file the typecheck depends on is spelled out (`src/**`, `package.json`, `tsconfig.json`,
  `tsconfig.build.json`, and the workspace-based `tsconfig.app.json`). Widen `tsconfig.json`'s
  `include` without widening `input` and the failure is a cache hit: `tsc` is not re-run and the
  task goes green. Being a leaf, this package has no `packages/<dep>/dist/**/*.d.ts` glob, so
  `scripts/check-task-inputs.mjs` has nothing to enforce here — the tsconfig ↔ `input` pairing is
  unguarded.
- The `build` task also declares `output: ['dist/**']`. Drop it and a cache hit replays the terminal
  output without restoring `dist/`, and every downstream package then compiles against nothing.
- **Both tasks depend on `build` `from: ['dependencies', 'devDependencies', 'peerDependencies']`.**
  Every workspace edge in this repo lives in `devDependencies`; the default (`dependencies` only)
  empties the graph, and the result is not a failure but a green run against stale `dist/`.

### Testing Requirements

- A test suite lives next to the sources: `src/*.test.ts`, one file per module plus `index.test.ts`
  for the barrel, importing from `vite-plus/test` (6 files / 61 cases, measured). Run it with
  `pnpm exec vp run --filter @dineug/shared --fail-if-no-match test`. It is part of the root
  `pnpm test` (`vp run -r test`).
- **`pnpm --filter @dineug/shared test` and `... build` no longer exist.** Those two names are owned
  by `run.tasks`, and a `package.json` script sharing a task name makes the task graph fail to load
  — so both scripts were deleted. What remains in `package.json` is `test:dev` (watch) and
  `test:coverage` (v8 report), reached the usual way: `pnpm --filter @dineug/shared test:dev`.
- **The built-in `vp test` and `vp build` ignore `run.tasks`.** They run the bare Vitest/Vite step
  and skip the `tsc --noEmit` that precedes it, so a type error passes silently. `test:coverage` is
  one of those (`vp test run --coverage`) — it reports coverage, not types. CI and every command
  here go through `vp run`.
- **A `--filter` that matches no package exits 0.** `--fail-if-no-match` is what turns a renamed or
  moved package into a red run instead of a green one that tested nothing.
- `vitest.config.ts` enforces **per-file** coverage thresholds of 80% for lines, functions, branches
  and statements over `src/**/*.ts`. A new module without a matching `*.test.ts` fails
  `test:coverage`, not just lowers a number. Nothing in CI runs this package's `test:coverage` —
  only r-html's — so check it by hand after adding a module.
- `tsconfig.build.json` still excludes `*.test.ts`, but that no longer leaves the tests untyped:
  `tsc --noEmit` reads `tsconfig.json`, whose `include: ["src"]` covers them. The old type gate was
  `@rollup/plugin-typescript` running over the build program with `noEmitOnError: true`, which meant
  a deliberate error planted in a `*.test.ts` came out green. That plugin is gone; the per-package
  `tsc --noEmit` does the same job over a wider program.
- `vite.config.ts` and `vitest.config.ts` sit outside this package's own program. The root
  `tsconfig.json` collects every `packages/*/vite.config.ts` and `packages/*/vitest.config.ts`, and
  `pnpm check` (`vp check && tsc --noEmit && node scripts/check-task-inputs.mjs`) is the only thing
  that typechecks them — a typo in a `run.tasks` key is caught there and nowhere else.
- Because this package sits at the bottom of the graph, run a full `pnpm build` (`vp run -r build`)
  after changing a signature — every downstream package recompiles against the emitted `.d.ts`.

### Common Patterns

- One concern per file, named exports only.
- Type guards are written as `value is T` predicates so callers get narrowing for free.
- Tests import through the `@/*` alias (mirrored in `vitest.config.ts`), not relative paths.

## Dependencies

### Internal

None — this is a leaf package.

### External

- `nanoid` — ID generation. A `devDependency`, and the lib build inlines it: `dist/index.js` carries
  the `customRandom` body and imports nothing at runtime
- `vite` (the catalog alias for `@voidzero-dev/vite-plus-core`), `vite-plus`, `vite-plugin-dts`,
  `typescript` 7.0.2, `@typescript/typescript6`, `tslib`, `@types/node` — build only.
  `@typescript/typescript6` rides along only because `vite-plugin-dts` still uses the JavaScript
  Compiler API that TypeScript 7 dropped; nothing under `src/` touches it
- `vitest`, `@vitest/coverage-v8` — test only. The runner is Vitest 4, but the specs import their
  `describe`/`it`/`expect`/`vi` from `vite-plus/test`

<!-- MANUAL: -->
