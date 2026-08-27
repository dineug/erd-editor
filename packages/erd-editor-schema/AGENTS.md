<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-08-27 -->

# erd-editor-schema

## Purpose

Defines the persisted `.erd` / `.vuerd` document format: the v2 and v3 schemas, defensive parsers that fold arbitrary JSON onto fully-defaulted documents, bidirectional v2↔v3 conversion, a chainable query layer over v3 collections, and the LWW (last-write-wins) operators. `@dineug/erd-editor` is the only direct workspace consumer — it seeds store state from `schemaV3Parser({})`; `app` and the IDE surfaces reach the schema through that package. `private: true`, but the format is public: every parsed document is stamped with a `$schema` pointing at the repo-root `json-schema/schema.json`.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public surface: `parser`, `parserV2`, `toJson`, `query`, the three LWW operators, `SchemaV2Constants` / `SchemaV3Constants`, `LWW` types |
| `src/parser.ts` | Version sniffing (`version === '3.0.0'`, else the v2 route) and `toJson`, which per `ignoreSaveSettings` resets scroll to `0` and `zoomLevel` to `1` |
| `src/query/lww.ts` | `addOperator` / `removeOperator` / `replaceOperator` over `LWW = Record<id, [tag, add, remove, Record<path, version>]>` |
| `src/query/index.ts` | `CollectionQuery` — `selectById`, `setOne`, `updateOne`, `getOrCreate`, plus the LWW operators bound to a collection key |
| `src/helper.ts` | `assign`, `assignMeta`, `validString`, `validNumber`, `propOr`, `getDefaultEntityMeta` — every parser is built from these |
| `vite.config.ts` | Library build (`BROWSER_TARGET`, ES-only, `vite-plugin-dts`) **and** the `build` / `test` tasks supplied by the shared library factory |
| `tsconfig.build.json` | dts-only program; excludes `src/**/*.test.ts` so specs never reach `dist/` |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/v3/schema/` | v3 entity types and `as const` constant sets only — no factories |
| `src/v3/parser/` | The `create*` factories and the `createAndMerge*` parsers; `index.ts` assembles the document |
| `src/v2/schema/`, `src/v2/parser/` | Legacy shapes and parsers: `canvas`, `table`, `memo`, `relationship` |
| `src/v2/migrations/` | In-format v2 fixups — `ZeroOneN`→`ZeroN`, `One`→`OneOnly`, `N`→`OneN` |
| `src/convert/` | `v2ToV3.ts` and `v3ToV2.ts` |
| `src/query/` | Collection query chain and the LWW operators |
| `src/utils/` | `bit.ts` — `bHas`, since `show` and `ignoreSaveSettings` are bitmasks |
| `src/internal-types/` | `DeepPartial`, `EntityMeta`, `ValuesType` — not exported, and excluded from coverage |

## For AI Agents

### Working In This Directory

- Once JSON has been parsed, schema parsers never throw on invalid field values: they validate per field and fall back to factory defaults. The string entry points still let `JSON.parse` throw for invalid JSON. The editor relies on `schemaV3Parser({})` producing a complete empty document.
- `toJson` uses a shallow top-level pick; when `ignoreSaveSettings` normalizes scroll or zoom, it also mutates the selected nested `settings` object on the passed schema. Treat export as a normalization step, not a pure serializer.
- A v3 shape change touches the type in `schema/`, the factory and `createAndMerge*` in `parser/`, both files in `convert/` if it must survive a legacy round trip, and the repo-root `json-schema/schema.json` — nothing generates that file from these types.
- `selectByIds` reads `ids.length` before mapping to register an r-html observable dependency; removing that line breaks reactivity on id-list changes.
- `query(collections)` exposes `collection`, `selectById(s)`, `selectEntities`, `selectAll`, `set/add/remove` one/many/all operations, `updateOne/many`, `getOrCreate`, and collection-bound LWW operators. `removeAll()` replaces only the query's private collection reference; callers needing the parent `collections[key]` slot replaced must handle that explicitly.
- LWW comparisons are the correctness core: add runs its recipe when `removeVersion < version`, remove when `addVersion <= version`, replace when the path's `prevVersion <= version`. `src/query/lww.test.ts` pins all three.
- `@dineug/shared` is a `peerDependency` (plus a `workspace:*` dev entry), so both tasks list `peerDependencies` in `dependsOn` — dropping it builds against a stale `dist/`.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/erd-editor-schema --fail-if-no-match test` — `tsc --noEmit` over `tsconfig.json` (`include: ["src"]`, so the 41 spec files are typechecked too), then `vp test run`.
- `pnpm --filter @dineug/erd-editor-schema test:coverage` (`vp test run --coverage`) and `test:dev` (`vp test dev`, watch); both skip the `tsc` gate and `dependsOn`.
- `vitest.config.ts`: `include: ['src/**/*.test.ts']`, `environment: 'node'`, no setup file, v8 coverage at `perFile` 80% excluding `*.test.ts`, `*.d.ts` and `src/internal-types/**`.
- For format changes, round-trip `data/test.json` (a v2 document) through the editor by hand and validate the export against `json-schema/schema.json`.

### Common Patterns

- One entity, two files: the type in `src/v3/schema/<entity>.ts`; the `create*` factory and the `createAndMerge*` parser together in `src/v3/parser/<entity>.ts`.
- Constant sets are `as const` objects paired with a `*List` array (`DatabaseList`, `NameCaseList`), re-exported through `SchemaV3Constants` / `SchemaV2Constants`.
- Collections are `Record<id, Entity>` with ordering held separately in `doc`; factories default `id` to `''` and the editor mints the real one. Every entity carries `meta` from `getDefaultEntityMeta`.
- Specs sit beside their source and import `describe` / `it` / `expect` from `vite-plus/test`.

## Dependencies

### Internal

- `@dineug/shared` — peer + `workspace:*` dev; type guards (`isString`, `isNumber`, `isArray`) and `nanoid`.

### External

- `es-toolkit` `^1.50.0` — the only `dependencies` entry: `pick` in `toJson`, `difference` in `convert/` and in both settings parsers. `vite.config.ts` builds `external` from `dependencies` **and** `peerDependencies`, so `@dineug/shared` is external too.
- `vite-plugin-dts` 5 + `@typescript/typescript6` — declaration emit; the latter exists only because the plugin needs the JS compiler API TypeScript 7 dropped.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
