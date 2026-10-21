<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-10-21 -->

# erd-editor-schema

## Purpose

Defines the persisted `.erd` / `.vuerd` document: the v2 and v3 schemas, defensive parsers and the v2 → v3 conversion. It also holds two serializations (the runtime value and the storage form), a query layer over the v3 collections and the LWW operators. Its workspace consumers are `@dineug/erd-editor` and `mcp-server`, which lists it as a devDependency and inlines `parser`, `query`, `toJson`, `toDocumentJson`, `createSchema` and `compareByOrder` into its published bundle (`SchemaV3Constants` only in its specs). The package is private, but the format is public: every document `schemaV3Parser` builds, a converted v2 one included, is stamped with a `$schema` URL pointing at the repo-root `json-schema/schema.json`. A change keeps every file an earlier release saved readable, and keeps `toDocumentJson(parser(f)) === f` for every `f` that today's `toDocumentJson` writes; a file an earlier release wrote goes back with only its empty text, lists and collections left out (Two serializations).

## Making a Change

1. For a change to an export, a type or what a parse or a serialization returns, read the consumers' files (root step 1): `packages/erd-editor/AGENTS.md`, `packages/erd-editor/src/engine/AGENTS.md` (§ Loads and new documents rests on `createSchema` and `resetPreLockView`), `packages/erd-editor/src/components/erd/AGENTS.md` (§ Coordinates and scrolling rests on the legacy view fields) and `packages/mcp-server/AGENTS.md`. `packages/app/AGENTS.md` rests on `toDocumentJson` too, which its fingerprints read.
2. For a change to the document shape or to a constant value a document stores, follow Rules § Format changes and edit `json-schema/schema.json` by hand. Moving or renaming that file changes root § Contracts Outside This Repo, so ask the owner first: every saved file's `$schema` names its URL.
3. Run root step 3 as `pnpm exec vp run --filter ./packages/erd-editor-schema --fail-if-no-match test`. Run `pnpm test` as well for a change to an export, a type or what a parse or a serialization returns. `erd-editor` and `mcp-server` type-check against this package's `dist/**/*.d.ts` and inline its code.
4. Run root step 4 as `pnpm --filter ./packages/erd-editor-schema --fail-if-no-match test:coverage`. It measures every `src/**/*.ts` (`coverage.include`) except the specs, `.d.ts` files and `src/internal-types/**` (`coverage.exclude`), and holds each file to 80%.
5. Run root step 5 with `pnpm peer-graph` and `pnpm size` for any change to shipping source, since `erd-editor` inlines this package. `mcp-server` inlines it too, so also run its `test` task (`pnpm exec vp run --filter ./packages/mcp-server --fail-if-no-match test`, or `pnpm test`, which includes it). Its `bin.test.ts` holds the built file to `BUNDLE_GZIP_BUDGET`.
6. For root step 6, a format change takes the hand round trip of `data/test.json` (Testing Requirements), and behaviour a user sees in the editor takes `erd-editor`'s e2e.
7. In the report (root step 7), say whether the hand round trip ran, and the reason where it did not.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public surface: `parser`, `toJson`, `toDocumentJson`, `schemaV2Parser`, `schemaV3Parser`, `createSchema`, `query`, the order keys (`compareByOrder`, `generateOrderKeyBetween`, `generateOrderKeys`, `isOrderKey`, `Ordered`), the three LWW operators, `migrateScrollToOrigin`, the lock reads `isSettingLocked` and `setSettingLock`, the constant sets and types |
| `src/parser.ts` | Version sniffing (`version === '3.0.0'`, else v2) and `toJson`, the runtime value |
| `src/storageForm.ts` | `toDocumentJson`, the storage form a file holds, and `toDocument`, the same as an object for the specs |
| `src/normalizeSettings.ts` | The settings normalization both serializations write through |
| `src/dictionaryRows.ts` | The header and rows the three dictionary collections are written as (`DictionaryFields`, the runtime value's `RuntimeDictionaryFields`, `toDictionaryRows`, `fromDictionaryRows`) and `stringifyDocument`, the text both serializations write |
| `src/orderKey.ts` | A dictionary row's order key: `generateOrderKeyBetween` and `generateOrderKeys` (fractional index keys, written here with no dependency), `isOrderKey`, `compareByOrder` (a sheet's order), `settleOrderKeys` (the keys a parse gives the rows that hold none); exported for `erd-editor` and `mcp-server` |
| `src/helper.ts` | The field-by-field fallbacks every `createAndMerge*` parser is built from (`assign`, `validString`, `validNumber`, `propOr`), and `restoreSequence` |
| `src/v3/parser/index.ts` | `schemaV3Parser` (`parser` in the file), `createSchema` and the z-index stacking |
| `src/v3/parser/settings.ts` | `createAndMergeSettings`, `toLockedValues`, `resetPreLockView`, and the column order rule `toFullColumnOrder` / `toSavedColumnOrder` |
| `src/v3/parser/migrateScroll.ts` | `migrateScrollToOrigin`: legacy scroll pair → `originX` / `originY`, one way only |
| `src/v3/schema/settings.ts` | Settings type, constant sets, `LockSettingFields`, `InvertedLockSettings` with `isSettingLocked` / `setSettingLock`, and the `CANVAS_*` bounds |
| `src/query/index.ts` | `query(collections).collection(key)`: CRUD plus collection-bound LWW operators |
| `src/query/lww.ts` | `addOperator` / `removeOperator` / `replaceOperator` over `LWW = Record<id, [tag, addVersion, removeVersion, Record<path, version>]>` |
| `json-schema/schema.json` (repo root) | The JSON Schema of the storage form, kept by hand |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/v3/schema/`, `src/v3/parser/` | One file per entity in each: its type and constant sets; its `create*` factory and `createAndMerge*` parser, built from `src/helper.ts` |
| `src/v2/` | Legacy `schema/` and `parser/`, plus `migrations/` (relationship type renames) |
| `src/convert/` | `v2ToV3.ts`; nothing converts down to v2 |
| `src/query/` | The query layer and the LWW operators |

## Rules

### Parsing

- **Parsers never throw on field values.** Each parser validates per field and falls back to the factory default, so `schemaV3Parser({})` yields a complete empty document. The input itself can still throw. `parser`, the one string entry point, lets `JSON.parse` throw on text that is not JSON. It throws a `TypeError` on JSON that is not an object, such as `null`, as `schemaV3Parser` and `schemaV2Parser` do on `null` or `undefined`.
- **`createSchema()` seeds the editor's store.** It lives in `src/v3/parser/index.ts` and is `schemaV3Parser({})`. Every lock of `lockSettings` is on, each setting at its default: `LOCK_ALL` sets every `LockSettingType` bit (viewport, canvasType, language, tableNameCase, columnNameCase, bracketType) but the inverted `unlockNameViewMode`, whose clear bit is its lock, so it is 63.
- **A parse restores the sequences storage omits.** A `seqColumnIds` (`seqIndexColumnIds`) that is missing, or lacks an id `columnIds` (`indexColumnIds`) lists, starts at a copy of that list (`restoreSequence`). Otherwise a re-add sorts an id missing from the sequence past every other, and so reorders the live ones. A sequence that holds every listed id is kept, extra ids included.
- **A parse reads a dictionary collection by its header** (an owner decision of 2026-10-20). `fromDictionaryRows` reads each row by the names `fields` lists, ignores a name no entity has and leaves a value a row lacks at its default, so a field added later reads from older rows. A collection held as an id map, as an editor holds it, reads too, so a parse of a parsed document keeps its dictionaries. The membership is `doc.wordIds` / `termIds` / `domainIds` when the document names it, as the runtime value does, and otherwise the rows' own, each id once. A row with no order key is keyed after the greatest key held, the listed rows first in their order (`settleOrderKeys`, `src/orderKey.ts`), so the rows of a file, which hold no key, are keyed in their order on every peer.
- **A parse clears a `domainId` naming no domain.** A column's or a term's `domainId` that names no entity in `domainEntities` reads as `''`. A removed domain, still in the collection though not in `doc.domainIds`, keeps its links, since an undo can bring it back; the storage form leaves those links out (Entities).
- **A parse stacks unsaved z-indexes in doc order** (an owner decision of 2026-10-10). A table, memo or group whose raw entity has no numeric `ui.zIndex` takes its first place in `doc.tableIds`, `doc.memoIds` or `doc.tableGroupIds`. The count starts at the factory default, 2 for tables and 1 for groups, and memos count on past the highest z-index a listed table holds. Tables and memos share one stack in the editor, so two counts starting at 2 would bury the memos under the later tables a file lists, where every memo stood over every table before. One that carries a z-index keeps it, a runtime value's and an older file's alike, and one not listed keeps the default (`v3/parser/index.ts`).

### Two serializations

- **`toJson` and `toDocumentJson` write one state two ways** (owner decisions of 2026-10-10).
  - `toJson` is the runtime value, which a collaborator or a second view seeds from. It holds what an editor holds, tombstones, stubs, sequences, z-indexes, widths and anchors included. It is lossless but for the lww registers and the live value of each locked setting, which it writes at its `lockedValues` entry (below).
  - The tombstones are kept because a collaborator or a second view needs them to undo a removal it did not see.
  - `toDocumentJson` is the storage form, what a file holds. Its entities, field order, left-out fields and key order follow in the next bullets.
- **The storage form holds the live entities alone.** It writes each listed table with an entity, once, in the order listed, and the columns a kept table lists. It writes a relationship only while both its tables are kept, its column ids as held. It writes an index only while its table is kept, with the index columns whose column that table lists. It writes the listed memos and groups, the group collection and `doc.tableGroupIds` only while a kept group exists, and a `groupId` only while it names a kept group.
- **The storage form writes each field by name.** Fields go out in schema order, never by spreading the runtime object, so an unknown key never leaks.
- **The storage form omits derived, per-instance fields.** It writes no sequence, z-index, table `widthName` / `widthLogicalName` / `widthComment`, column `ui`, anchor, `identification` or `startRelationshipType`. An editor derives these on load or keeps them for one instance.
- **The storage form writes the newer fields only while they hold a value** (owner decisions). A logical name of only blanks holds none and goes out as no field, as every view reads it, while the runtime value keeps it as typed (an owner decision of 2026-10-21). So does a dictionary row holding nothing past its id, blanks read as none (`holdsValue`): a word, a term or a domain added and never filled, or emptied, stays out of the file with every link to such a domain, and the runtime value keeps it listed (an owner decision of 2026-10-21). A table's `logicalName` goes out after `name` and `nameDerived` after `groupId`, the second only while `true`. A column's `logicalName` and `domainId` go out after `options`, the `domainId` only while it names a kept domain. The `nameDerived` bit of `options` (16) stays in the number.
- **The storage form leaves out empty text** (an owner decision of 2026-10-21, which accepts the one-time diff of each file an earlier release wrote, on its next save). A text field an entity or its `ui` holds as `''` goes out as no field, since a parse gives a missing one the `''` its factory starts from: a table's `name`, `comment` and `ui.color`, a column's `name`, `comment`, `dataType` and `default`, an index's `name`, a memo's `value` and `ui.color`, and a group's `name` and `color` (`textField`). Text of only blanks is a value and goes out as held, as do the ids, the lists, the relationship ends, the numbers, `0` among them, the booleans and every setting but `ddlScripts` and `nameViewMode`, which go out as their bullets below say. What is written keeps the schema order. A `doc` list or a collection that holds nothing goes out as no field as well, and so does `collections` once it holds none, since every v3 release reads a missing one as empty (an owner decision of 2026-10-21). `doc` goes out even empty, so a new document is its settings and `"doc": {}`: every release of `app`'s `isEditorDocument` and of the Obsidian tab's `isReadableDiagram` before this takes a v3 file by its `doc` and refuses one without it.
- **The dictionaries are written as a header and rows** (an owner decision of 2026-10-20, since an id map repeats every key on every entry). `wordEntities`, `termEntities` and `domainEntities` each go out as `{ fields, rows }`, after every other collection and in that order, only while one holds a live entry. `fields` lists the entity's fields once, id first (`DictionaryFields`). `rows` holds one array per live entry in key order (`compareByOrder`), the key itself left out, its values in `fields` order, the trailing empty ones (`''`, `[]`) past the name left out and the ones before kept. A term's link to a removed domain is written `''`. The file holds no dictionary order beside the rows, since they hold it themselves: `doc` writes no `wordIds`, `termIds` or `domainIds`.
- **One row a line.** `stringifyDocument` runs `JSON.stringify(…, null, 2)` with each `rows` left empty, then writes the rows, one `JSON.stringify(row)` a line, into each `"rows": []` that leaves, in the order the collections are written. A string holding that text is written with its quotes escaped, so only the placeholder matches, and every other byte is what `JSON.stringify` writes.
- **The storage form sorts keys and keeps arrays.** Every collection but the dictionaries is keyed in code unit order of its ids, so saving the same document twice writes the same bytes. Columns sort by `tableId` first and index columns by `indexId` first. An id that reads as an array index comes first, as in any object. The `doc` arrays and the dictionary rows keep their order, since the DDL, the sort, the draw ties and the dictionary sheets read it.
- **The storage form round-trips byte for byte.** It writes numbers as held, as `JSON.stringify(…, null, 2)` text, a dictionary row a line, and a trailing newline. `toDocumentJson(parser(f)) === f` for every `f` it wrote (`src/storageForm.test.ts`). A file an earlier release wrote, each in `src/__fixtures__/storage-form/` and random ones (`src/storageForm.golden.test.ts`), is written back with only its empty text, lists and collections left out, parses to the runtime value it parsed to before, and round-trips from then on.
- **The column order goes out in seven entries where it can** (an owner decision). `ColumnType` holds nine column types, and a document's order holds all nine. Both serializations write it through `toSavedColumnOrder`, which leaves `columnLogicalName` and `columnDomain` out while they stand where `toFullColumnOrder` puts them, so a file that never moved them keeps the seven it saved and an older release, which reads seven or nothing, keeps its order. Moved, all nine are written.
- **Both serializations normalize a settings copy** (owner decisions of 2026-10-10). They write through `normalizeSettings` on a copy, never the live state. It writes each locked setting, each lock read through `isSettingLocked`, at its `lockedValues` entry and every other one as it stands, but the column order, which goes out in seven entries where it can (above). It leaves `lockedValues` out and does not write `ignoreSaveSettings` at all. A document no parser built (raw JSON) has no `lockedValues`, so its fields are written as they stand, the column order again in seven entries where it can.
- **`settings.nameViewMode` is written last, only while it is not `physical`** (owner decisions of 2026-10-19). It goes out after `ddlScripts`, at its lock's value while the name view is locked, so `ddlScripts` stays right after `lockSettings` and a file that never showed other names writes no such field. A document without it parses to `physical`. `json-schema/schema.json` names `logical` and `both` alone, as it names `nameDerived` only `true`.
- **`settings.ddlScripts` is written only while it holds text.** It holds the Schema SQL `before` and `after` scripts, which no lock holds. Both fields go out, right after `lockSettings`, while `before` or `after` holds text. A document without it parses to two empty strings, so a file that never had a script writes none.
- **`json-schema/schema.json` describes the storage form alone** (an owner decision of 2026-10-11, since nothing outside the repository depends on it). Every object it names is closed (`additionalProperties: false`), and every field `toDocumentJson` always writes is `required`; a field it leaves out while empty, the empty text, lists and collections and the newer fields, is named but not `required`. It names no field the storage form always leaves out. So the runtime value fails it, as does a file an older release saved with `meta`, sequences, z-indexes, table widths, column `ui`, anchors or the removed settings, until a save rewrites them.
- **`src/jsonSchema.test.ts` holds schema and storage form equal.** It checks both ways: the storage form of a document reaching every saved field validates, and reaches every property the schema names. The storage form of a document whose empty text is left out validates too.

### Settings and locks

- **A file without `lockSettings` predates the locks** (owner decisions of 2026-10-06). Such a file keeps the factory `lockSettings` (`LOCK_ALL`, every lock on), and `resetPreLockView` (`v3/parser/settings.ts`, and `parser` after `v2ToV3`) sets `originX`, `originY`, `zoomLevel` and `canvasType` to the defaults. Its view and tab start where a new document's do, since what it saved of them was only where its last reader stood. The language, name cases and bracket keep what the file saved.
- **`ignoreSaveSettings` is neither read nor written** (owner decisions of 2026-10-06). A parse drops it, and neither serialization writes it.
- **A file naming `lockSettings` keeps it whole.** It keeps every value it saved and every bit, unknown ones too, as `show` does, the bits only made an int32 (`| 0`). So a lock a later release adds outlives a save by this one, since every reader tests only the bits it knows (`isSettingLocked`).
- **The name view's bit reads the other way round** (an owner decision of 2026-10-19). `LockSettingType.unlockNameViewMode` (64) unlocks `nameViewMode` while set, as the hide bits of `Show` hide while set (`InvertedLockSettings`), so a new document keeps 63 and every file saved before the bit, with `lockSettings` or without, opens with the name view locked. Decide whether a setting is locked through `isSettingLocked`, and lock or unlock one through `setSettingLock`, never by testing or setting its bit: both take a single bit and throw a `RangeError` on a mask, which is read bit by bit over `LockSettingTypeList`. Two kinds of code may handle the bits directly: a copy of the bits as they stand (the parser's `| 0`, `erd-editor`'s `landLoadedSettings` taking each lock from a load), which decides nothing, and a read limited to bits that are not inverted (`mcp-server`'s `toSavedSettings` over the code locks, `app`'s fingerprint over the view locks), which finds each locked while it is set, as `isSettingLocked` does.
- **A locked Settings tab opens on the ERD.** A file that names `lockSettings` with the `canvasType` bit set and `canvasType` at the Settings tab opens on the ERD. No editor locks that tab, so only a hand edit can have written it.
- **`settings.lockedValues` lives in memory only.** It holds what each locked setting saves, rebuilt from the saved fields on every parse (`toLockedValues`). Neither serialization writes it. A v3 shape change to a lockable field therefore touches `LockSettingFields` too, and `v2ToV3`'s `assignCanvas` rebuilds `lockedValues` as its last step.

### Legacy view fields

- **`originX` / `originY` are the one saved view.** A file saved before them holds the legacy `scrollLeft` / `scrollTop` and the canvas box `width` / `height` instead, which no `Settings` field keeps. An origin pair is taken only when both are finite numbers, else migrated.
  - `createAndMergeSettings` reads the legacy fields off the raw JSON when a document has no finite origin pair (`toLegacyScrollBox`). Each size is clamped to the `CANVAS_SIZE_*` bounds; a missing one takes the default it had, 2000 for a size and 0 for a scroll.
  - `v2ToV3` reads them off the v2 canvas.
  - Both go through `migrateScrollToOrigin`, and nothing writes the legacy fields again. The migrated origin is kept only in a file that names `lockSettings`; in one without it, `resetPreLockView` then sets the origin to the default (Settings and locks).
- **Removed fields stay readable and are never written** (owner decisions of 2026-10-10). `Settings` has no `width`, `height`, `scrollTop`, `scrollLeft` or `relationshipOptimization`, and no entity has `meta`. A parse drops them like any unknown key, so a file that holds them loses them on its next save.

### Format changes

- **A v3 shape change touches every layer.** Change each of these together:
  - the type in `v3/schema/`;
  - the factory and `createAndMerge*` in `v3/parser/`;
  - `storageForm.ts`, which writes each saved field by name and so saves no field it does not name;
  - `LockSettingFields`, for a lockable field;
  - `convert/v2ToV3.ts`, if a v2 field maps onto it;
  - `migrateScroll.ts`, if it moves `zoomLevel`;
  - `json-schema/schema.json`, by hand: nothing generates it, and `src/jsonSchema.test.ts` holds it to the storage form.
- **Constant sets a document stores are append only** (`Database`, `Language`, `Show`, `ColumnType`, `ColumnOption`, `LockSettingType`, `ReferentialAction`). A file holds the number, so a new value takes the next bit at the end of its set. Add it to `json-schema/schema.json` by hand, in that field's `enum` where it has one and in its `bit value (…)` `description`. `src/jsonSchema.test.ts` never compares those to the lists, so a missed entry passes every spec. A parser opens a value it does not know at the default (`language` as GraphQL, through `validNumber`), as a release older than the value opens the file.
- **A `ColumnType` an order lacks goes where a parse puts it.** A document saved before `columnLogicalName` (128) and `columnDomain` (256) holds an order of seven. `toFullColumnOrder` puts the logical name just before `columnName` and the domain just after `columnDataType`, takes nine as they stand, and answers `null`, the default, for any other order, eight entries included. `v2ToV3` reads a v2 order through it too. A later type takes a place of its own in both functions, and `json-schema/schema.json`'s length rule names its count.
- **Zoom and size bounds live in `src/v3/schema/settings.ts`.** They are `CANVAS_ZOOM_MIN` 0.1, `CANVAS_ZOOM_MAX` 1.5, `CANVAS_SIZE_MIN` 2,000 and `CANVAS_SIZE_MAX` 20,000. The zoom is clamped on parse, so widening a zoom bound is backward compatible and narrowing one silently rewrites saved documents. The size bounds clamp the legacy box a migration reads and the editor's sort width. `json-schema/schema.json` repeats the zoom bounds.

### Entities

- **Referential actions default to `none`.** A relationship's `onDelete` / `onUpdate` hold a `ReferentialAction`, `none` (1) by default, which writes no clause. A document saved before them loads unset.
- **Three `Show` bits read inverted.** `Show.hideReferentialAction` (1024), `Show.hideTableGroup` (2048) and `Show.hideMemo` (4096) read the other way round from every other `Show` bit (owner decisions). Set, the first hides the ON DELETE / ON UPDATE labels the editor draws on connectors, the second the table groups and the third the memos. So a document saved before one, which lacks its bit, shows what it names. `defaultShow` leaves all three out.
- **Three dictionaries hold the words, terms and domains** (owner decisions of 2026-10-20). A `Word` has `name`, `abbreviation`, `englishName`, `description`, `synonyms` and `forbiddenWords`; a `Term` has `name`, `physicalName`, `domainId`, `description` and `synonyms`; a `Domain` has `name`, `category`, `dataType` and `description`. Every field is a string, and `synonyms` and `forbiddenWords` are comma separated. None has a `ui`. They are listed in `doc.wordIds`, `doc.termIds` and `doc.domainIds`, which the file does not save (Two serializations), and ordered by `order`, a fractional index key compared in code unit order, a row of one key by id and a row with no key last (`compareByOrder`, owner decisions of 2026-10-21). The runtime value alone holds the key; a file holds its rows in that order.
- **A table and a column carry a logical name.** `logicalName` is `''` for none. A table's `nameDerived` and a column's `ColumnOption.nameDerived` bit say the dictionaries filled the name, which a new logical name then derives again; unset, the name is someone's own, which a new logical name leaves alone while it is not empty. An empty or blank name derives whatever the flag says, and only an explicit derive again (`erd-editor`'s `rederiveNamesAction$`) rewrites one someone wrote. So a file that lacks them, older or saved by a release that dropped them, keeps every name that is not empty. A set column bit can still mark a name someone wrote: a release before the bit keeps `options` as saved and renames a column without clearing it, so a column renamed there keeps the bit, and its next logical name derives the name again. The table's flag is a key of its own, which such a release drops on save, so it never outlives a rename there.
- **`domainId` is the dictionaries' one link.** A column or a term links a domain by id, `''` for none, and a term reaches a column only by its name matching the column's `logicalName`. Unlike `groupId`, which the parser keeps as saved for the readers to judge, a `domainId` naming no domain is cleared on parse (Parsing), so no reader meets a link to nothing. A link to a removed domain is kept in memory and left out of the storage form; the column keeps the `dataType` it was given.
- **Table groups live in `collections.tableGroupEntities`.** Each has `name`, `color` and `ui` `x` / `y` / `width` / `height` / `zIndex`. The groups are ordered in `doc.tableGroupIds`.
  - Membership is the table's `groupId`, `''` for none, so a table is in one group at most and a group holds no member list.
  - A `groupId` naming no group in `doc.tableGroupIds` reads as none. That is a rule for the readers, since the parser keeps the id as saved.
  - A document saved before groups parses to an empty collection, empty ids and every `groupId` `''`.
  - A release before groups drops them on its next save, its parser keeping only the keys it knows.
- **`toJson` writes table groups sparsely** (an owner decision), as it writes `ddlScripts`. It writes the collection and the ids only while either holds an entry, so also while a removed group's tombstone is left. It writes a `groupId` only while it is not `''`, even one naming no listed group. So a document that never had a group keeps its bytes.
- **`toJson` writes the dictionaries and the newer fields sparsely too.** Each dictionary and its `doc` list go out only while either holds an entry. The dictionary is written as the storage form writes it, a header and one row a line, but with every entry the collection holds, the removed ones included, its order key after the name (`RuntimeDictionaryFields`), and beside its `doc` list, which the add and remove registers run over. A table's `logicalName` and `nameDerived` and a column's `logicalName` and `domainId` are left out at `''` or `false`. The `ui` widths go out as held, `widthLogicalName` and `widthDomain` among them, so the runtime value of every document changed when those widths came in, while its storage form kept its bytes.

### Query and LWW

- **`selectByIds` reads `ids.length` before mapping.** The read registers an r-html observable dependency; removing that line breaks reactivity on id-list changes.
- **`removeAll()` replaces only the query's own reference.** It assigns a new object to the query's private collection reference, so the parent `collections[key]` slot still holds the old one. Replacing that slot is the caller's job.
- **LWW comparisons are the correctness core.** `addOperator` runs its recipe when `removeVersion < version`, `removeOperator` when `addVersion <= version`, `replaceOperator` when the path's previous version `<= version`. So a change that arrives late, from a collaborator, another tab or an undo, applies only when its version says it should; a direct write would win every merge. `src/query/lww.test.ts` pins all three.

## Testing Requirements

- The `test` task (Making a Change step 3) runs `tsc --noEmit`, then Vitest in the `node` environment over `src/**/*.test.ts`.
- For a format change, round-trip `data/test.json` (a v2 document) through the editor by hand.
- `src/jsonSchema.test.ts` validates the storage form against `json-schema/schema.json` with a validator of the keywords that file uses (`anyOf`, `items: false` and a `const` array among them), so a new keyword there needs one in the spec.
- The files in `src/__fixtures__/storage-form/` are what the storage form of an earlier release wrote, kept as its bytes. Never regenerate or edit one: `src/storageForm.golden.test.ts` holds today's code to them, each written back with only its empty text, lists and collections left out.

## Common Patterns

- Constant sets are `as const` objects paired with a `*List` array (`DatabaseList`, `NameCaseList`), re-exported through `SchemaV3Constants` / `SchemaV2Constants`.
- Collections are `Record<id, Entity>`, ordered separately in `doc`, but for the three dictionaries, whose `doc` lists are their membership and whose order is each row's key (`compareByOrder`, Entities). In a file the three dictionaries are a header and rows instead (Two serializations).
- Factories default `id` to `''`, since the editor mints the real one.

## Dependencies

### Internal

`@dineug/uuid` (`uuid25`, the index column ids `v2ToV3` mints), in `dependencies` and so left external: `erd-editor` and `mcp-server` list it as a devDependency and inline it.

### External

`es-toolkit` (type guards, `pick`, `omit`, `mapValues`, `clamp`, `difference`; `round` from `es-toolkit/compat`), left external.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
