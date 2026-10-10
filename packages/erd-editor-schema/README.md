# erd-editor-schema

> The persisted document format for erd-editor

Internal to the erd-editor monorepo. It is `private` and never published to npm; the editor
core (`@dineug/erd-editor`) depends on it as `"@dineug/erd-editor-schema": "workspace:*"`.

## What this is

`.erd.json` files are this format. The package owns both versions of it — v3 (current) and
v2 (legacy, still readable) — the parsers that fold arbitrary JSON onto a valid document,
the v2 to v3 conversion, a query layer over the v3 collections, and the LWW
(last-write-wins) operators.

No field can fail a parse: every field is validated and falls back to its default, so
`schemaV3Parser({})` yields a complete empty document. (`parser` still throws on a string that
is not JSON at all.) `createSchema()` is that document, a diagram created from nothing with
every setting `lockSettings` names locked at its default — that is how the editor seeds its
store and what it loads for an empty value. A file without `lockSettings` was saved before the
locks: it parses with all of them on, its `originX`, `originY`, `zoomLevel` and `canvasType`
at the defaults and the code settings as it saved them. Every v3 document a
parser returns is stamped with a `$schema` pointing at
[`json-schema/schema.json`](../../json-schema/schema.json), the JSON Schema for the format.

## Usage

```ts
import { readFileSync } from 'node:fs';

import { parser, query, toDocumentJson, toJson } from '@dineug/erd-editor-schema';

// reads either version, always returns ERDEditorSchemaV3
const schema = parser(readFileSync('example.erd.json', 'utf8'));

const table = query(schema.collections)
  .collection('tableEntities')
  .selectById('some-table-id');

const file = toDocumentJson(schema); // the storage form, ready to write back
const runtimeValue = toJson(schema); // everything an editor holds, to seed a collaborator
```

The two strings are two serializations of one document, and `parser` reads both.
`toDocumentJson` is what a file holds: the live entities alone, each collection sorted by
id, no field an editor derives on load (widths, anchors, key marks, sequences) or keeps for
one instance (z-indexes), and a trailing newline, so saving the same document twice writes
the same bytes. `toJson` is the runtime value: tombstones of removed entities and all of
the above kept, everything but the LWW registers, which is what a collaborator or a second
view needs to undo a removal it did not see.

Both write each setting `lockSettings` locks at the value it was locked at
(`settings.lockedValues`, which a parse takes from the saved fields and which is never
written) and every other one as it stands. Neither mutates the schema it is handed — the
settings they write are a copy.

`settings.originX` / `originY` are the view: the screen point scene `(0, 0)` lands on. A
file written before them saved `scrollLeft` / `scrollTop` instead, measured from the canvas
box (`width` / `height`) centred in the viewport: the parser reads those off such a file
once, through `migrateScrollToOrigin`, to give it the view it had, and keeps none of them.
The settings hold no `width`, `height`, scroll pair, `relationshipOptimization` or
`ignoreSaveSettings`, and no entity holds `meta`, so a file that has them loses them on its
next save.

## Exports

- `parser` — read a document from a JSON string, either serialization or a legacy file.
- `toDocumentJson` — write the storage form a file holds.
- `toJson` — write the runtime value, everything an editor holds but the LWW registers.
- `schemaV3Parser`, `schemaV2Parser` — the same fold, but over an already-parsed object.
- `createSchema` — a new v3 document, every lock on.
- `ERDEditorSchemaV3`, `ERDEditorSchemaV2` — the document types.
- `SchemaV3Constants`, `SchemaV2Constants` — the constant sets (`Database`, `NameCase`,
  `RelationshipType`, canvas bounds, …) each version allows.
- `query` — chainable reads and writes over the v3 collections, plus the operators below
  bound to a collection.
- `addOperator`, `removeOperator`, `replaceOperator`, and the `LWW` / `LWWTuple` types.
- `migrateScrollToOrigin` — the one-way legacy migration, for anything that has to
  restate what a document without an origin pair used to show.

## Why the LWW operators

Every change carries a version number. A direct write to state wins every merge, so a
change that arrives late — from a collaborator, another tab, or an undo — would silently
clobber newer data. Routing writes through the operators applies a change only when its
version says it should, which is what lets collaboration, cross-tab sync and undo/redo
share one mechanism.

## Development

```sh
pnpm exec vp run --filter @dineug/erd-editor-schema --fail-if-no-match test
pnpm --filter @dineug/erd-editor-schema test:coverage
```
