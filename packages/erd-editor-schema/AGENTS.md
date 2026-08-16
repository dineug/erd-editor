<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-16 -->

# erd-editor-schema (`@dineug/erd-editor-schema`)

## Purpose

Owns the persisted document format for `.erd` / `.vuerd` files: the v2 and v3 schemas, safe parsers
that normalize arbitrary JSON into a fully-populated document, bidirectional v2↔v3 conversion, a
query layer over v3 entity collections, and the **LWW (last-write-wins) register** primitives that
make concurrent editing and conflict resolution possible.

This package is where "what a diagram _is_" is defined; `@dineug/erd-editor` consumes it as the shape
of its store state (`packages/erd-editor/src/engine/store.ts` seeds state by spreading
`schemaV3Parser({})`).

### Schema versions

- **v2** — the legacy `vuerd` format: nested arrays of tables/memos/relationships under `table.tables`,
  `memo.memos`, etc.
- **v3** (`version: "3.0.0"`) — normalized `collections` keyed by entity id, plus `doc` (ordered id
  lists), `settings`, and `lww`. This is the current format.
- `parser(source)` sniffs `version` and routes to `schemaV3Parser` or `v2ToV3(schemaV2Parser(...))`,
  so callers only ever deal with v3. `parserV2(source)` is the mirror image for exporting legacy JSON.

### The LWW register

`LWW = Record<uuid, [tag, addVersion, removeVersion, Record<path, version>]>`

Every entity carries an add version, a remove version, and a per-field version map. `addOperator`,
`removeOperator`, and `replaceOperator` compare an incoming action's version against those and only
apply the change when it wins. Versions come from the editor's `Clock` (a Lamport counter), so the
same three operators serve undo/redo, cross-tab replication, and live collaboration merges.

## Key Files

| File                          | Description                                                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                | Public surface: `parser`, `parserV2`, `toJson`, `query`, the three LWW operators, both schema namespaces, `LWW` types |
| `src/parser.ts`               | Version sniffing (`parser`/`parserV2`) and serialization (`toJson`, honouring `ignoreSaveSettings` for scroll/zoom)   |
| `src/helper.ts`               | Shared coercion helpers — `assign`, `validString`, `validNumber`, `propOr`, `getDefaultEntityMeta`, `assignMeta`      |
| `src/internal-types/index.ts` | Internal type utilities (`ValuesType`, `DeepPartial`, `EntityMeta`, `EntityType`) — not exported                      |
| `src/utils/bit.ts`            | Bitfield helper (`bHas`) — settings flags like `show` and `ignoreSaveSettings` are bitmasks                           |
| `vitest.config.ts`            | Test config read by `vp test` — node env, `src/**/*.test.ts`, v8 coverage with per-file 80% thresholds                |
| `vite.config.ts`              | Library build **and** this package's `run.tasks` — ES-only lib entry, `BROWSER_TARGET`, `vite-plugin-dts`             |
| `tsconfig.json`               | The type-gate program — `include: ["src"]`, so `tsc --noEmit` reads the 41 `*.test.ts` files too                      |
| `tsconfig.build.json`         | dts-only tsconfig; excludes `src/**/*.test.ts` so tests never reach `dist/`                                           |

## Subdirectories

