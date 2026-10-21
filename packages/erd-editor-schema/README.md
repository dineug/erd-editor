# erd-editor-schema

> ERD Editor's document: schemas, parsers, storage form and runtime value, queries, LWW operators

The document that `.erd`, `.erd.json`, `.vuerd` and `.vuerd.json` files hold: its v3 (current) and
v2 (legacy, still readable) schemas, the parsers that fold a JSON object onto a valid document field
by field, the v2 to v3 conversion, two serializations of one document, a query layer over the v3
collections and the LWW (last-write-wins) operators. The package is `private` and never published
to npm. Its two workspace consumers, the editor core ([`erd-editor`](../erd-editor)) and the MCP
server ([`mcp-server`](../mcp-server)), list it as a devDependency
(`"@dineug/erd-editor-schema": "workspace:*"`) and inline it into their published bundles. The
format itself is public: every v3 document a parser returns carries a `$schema` URL pointing at
[`json-schema/schema.json`](../../json-schema/schema.json), the JSON Schema of the storage form.

## Usage

```ts
import { readFileSync } from 'node:fs';

import { type LWW, parser, query, toDocumentJson, toJson } from '@dineug/erd-editor-schema';

// Either version, either serialization; always an ERDEditorSchemaV3.
const schema = parser(readFileSync('diagram.erd', 'utf8'));

const tables = query(schema.collections).collection('tableEntities');
const table = tables.selectById(schema.doc.tableIds[0]);

// The recipe runs unless the register holds a later replace of this table's name.
const lww: LWW = {};
if (table) {
  tables.replaceOperator(lww, 1, table.id, 'name', () => {
    tables.updateOne(table.id, entity => {
      entity.name = 'member';
    });
  });
}

const file = toDocumentJson(schema); // the storage form, ready to write back
const runtimeValue = toJson(schema); // what a collaborator or a second view seeds from
```

The two strings are two serializations of one document, and `parser` reads both.
`toDocumentJson` writes the storage form, what a file holds: the live entities alone, without the
fields an editor derives on load or keeps for one instance, or the text, lists and collections left
empty, in a fixed key order, so saving the same document twice writes the same bytes. `toJson` writes the runtime value: the collections as an
editor holds them, the tombstones of removed entities included, which a collaborator or a second
view needs to undo a removal it did not see. Both write the three dictionaries (words, terms and
domains) as a header and one row per line.

A field that fails validation falls back to its default, so `schemaV3Parser({})` is a complete
empty document. The input itself can still throw. `parser` throws on text that is not JSON, and a
`TypeError` on JSON that is not an object, such as `null`. `schemaV3Parser` and `schemaV2Parser`
throw a `TypeError` on `null` or `undefined`. `schemaV2Parser` also throws one on a `tables`,
`indexes`, `memos` or `relationships` list, or a table's `columns`, that holds `null`, and so does
`parser`, which reads every document whose `version` is not `3.0.0` as v2.

The surface (`src/index.ts`):

- `parser(source)` — reads text: a v3 document in either serialization, or a v2 file, which it
  converts to v3.
- `toDocumentJson(schema)`, `toJson(schema)` — the storage form and the runtime value, as text.
- `schemaV3Parser(object)` — the v3 fold over an already-parsed object; it checks no version.
- `schemaV2Parser(object)` — the v2 fold, returning `ERDEditorSchemaV2`. No export converts that
  to v3; pass a v2 file's text to `parser` instead.
- `createSchema()` — a new empty v3 document with every lock on. The editor's store starts from
  it, and an empty value loads as it.
- `query(collections)` — `.collection(key)` returns reads and writes over one v3 collection
  (`selectById`, `selectByIds`, `selectAll`, `selectEntities`, `setOne` / `setMany` / `setAll`,
  `addOne` / `addMany`, `updateOne` / `updateMany`, `removeOne` / `removeMany` / `removeAll`,
  `getOrCreate`) and the three LWW operators bound to that collection.
- `compareByOrder(a, b)`, `generateOrderKeyBetween(a, b)`, `generateOrderKeys(a, b, n)`,
  `isOrderKey(value)`, with the `Ordered` type — a dictionary row's order key, a fractional index
  key, and a sheet's order. `compareByOrder` sorts rows by key in code unit order, a row with no
  key after every row with one, and rows of one key, or none, by id. The two generators make one
  key, or `n` keys in order, between `a` and `b`, `null` for no bound on that side; each bound
  must be a key, `a` below `b`, or they throw a `RangeError`. The runtime value alone holds the
  key; a file writes its rows in this order.
- `addOperator`, `removeOperator`, `replaceOperator`, and the `LWW` / `LWWTuple` types — the
  same operators unbound, taking the register's `tag` as an argument: a collection key, or another
  name, such as the `'settings'` tag of the editor core's settings registers.
- `migrateScrollToOrigin`, with its `LegacyScrollBox` / `Origin` types — the one-way conversion
  of the scroll pair a file saved before `originX` / `originY`, with the canvas box and zoom it
  was measured against, into an origin.
- `isSettingLocked(lockSettings, bit)`, `setSettingLock(lockSettings, bit, locked)`, with the
  `LockSettingType` type — read and set one lock of `lockSettings`. The name view's bit reads the
  other way round, locked while clear, and both throw a `RangeError` on a mask of several bits.
- `ERDEditorSchemaV3`, `ERDEditorSchemaV2` — the document types.
- `SchemaV3Constants`, `SchemaV2Constants` — the constant sets each version allows (`Database`,
  `NameCase`, `RelationshipType`, …) and each version's canvas size and zoom bounds.

## Why the LWW operators

Every change carries a version number. An `LWW` record keeps a register per id (an entity's, or a
name such as `settings.databaseName`): its tag and the highest version it has seen of an add, of a
remove and of a replace of each path. A direct write to state wins every merge, so a change that
arrives late — from a collaborator, another tab, or an undo — would silently overwrite newer data.
Routing writes through the operators runs a change only when its version says it should, which is
what lets collaboration, cross-tab sync and undo/redo share one mechanism.

## Development

From the repository root:

```sh
pnpm exec vp run --filter ./packages/erd-editor-schema --fail-if-no-match test
pnpm --filter ./packages/erd-editor-schema --fail-if-no-match test:coverage
pnpm --filter ./packages/erd-editor-schema --fail-if-no-match test:dev
pnpm exec vp run --filter ./packages/erd-editor-schema --fail-if-no-match build
```

- `test` builds its workspace dependency (`@dineug/uuid`), then runs `tsc --noEmit` and Vitest
  over `src/**/*.test.ts`.
- `test:coverage` runs Vitest with v8 coverage, and no type check.
- `test:dev` runs Vitest in watch mode, with no type check.
- `build` also builds `@dineug/uuid` first, runs `tsc --noEmit`, then writes `dist/` unbundled
  (`preserveModules`): an ES module for each source module with runtime code and a `.d.ts` for
  each source file, which the consumers type-check against.

The rules for changing the package, and the checks a change runs, are in [AGENTS.md](./AGENTS.md).
