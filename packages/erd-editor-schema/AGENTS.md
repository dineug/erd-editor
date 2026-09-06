<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-09-06 -->

# erd-editor-schema

## Purpose

Defines the persisted `.erd` / `.vuerd` document format: the v2 and v3 schemas, defensive parsers that fold arbitrary JSON onto fully-defaulted documents, bidirectional v2↔v3 conversion, a chainable query layer over v3 collections, and the LWW (last-write-wins) operators. `@dineug/erd-editor` is the only direct workspace consumer — it seeds store state from `schemaV3Parser({})`; `app` and the IDE surfaces reach the schema through that package. `private: true`, but the format is public: every parsed document is stamped with a `$schema` pointing at the repo-root `json-schema/schema.json`.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public surface: `parser`, `parserV2`, `toJson`, `query`, the three LWW operators, `migrateScrollToOrigin`, `SchemaV2Constants` / `SchemaV3Constants`, `LWW` types |
| `src/parser.ts` | Version sniffing (`version === '3.0.0'`, else the v2 route) and `toJson`, which per `ignoreSaveSettings` resets `originX` / `originY` to `0` and `zoomLevel` to `1` on a copy of `settings` |
| `src/v3/parser/migrateScroll.ts` | `migrateScrollToOrigin` — the one-way migration from the legacy scroll pair to `originX` / `originY`, `round`ed to 4 decimals, exported from the package root |
| `src/query/lww.ts` | `addOperator` / `removeOperator` / `replaceOperator` over `LWW = Record<id, [tag, add, remove, Record<path, version>]>` |
| `src/query/index.ts` | `CollectionQuery` — `selectById`, `setOne`, `updateOne`, `getOrCreate`, plus the LWW operators bound to a collection key |
| `src/helper.ts` | `assign`, `assignMeta`, `validString`, `validNumber`, `propOr`, `getDefaultEntityMeta` — every parser is built from these |
| `vite.config.ts` | Library build (`BROWSER_TARGET`, ES-only, `vite-plugin-dts`) **and** the `build` / `test` tasks supplied by the shared library factory Builds unminified, one module per source file (`preserveModules`), and the manifest says `sideEffects: false`. |
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
- **`settings` carries two view pairs and they are never cross-derived.** `originX` / `originY` are the live view: the screen point scene `(0, 0)` lands on. `scrollLeft` / `scrollTop` are the frozen legacy pair a released editor reads as its own view, measured from the canvas box centred in the viewport; `migrateScrollToOrigin` reads them, in `createAndMergeSettings` (only when the json carries no numeric origin pair, and from the clamped width/height/zoomLevel) and in `v2ToV3` (always, since a v2 document has no origin). Nothing anywhere writes, derives, zeroes or renames them — they are carried through parse and save exactly as loaded, and `v3ToV2` copies them straight across. A file an old editor saved comes back with only the legacy pair and migrates into the view that editor showed, so nothing drifts.
- `toJson` uses a shallow top-level pick and copies `settings` before normalizing it, so exporting no longer mutates live store state. It is still a normalization step rather than a pure serializer: the `ignoreSaveSettings` scroll bit zeroes `originX` / `originY` alone and the zoom bit flattens `zoomLevel`. An old editor opening such a file still reads the legacy pair it was written with. Zeroing the origin is not the view zeroing the legacy pair used to give: an origin of 0 reloads with scene `(0, 0)` in the corner, where a scroll of 0 reloaded with the canvas box centred, and the two agree only at zoom 1 — deriving one from the other is exactly what the rule above forbids, so the corner is the documented choice. The zoom bit has the same shape: the origin is written as it stands while `zoomLevel` flattens to 1, so the file reloads with scene `(0, 0)` at the same screen point and everything drawn at zoom 1 from there, where the legacy pair reloaded at the scroll that had kept the box centred at the saved zoom — a different view, and no less arbitrary, since the zoom the origin was chosen for is gone either way.
- A v3 shape change touches the type in `schema/`, the factory and `createAndMerge*` in `parser/`, both files in `convert/` if it must survive a legacy round trip, `parser/migrateScroll.ts` if it moves any of the five fields the migration reads, and the repo-root `json-schema/schema.json` — nothing generates that file from these types.
- `selectByIds` reads `ids.length` before mapping to register an r-html observable dependency; removing that line breaks reactivity on id-list changes.
- `query(collections)` exposes `collection`, `selectById(s)`, `selectEntities`, `selectAll`, `set/add/remove` one/many/all operations, `updateOne/many`, `getOrCreate`, and collection-bound LWW operators. `removeAll()` replaces only the query's private collection reference; callers needing the parent `collections[key]` slot replaced must handle that explicitly.
- LWW comparisons are the correctness core: add runs its recipe when `removeVersion < version`, remove when `addVersion <= version`, replace when the path's `prevVersion <= version`. `src/query/lww.test.ts` pins all three.
- The canvas bounds in `v3/schema/settings.ts` are the format's, not the editor's: `CANVAS_ZOOM_MIN` 0.1, `CANVAS_ZOOM_MAX` **1.5** (raised from 1 when the editor's scene moved to canvas), `CANVAS_SIZE_MIN` 2,000, `CANVAS_SIZE_MAX` 20,000. `v3/parser/settings.ts` clamps a parsed `zoomLevel` into that range, so widening the ceiling is backward compatible while narrowing it silently rewrites saved documents.
- **`width` / `height` are a compatibility field, exactly as `scrollLeft` / `scrollTop` are.** The editor's canvas has no edges any more: what it may scroll over and what it exports is the union of the entities themselves, and nothing in its scene reads the box. Three things still do — the migration above, which reads it to place the legacy view; the editor's SQL and schema importers, which write it from a table-count heuristic; and the editor's sort-tables layout, which wraps rows at `width` — and a released editor draws it as its document box. So the pair is still clamped, still required and still round-tripped, but an entity's position is no longer constrained by it in any direction, negative included. Release notes for the first release carrying `originX` / `originY`: a document whose entities lie outside `[0, width]` x `[0, height]` is readable by editors before this release but not fully navigable or exportable there.
- Both tasks list `peerDependencies` in `dependsOn` with the other two fields, the factory's contract for every library; this package declares no workspace dependency now, so nothing here is built against a sibling's `dist/`.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/erd-editor-schema --fail-if-no-match test` — `tsc --noEmit` over `tsconfig.json` (`include: ["src"]`, so the 42 spec files are typechecked too), then `vp test run`.
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

None — leaf package.

### External

- `es-toolkit` `^1.50.0` — `pick` in `toJson`, `clamp` in both settings parsers, `round` from `es-toolkit/compat` in `parser/migrateScroll.ts`, `difference` in `convert/` and in both settings parsers, and the type guards every parser runs on JSON (`isString`, `isNumber`, `isBoolean`, `isNil`, `isPlainObject`; arrays are `Array.isArray`). `nanoid` `^5.1.3` — ids for the v2 → v3 conversion. Both are `dependencies`, so `vite.config.ts` leaves them external.
- `vite-plugin-dts` 5 + `@typescript/typescript6` — declaration emit; the latter exists only because the plugin needs the JS compiler API TypeScript 7 dropped.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