| Directory            | Purpose                                                                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/v3/schema/`     | v3 entity **types and `as const` constants only — no factories** — `doc`, `settings`, `table.entity`, `tableColumn.entity`, `index.entity`, `indexColumn.entity`, `relationship.entity`, `memo.entity`, `lww`        |
| `src/v3/parser/`     | Both the `create*` factories and the defensive `createAndMerge*` parsers; `index.ts` assembles the whole document and stamps `$schema` + `version`. Nine files against `schema/`'s ten — there is no `parser/lww.ts` |
| `src/v2/schema/`     | Legacy v2 entity shapes (`canvasEntity`, `tableEntity`, `memoEntity`, `relationshipEntity`)                                                                                                                          |
| `src/v2/parser/`     | v2 parsers (`canvas`, `table`, `memo`, `relationship`)                                                                                                                                                               |
| `src/v2/migrations/` | In-format v2 fixups — currently `relationshipType.migration.ts` (`ZeroOneN→ZeroN`, `One→OneOnly`, `N→OneN`)                                                                                                          |
| `src/convert/`       | `v2ToV3.ts` and `v3ToV2.ts`                                                                                                                                                                                          |
| `src/query/`         | `index.ts` — chainable `query(collections).collection(k).selectById/selectByIds/selectAll/…`; `lww.ts` — the add/remove/replace operators                                                                            |

Every non-test `src/**/*.ts` has a sibling `*.test.ts` in the same directory except
`src/internal-types/index.ts` (41 test files against 42 sources) — that one exception is
institutionalised in `vitest.config.ts` as `coverage.exclude: ['src/internal-types/**']`. There is no
separate `test/` tree and no fixture directory.

## For AI Agents

### Working In This Directory

- **`schema/` and `parser/` must stay in lockstep.** Adding a field to a v3 entity means updating the
  type, its factory default, its parser, and — if it should survive a round trip through the legacy
  format — both files in `convert/`. It also means updating `json-schema/schema.json` (see below) and
  the sibling `*.test.ts` files, which assert factory defaults and merge behaviour explicitly.
- **Parsers must never throw on malformed input.** They take `any` and fill in defaults; the editor
  relies on `schemaV3Parser({})` producing a complete empty document.
- **Do not bump the version string casually.** `parser.ts` compares `version === '3.0.0'`; anything
  else falls through the v2 path. A new version needs a migration route, not just a constant change.
- **LWW operator semantics are the correctness core** of collaboration and undo. `addOperator` runs its
  recipe only when `removeVersion < version`; `removeOperator` only when `addVersion <= version`;
  `replaceOperator` when `prevVersion <= version` for that path. `src/query/lww.test.ts` pins each of
  these comparisons — if you change one, that file will tell you, and it is the file to reason from.
- `query()` calls `ids.length` before mapping (`selectByIds`) purely to register an observable
  dependency in `r-html`. That line looks dead; it is not. Do not remove it.
- Settings flags are bitmasks — use `bHas` rather than equality.
- `@dineug/shared` is a `peerDependency` here so the workspace shares one copy (and a `workspace:*`
  devDependency so local builds and tests resolve it).
- **This package's task graph lives in `vite.config.ts`, not in any workspace-level file.** `run.tasks`
  declares `build` (`tsc --noEmit`, then `vp build`) and `test` (`tsc --noEmit`, then `vp test run`),
  both `dependsOn` the `build` task of `dependencies`, `devDependencies` **and** `peerDependencies`.
  All three are listed because every workspace edge this package has (`@dineug/shared`) is a dev/peer
  edge — leaving the default (`dependencies` only) empties the graph, and the result is not a failure
  but a green run against a stale `dist/`.
- ⚠️ **The `input` globs in those tasks are written out by hand and must be maintained by hand.**
  TypeScript 7's `tsc` is a Go binary, so Vite Task's automatic file tracking never sees what it read;
  widening `tsconfig.json`'s `include` without widening `input` buys cache hits that skip the typecheck
  entirely. Only one half of this is enforced: `scripts/check-task-inputs.mjs` (run by `pnpm check`)
  fails when the `packages/shared/dist/**/*.d.ts` glob and `package.json`'s workspace deps disagree.
- Neither `vite.config.ts` nor `vitest.config.ts` is inside this package's own program
  (`tsconfig.json` is `include: ["src"]`). The repo-root `tsconfig.json` collects every
  `packages/*/vite.config.ts` and `packages/*/vitest.config.ts` instead, so a typo in a `run.tasks`
  block is caught by `pnpm check` at the root and by nothing here.
- `build.target` is `BROWSER_TARGET`, imported from the repo-root `build-target.ts` — the single
  browser floor every library build in the repo shares. Don't pin a local target.
- **`private: true`, but the format it defines is public.** `ERDEditorSchemaV3['$schema']` is the
  literal `https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json`, and
  `src/v3/parser/index.ts` stamps it onto every parsed document, so saved files point editors at the
  repo-root `json-schema/schema.json`. That file is hand-maintained — nothing generates it from these
  types — so a v3 shape change is only half done until it lands there too. Commit `439b8bb6` is the
  reference example: `columnOrder` gained `minItems`/`maxItems` (7, matching `ColumnTypeList`), and
  `database`/`language`/`tableNameCase`/`columnNameCase`/`bracketType` gained `enum`s taken from
  `SchemaV3Constants` — those five are single-select, unlike the `show`/`ignoreSaveSettings` bitmasks.

### Testing Requirements

- **`pnpm exec vp run --fail-if-no-match --filter @dineug/erd-editor-schema test`** (`tsc --noEmit`,
  then `vp test run`) — 41 files / 455 tests covering every v2 and v3 schema factory and parser,
  `helper`, `bit`, `parser`/`toJson`/`parserV2`, both `convert/` directions, the `CollectionQuery`
  chain, and the three LWW operators.
  ⚠️ **`pnpm --filter @dineug/erd-editor-schema test` no longer exists.** `test` is a task name now,
  and a `package.json` script sharing that name makes the whole task graph fail to load, so the script
  was deleted. ⚠️ `--fail-if-no-match` because a filter that matches zero packages otherwise exits 0 —
  rename this package and the command stays green while running nothing.
- `test:dev` (`vp test dev`, watch) and `test:coverage` (`vp test run --coverage`) survive as
  `package.json` scripts, so those two keep the `pnpm --filter @dineug/erd-editor-schema <script>`
  form. ⚠️ Both call the built-in `vp test`, which ignores `run.tasks` — no `tsc --noEmit` ahead of
  them and no `dependsOn`, so they will happily run against a stale `@dineug/shared` `dist/`.
- **Coverage is a gate, not a report.** `vitest.config.ts` sets v8 coverage with `perFile: true` and
  80% on lines/functions/branches/statements over `src/**/*.ts`, excluding only `*.test.ts`, `*.d.ts`
  and `src/internal-types/**`. A new source file with no sibling test fails `test:coverage`.
- The suite is pure and in-process: `environment: 'node'`, no fixture files, no filesystem reads. The
  `@` alias resolves to `src/` in `vitest.config.ts` exactly as in `vite.config.ts`. All 41 specs
  import their `describe`/`it`/`expect`/`vi` from `vite-plus/test`, not from `vitest`.
- A change is not verified until `pnpm build` (`vp run -r build`) passes. The type gate is the
  `tsc --noEmit` at the head of the `build` task, not a bundler plugin, and the editor's store state
  type is derived from these types, so a type break here surfaces downstream rather than locally.
- ⚠️ **That gate now covers the specs, and it did not used to.** The old gate ran over
  `tsconfig.build.json`, which excludes `src/**/*.test.ts` — all 41 spec files were unchecked, and a
  deliberate type error in one of them stayed green. `tsc --noEmit` reads `tsconfig.json`
  (`include: ["src"]`) and pulls in all 41.
- For format changes, also round-trip the fixtures by hand: `data/test.json` at the repo root is a v2
  (`version: "2.0.0"`) document — load it in the editor (`pnpm --filter @dineug/erd-editor dev`),
  export, and diff. Validate the export against `json-schema/schema.json` and update it in the same
  change.

### Common Patterns

- One entity per **pair** of files: the type in `src/v3/schema/<entity>.ts`, and both the `create*`
  factory (fully-defaulted values) and the `createAndMerge*` parser (folds untrusted input onto that
  default via `assign`) together in `src/v3/parser/<entity>.ts`.
- Entity ids are nanoid strings, but **this package does not mint them** — every `create*` factory
  defaults `id: ''` and the editor assigns the real id. The only `nanoid` call here is in
  `src/convert/v2ToV3.ts`, generating column ids during migration. Every entity carries a `meta`
  (`createAt`/`updateAt`) from `getDefaultEntityMeta`.
- Collections are `Record<id, Entity>`; ordering lives separately in `doc`.
- Constant sets are `as const` objects paired with a `*List` array (`DatabaseList`, `NameCaseList`, …)
  re-exported through `SchemaV3Constants` / `SchemaV2Constants`.

## Dependencies

### Internal

- `@dineug/shared` (peer, plus `workspace:*` dev) — type guards and nanoid

### External

- `lodash-es` — the only runtime dependency; `pick` in `toJson`, `difference` in the settings/canvas
  parsers and both `convert/` directions
- Build/test only: `vite` and `vite-plus` (both `catalog:`; ⚠️ `vite` is an alias for
  `npm:@voidzero-dev/vite-plus-core@0.2.9`, so there is no `node_modules/.bin/vite` and no raw
  `vite build` to fall back on), `vite-plugin-dts` 5, `vitest` 4.1.10 + `@vitest/coverage-v8` as the
  runner behind `vp test`, `typescript` 7.0.2 (the workspace `overrides` in `pnpm-workspace.yaml` is
  the authority, not this `devDependencies` entry), `@typescript/typescript6` 6.0.2 — carried only
  because `vite-plugin-dts` still uses the JS Compiler API that TypeScript 7 removed —
  `@types/lodash-es`, `tslib`

### Consumers

`@dineug/erd-editor` (store state, `toJson`, LWW operators, `query`) — and transitively every app.

<!-- MANUAL: -->
