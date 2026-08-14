<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-15 -->

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
| `vitest.config.ts`            | Vitest run config — node env, `src/**/*.test.ts`, v8 coverage with per-file 80% thresholds                            |
| `vite.config.ts`              | Library build — ES-only lib entry, `vite-plugin-dts`, `@rollup/plugin-typescript` (`noEmitOnError`)                   |
| `tsconfig.build.json`         | Build/dts tsconfig; excludes `src/**/*.test.ts` so tests never reach `dist/`                                          |

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
- **`private: true`, but the format it defines is public.** `ERDEditorSchemaV3['$schema']` is the
  literal `https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json`, and
  `src/v3/parser/index.ts` stamps it onto every parsed document, so saved files point editors at the
  repo-root `json-schema/schema.json`. That file is hand-maintained — nothing generates it from these
  types — so a v3 shape change is only half done until it lands there too. Commit `439b8bb6` is the
  reference example: `columnOrder` gained `minItems`/`maxItems` (7, matching `ColumnTypeList`), and
  `database`/`language`/`tableNameCase`/`columnNameCase`/`bracketType` gained `enum`s taken from
  `SchemaV3Constants` — those five are single-select, unlike the `show`/`ignoreSaveSettings` bitmasks.

### Testing Requirements

- **`pnpm --filter @dineug/erd-editor-schema test`** (`vitest run`) — 41 files / 455 tests covering
  every v2 and v3 schema factory and parser, `helper`, `bit`, `parser`/`toJson`/`parserV2`, both
  `convert/` directions, the `CollectionQuery` chain, and the three LWW operators. `test:dev` watches;
  `test:coverage` runs `vitest run --coverage`.
- **Coverage is a gate, not a report.** `vitest.config.ts` sets v8 coverage with `perFile: true` and
  80% on lines/functions/branches/statements over `src/**/*.ts`, excluding only `*.test.ts`, `*.d.ts`
  and `src/internal-types/**`. A new source file with no sibling test fails `test:coverage`.
- The suite is pure and in-process: `environment: 'node'`, no fixture files, no filesystem reads. The
  `@` alias resolves to `src/` in `vitest.config.ts` exactly as in `vite.config.ts`.
- A change is not verified until `pnpm build` passes — `@rollup/plugin-typescript` runs with
  `noEmitOnError: true`, and the editor's store state type is derived from these types, so a type
  break here surfaces downstream rather than locally.
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
- Build/test only: `vite` 8, `vite-plugin-dts`, `@rollup/plugin-typescript`, `vitest` 4,
  `@vitest/coverage-v8`, `typescript` 5.8.2, `@types/lodash-es`, `tslib`

### Consumers

`@dineug/erd-editor` (store state, `toJson`, LWW operators, `query`) — and transitively every app.

<!-- MANUAL: -->
