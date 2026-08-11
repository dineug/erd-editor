<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-08 | Updated: 2026-08-08 -->

# erd-editor-schema (`@dineug/erd-editor-schema`)

## Purpose

Owns the persisted document format for `.erd` / `.vuerd` files: the v2 and v3 schemas, safe parsers
that normalize arbitrary JSON into a fully-populated document, bidirectional v2↔v3 conversion, a
query layer over v3 entity collections, and the **LWW (last-write-wins) register** primitives that
make concurrent editing and conflict resolution possible.

This package is where "what a diagram _is_" is defined; `@dineug/erd-editor` consumes it as the shape
of its store state (`createStore` seeds state with `schemaV3Parser({})`).

### Schema versions

- **v2** — the legacy `vuerd` format: nested arrays of tables/memos/relationships under `table.tables`,
  `memo.memos`, etc.
- **v3** (`version: "3.0.0"`) — normalized `collections` keyed by entity id, plus `doc` (ordered id
  lists), `settings`, and `lww`. This is the current format.
- `parser(source)` sniffs `version` and routes to `schemaV3Parser` or `v2ToV3(schemaV2Parser(...))`,
  so callers only ever deal with v3.

### The LWW register

`LWW = Record<uuid, [tag, addVersion, removeVersion, Record<path, version>]>`

Every entity carries an add version, a remove version, and a per-field version map. `addOperator`,
`removeOperator`, and `replaceOperator` compare an incoming action's version against those and only
apply the change when it wins. Versions come from the editor's `Clock` (a Lamport counter), so the
same three operators serve undo/redo, cross-tab replication, and live collaboration merges.

## Key Files

| File                          | Description                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/index.ts`                | Public surface: `parser`, `parserV2`, `toJson`, `query`, the three LWW operators, both schema namespaces     |
| `src/parser.ts`               | Version sniffing (`parser`) and serialization (`toJson`, which honours `ignoreSaveSettings` for scroll/zoom) |
| `src/helper.ts`               | Shared parsing helpers for coercing untrusted JSON values                                                    |
| `src/internal-types/index.ts` | Internal type utilities (not exported)                                                                       |
| `src/utils/bit.ts`            | Bitfield helpers (`bHas`) — settings flags like `show` and `ignoreSaveSettings` are bitmasks                 |

## Subdirectories

| Directory            | Purpose                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/v3/schema/`     | v3 entity type definitions and factories — `doc`, `settings`, `table.entity`, `tableColumn.entity`, `index.entity`, `indexColumn.entity`, `relationship.entity`, `memo.entity`, `lww` |
| `src/v3/parser/`     | One defensive parser per v3 entity, mirroring `schema/` file-for-file                                                                                                                 |
| `src/v2/schema/`     | Legacy v2 entity shapes (`canvasEntity`, `tableEntity`, `memoEntity`, `relationshipEntity`)                                                                                           |
| `src/v2/parser/`     | v2 parsers (`canvas`, `table`, `memo`, `relationship`)                                                                                                                                |
| `src/v2/migrations/` | In-format v2 fixups — currently `relationshipType.migration.ts`                                                                                                                       |
| `src/convert/`       | `v2ToV3.ts` and `v3ToV2.ts`                                                                                                                                                           |
| `src/query/`         | `index.ts` — chainable `query(collections).collection(k).selectById/selectByIds/selectAll/…`; `lww.ts` — the add/remove/replace operators                                             |

## For AI Agents

### Working In This Directory

- **`schema/` and `parser/` must stay in lockstep.** Adding a field to a v3 entity means updating the
  type, its factory default, its parser, and — if it should survive a round trip through the legacy
  format — both files in `convert/`.
- **Parsers must never throw on malformed input.** They take `any` and fill in defaults; the editor
  relies on `schemaV3Parser({})` producing a complete empty document.
- **Do not bump the version string casually.** `parser.ts` compares `version === '3.0.0'`; anything
  else falls through the v2 path. A new version needs a migration route, not just a constant change.
- **LWW operator semantics are the correctness core** of collaboration and undo. `addOperator` applies
  only when `removeVersion < version`; `removeOperator` only when `addVersion <= version`. Changing
  these comparisons silently corrupts merges — there is no test suite guarding them.
- `query()` calls `ids.length` before mapping (`selectByIds`) purely to register an observable
  dependency in `r-html`. That line looks dead; it is not. Do not remove it.
- Settings flags are bitmasks — use `bHas` rather than equality.
- `@dineug/shared` is a `peerDependency` here so the workspace shares one copy.
- `private: true`, but the format it defines is public via `json-schema/schema.json` at the repo root.

### Testing Requirements

- No `test` target. Verify with `pnpm --filter @dineug/erd-editor-schema build`, then a full
  `pnpm build` since the editor's store state type is derived from these types.
- For format changes, round-trip the fixtures: load `data/test.json` in the editor
  (`pnpm --filter @dineug/erd-editor dev`), export, and diff. Also validate against
  `json-schema/schema.json` at the repo root and update it in the same change.

### Common Patterns

- One entity per file, with a `create*` factory returning fully-defaulted values.
- Entity ids are nanoid strings from `@dineug/shared`.
- Collections are `Record<id, Entity>`; ordering lives separately in `doc`.

## Dependencies

### Internal

- `@dineug/shared` (peer) — type guards and nanoid

### External

- `lodash-es` — `pick` and friends in the parsers/serializer

### Consumers

`@dineug/erd-editor` (store state, `toJson`, LWW operators, `query`) — and transitively every app.

<!-- MANUAL: -->
