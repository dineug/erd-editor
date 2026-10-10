<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-10-10 -->

# erd-editor-schema

## Purpose

Defines the persisted `.erd` / `.vuerd` document: v2 and v3 schemas, defensive parsers, v2 → v3 conversion, its two serializations (the runtime value and the storage form), a query layer over v3 collections, and the LWW operators. Its workspace consumers are `@dineug/erd-editor` and `mcp-server`, which lists it as a devDependency and inlines `parser`, `query`, `toJson` and `createSchema` into its published bundle (`SchemaV3Constants` only in its specs). The package is private but the format is public: every document `schemaV3Parser` builds, a converted v2 one included, is stamped with a `$schema` URL pointing at the repo-root `json-schema/schema.json`.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public surface: `parser`, `toJson`, `toDocumentJson`, `schemaV2Parser`, `schemaV3Parser`, `createSchema`, `query`, the three LWW operators, `migrateScrollToOrigin`, the constant sets and types |
| `src/parser.ts` | Version sniffing (`version === '3.0.0'`, else v2) and `toJson`, the runtime value |
| `src/document.ts` | `toDocumentJson`, the storage form a file holds, and `toDocument`, the same as an object for the specs |
| `src/normalizeSettings.ts` | The settings normalization both serializations write through |
| `src/v3/parser/migrateScroll.ts` | `migrateScrollToOrigin` — legacy scroll pair → `originX` / `originY`, one way only |
| `src/v3/schema/settings.ts` | Settings type, constant sets and the `CANVAS_*` bounds |
| `src/query/index.ts` | `query(collections).collection(key)` — CRUD plus collection-bound LWW operators |
| `src/query/lww.ts` | `addOperator` / `removeOperator` / `replaceOperator` over `LWW = Record<id, [tag, addVersion, removeVersion, Record<path, version>]>` |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/v3/schema/`, `src/v3/parser/` | One file per entity in each: its type and constant sets; its `create*` factory and `createAndMerge*` parser, built from `src/helper.ts` |
| `src/v2/` | Legacy `schema/` and `parser/`, plus `migrations/` (relationship type renames) |
| `src/convert/` | `v2ToV3.ts`; nothing converts down to v2 |

## For AI Agents

### Working In This Directory

- **Parsers never throw on field values**: they validate per field and fall back to factory defaults (only the string entry points let `JSON.parse` throw). The editor seeds its store from `createSchema()` (`src/v3/parser/index.ts`), which is `schemaV3Parser({})`: every bit of `lockSettings` set (`LockSettingType`: viewport, canvasType, language, tableNameCase, columnNameCase, bracketType), each at its default.
- **A file without `lockSettings` was saved before the locks** (owner decisions of 2026-10-06): `resetPreLockView` (`v3/parser/settings.ts`, and `parser` after `v2ToV3`) locks all of them and sets `originX`, `originY`, `zoomLevel` and `canvasType` to the defaults, the language, name cases and bracket keeping what the file saved; `ignoreSaveSettings` is never read nor written. A file that names `lockSettings` keeps every value it saved and every bit, unknown ones too, as `show` does (only made an int32): a lock a later release adds outlives a save by this one, since every reader tests only the bits it knows (`bHas`).
- **`settings.lockedValues` lives in memory only**: what each locked setting saves, rebuilt from the saved fields on every parse (`toLockedValues`), so a v3 shape change to a lockable field touches `LockSettingFields` too, and `v2ToV3` rebuilds it after `assignCanvas`. Neither serialization writes it. An origin pair is taken only when both are finite numbers, else migrated, and a canvas type lock that holds Settings, which no editor writes, opens on the ERD.
- **`originX` / `originY` are the one view the settings hold.** A file saved before them holds the legacy `scrollLeft` / `scrollTop` and the canvas box `width` / `height` instead, which no `Settings` field keeps: `createAndMergeSettings` reads them off the raw JSON when a document has no finite origin pair (`toLegacyScrollBox`, each size clamped to the `CANVAS_SIZE_*` bounds, a missing one at the default it had, 2000 or 0) and `v2ToV3` off the v2 canvas, both through `migrateScrollToOrigin`, and nothing writes them again.
- **Two serializations of one state** (owner decisions of 2026-10-10). `toJson` is the runtime value: what an editor holds, tombstones, stubs, sequences, z-indexes, widths and anchors included, lossless but for the lww registers, which a collaborator or a second view seeds from. `toDocumentJson` is the storage form, what a file holds: the live entities alone (each listed table with an entity, once, in the order listed; the columns a kept table lists; a relationship only while both its tables are kept, its column ids as held; an index only while its table is kept, with the index columns whose column that table lists; the listed memos and groups; a `groupId` only while it names a kept group), each field written by name in schema order, never by spreading the runtime object, so an unknown key never leaks; no sequence, z-index, width, column `ui`, anchor, `identification` or `startRelationshipType`, which an editor derives on load or keeps for one instance; every collection keyed in code unit order of its ids, columns by `tableId` first and index columns by `indexId` first, while the `doc` arrays keep their order, since the DDL, the sort and the draw ties read it (an id that reads as an array index comes first, as in any object); numbers as held; `JSON.stringify(…, null, 2)` and a trailing newline. `toDocumentJson(parser(f)) === f` for every `f` it wrote (`src/document.test.ts`).
- **A parse restores the sequences the storage form leaves out**: a `seqColumnIds` (`seqIndexColumnIds`) that is missing or lacks an id `columnIds` (`indexColumnIds`) lists starts at a copy of that list (`restoreSequence`), since a re-add sorts an id missing from the sequence past every other and so reorders the live ones; one that holds every listed id is kept, extra ids included.
- **Both serializations normalize a copy, never the live state** (`normalizeSettings`): each locked setting is written at its `lockedValues` entry, every other one as it stands, `lockedValues` is left out, and `ignoreSaveSettings` is not written at all (owner decisions of 2026-10-10). A document no parser built (raw JSON) has no `lockedValues`, so its fields are written as they stand. `settings.ddlScripts` (the Schema SQL `before` and `after` scripts, which no lock holds) is written only while `before` or `after` holds text, both fields then, right after `lockSettings`; a document without it parses to two empty strings, so a file that never had a script keeps its bytes.
- **Removed fields stay readable and are never written** (owner decisions of 2026-10-10): `Settings` has no `width`, `height`, `scrollTop`, `scrollLeft` or `relationshipOptimization`, and no entity has `meta`; a parse drops them like any unknown key, so a file that holds them loses them on its next save, and `json-schema/schema.json` keeps their `properties` with none of them `required`, so such a file still validates. The fields the storage form leaves out keep their `properties` there too, none of them `required`.
- **Zoom and size bounds** (`CANVAS_ZOOM_MIN` 0.1, `CANVAS_ZOOM_MAX` 1.5, `CANVAS_SIZE_MIN` 2,000, `CANVAS_SIZE_MAX` 20,000): the zoom is clamped on parse, so widening a zoom bound is backward compatible and narrowing one silently rewrites saved documents; the size bounds clamp the legacy box a migration reads and the editor's sort width. `json-schema/schema.json` repeats them.
- **A relationship's `onDelete` / `onUpdate`** hold a `ReferentialAction`, `none` (1) by default, which writes no clause: a document saved before them loads unset.
- **`Show.hideReferentialAction` (1024) and `Show.hideTableGroup` (2048) read the other way round** from every other `Show` bit: set, the first hides the ON DELETE / ON UPDATE labels the editor draws on connectors and the second the table groups, so a document saved before either, which lacks the bit, shows them (owner decisions). `defaultShow` leaves both out.
- **Table groups** live in `collections.tableGroupEntities` (`name`, `color`, `ui` `x` / `y` / `width` / `height` / `zIndex`), ordered in `doc.tableGroupIds`. Membership is the table's `groupId`, `''` for none, so a table is in one group at most and a group holds no member list; a `groupId` naming no group in `doc.tableGroupIds` reads as none, a rule for the readers, since the parser keeps the id as saved. A document saved before them parses to an empty collection, empty ids and every `groupId` `''`. `toJson` writes them sparsely, as it writes `ddlScripts` (an owner decision): the collection and the ids only while either holds an entry, so also while a removed group's tombstone is left, a `groupId` only while it is not `''`, even one naming no listed group, so a document that never had a group keeps its bytes; `toDocumentJson` writes the collection and the ids only while a kept group exists. a release before them drops them on its next save, its parser keeping only the keys it knows.
- **A v3 shape change** touches the type in `v3/schema/`, the factory and `createAndMerge*` in `v3/parser/`, `document.ts`, which writes each saved field by name and so saves no field it does not name, `convert/v2ToV3.ts` if a v2 field maps onto it, `migrateScroll.ts` if it moves `zoomLevel`, and `json-schema/schema.json` by hand — nothing generates it.
- **`selectByIds` reads `ids.length` before mapping** to register an r-html observable dependency; removing that line breaks reactivity on id-list changes.
- `removeAll()` replaces only the query's private collection reference; replacing the parent `collections[key]` slot is the caller's job.
- **LWW comparisons are the correctness core**: add runs its recipe when `removeVersion < version`, remove when `addVersion <= version`, replace when the path's previous version `<= version`. `src/query/lww.test.ts` pins all three.

### Testing Requirements

- `pnpm exec vp run --filter @dineug/erd-editor-schema --fail-if-no-match test` — `node` environment.
- For a format change, round-trip `data/test.json` (a v2 document) through the editor by hand and validate the export against `json-schema/schema.json`.

### Common Patterns

- Constant sets are `as const` objects paired with a `*List` array (`DatabaseList`, `NameCaseList`), re-exported through `SchemaV3Constants` / `SchemaV2Constants`.
- Collections are `Record<id, Entity>`, ordered separately in `doc`. Factories default `id` to `''` (the editor mints the real one).

## Dependencies

### Internal

`@dineug/uuid` (`uuid25`, the index column ids `v2ToV3` mints), in `dependencies` and so left external: `erd-editor` and `mcp-server` list it as a devDependency and inline it.

### External

`es-toolkit` (type guards, `pick`, `clamp`, `difference`; `round` from `es-toolkit/compat`), left external.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
