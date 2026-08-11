<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-08 -->

# shared (`@dineug/shared`)

## Purpose

The lowest leaf of the dependency graph: dependency-free helpers used by every other package.
Type guards, small array/number utilities, callback safety wrappers, and a re-exported nanoid.
It is declared as a `peerDependency` by `erd-editor-schema` and `vscode-bridge` so that the whole
workspace resolves a single copy.

Marked `"sideEffects": false` — everything here must stay pure and tree-shakeable.

## Key Files

| File                  | Description                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `src/index.ts`        | Barrel re-exporting all five modules with `export *`                                            |
| `src/is-types.ts`     | Runtime type guards (`isString`, `isObject`, `isArray`, `isNill`, `isFunction`, `isInteger`, …) |
| `src/fn.ts`           | Function helpers — `safeCallback`, `asap`, `noop`-style utilities used across async boundaries  |
| `src/array.utils.ts`  | Array helpers, notably `arrayHas` (builds a `Set`-backed membership predicate)                  |
| `src/number.utils.ts` | Numeric clamping/rounding helpers                                                               |
| `src/nanoid.ts`       | Wraps `nanoid` to produce the entity IDs used throughout the document schema                    |
| `vite.config.ts`      | ESM lib build + `vite-plugin-dts` (with declaration maps) + typescript plugin                   |
| `tsconfig.json`       | Extends the root app config; adds `@/* → src/*`                                                 |

## For AI Agents

### Working In This Directory

- **Keep it dependency-free.** The only runtime dependency is `nanoid` (declared under
  `devDependencies` and inlined by the lib build). Adding a real runtime dependency here propagates
  to every package in the workspace.
- **Keep every export pure.** `sideEffects: false` is a build contract; a module-level side effect
  would be silently dropped by consumers' bundlers.
- New utilities go into the matching existing module and are re-exported automatically by the
  `export *` barrel — no manual edit to `src/index.ts` is needed.
- `arrayHas` and `safeCallback` are hot paths (used per-action in the editor's rx pipeline). Prefer
  allocation-free implementations.

### Testing Requirements

- No `test` target is defined. Verification is `pnpm --filter @dineug/shared build`, which type-checks
  via `@rollup/plugin-typescript` with `noEmitOnError: true`.
- Because this package sits at the bottom of the graph, run a full `pnpm build` after changing a
  signature — every downstream package recompiles against the emitted `.d.ts`.

### Common Patterns

- One concern per file, named exports only.
- Type guards are written as `value is T` predicates so callers get narrowing for free.

## Dependencies

### Internal

None — this is a leaf package.

### External

- `nanoid` — ID generation
- `vite`, `vite-plugin-dts`, `@rollup/plugin-typescript`, `tslib` — build only

<!-- MANUAL: -->
