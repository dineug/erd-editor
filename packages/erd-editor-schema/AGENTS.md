<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-09-19 -->

# erd-editor-schema

## Purpose

Defines the persisted `.erd` / `.vuerd` document: v2 and v3 schemas, defensive parsers, v2↔v3 conversion, a query layer over v3 collections, and the LWW operators. `@dineug/erd-editor` is its only workspace consumer. The package is private but the format is public: every document `schemaV3Parser` builds, a converted v2 one included, is stamped with a `$schema` URL pointing at the repo-root `json-schema/schema.json`.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public surface: `parser`, `parserV2`, `toJson`, `schemaV2Parser`, `schemaV3Parser`, `query`, the three LWW operators, `migrateScrollToOrigin`, the constant sets and types |
| `src/parser.ts` | Version sniffing (`version === '3.0.0'`, else v2) and `toJson` |
| `src/v3/parser/migrateScroll.ts` | `migrateScrollToOrigin` — legacy scroll pair → `originX` / `originY`, one way only |
| `src/v3/schema/settings.ts` | Settings type, constant sets and the `CANVAS_*` bounds |
| `src/query/index.ts` | `query(collections).collection(key)` — CRUD plus collection-bound LWW operators |
| `src/query/lww.ts` | `addOperator` / `removeOperator` / `replaceOperator` over `LWW = Record<id, [tag, addVersion, removeVersion, Record<path, version>]>` |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/v3/schema/`, `src/v3/parser/` | One file per entity in each: its type and constant sets; its `create*` factory and `createAndMerge*` parser, built from `src/helper.ts` |
| `src/v2/` | Legacy `schema/` and `parser/`, plus `migrations/` (relationship type renames) |
| `src/convert/` | `v2ToV3.ts`, `v3ToV2.ts` |

## For AI Agents

### Working In This Directory

- **Parsers never throw on field values**: they validate per field and fall back to factory defaults (only the string entry points let `JSON.parse` throw). The editor seeds its store from `schemaV3Parser({})`.
- **`settings` holds two view pairs that are never cross-derived.** `originX` / `originY` are the live view; `scrollLeft` / `scrollTop` are the legacy pair a released editor reads. Nothing writes, derives or zeroes the legacy pair — it round-trips as loaded (`v3ToV2` copies it). `migrateScrollToOrigin` reads it only when a document has no numeric origin pair (`createAndMergeSettings`) and always in `v2ToV3`.
- **`toJson` normalizes a copy, never the live state**: the `ignoreSaveSettings` scroll bit zeroes `originX` / `originY` only, the zoom bit sets `zoomLevel` to 1, and the legacy pair is written untouched.
- **`width` / `height` are compatibility fields too**: clamped, required and round-tripped, but no entity position is bounded by them. Readers: the migration, the editor's SQL / GraphQL / DBML / AML importers (which write them) and `sortTableAction` (wraps rows at `width`); a released editor draws them as its document box.
- **Zoom and size bounds** (`CANVAS_ZOOM_MIN` 0.1, `CANVAS_ZOOM_MAX` 1.5, `CANVAS_SIZE_MIN` 2,000, `CANVAS_SIZE_MAX` 20,000) are clamped on parse, so widening one is backward compatible and narrowing one silently rewrites saved documents. `json-schema/schema.json` repeats them.
- **A v3 shape change** touches the type in `v3/schema/`, the factory and `createAndMerge*` in `v3/parser/`, both `convert/` files if it must survive a v2 round trip, `migrateScroll.ts` if it moves `width`, `height`, `zoomLevel`, `scrollLeft` or `scrollTop`, and `json-schema/schema.json` by hand — nothing generates it.
- **`selectByIds` reads `ids.length` before mapping** to register an r-html observable dependency; removing that line breaks reactivity on id-list changes.
- `removeAll()` replaces only the query's private collection reference; replacing the parent `collections[key]` slot is the caller's job.
- **LWW comparisons are the correctness core**: add runs its recipe when `removeVersion < version`, remove when `addVersion <= version`, replace when the path's previous version `<= version`. `src/query/lww.test.ts` pins all three.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/erd-editor-schema --fail-if-no-match test` — `node` environment.
- For a format change, round-trip `data/test.json` (a v2 document) through the editor by hand and validate the export against `json-schema/schema.json`.

### Common Patterns

- Constant sets are `as const` objects paired with a `*List` array (`DatabaseList`, `NameCaseList`), re-exported through `SchemaV3Constants` / `SchemaV2Constants`.
- Collections are `Record<id, Entity>`, ordered separately in `doc`. Factories default `id` to `''` (the editor mints the real one) and `meta` to `getDefaultEntityMeta()`.

## Dependencies

### Internal

None — leaf package.

### External

`es-toolkit` (type guards, `pick`, `clamp`, `difference`; `round` from `es-toolkit/compat`) and `nanoid` (ids in `v2ToV3`), both left external.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
