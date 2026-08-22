# erd-editor-schema

> The persisted document format for erd-editor

Internal to the erd-editor monorepo. It is `private` and never published to npm; the editor
core (`@dineug/erd-editor`) depends on it as `"@dineug/erd-editor-schema": "workspace:*"`.

## What this is

`.erd.json` files are this format. The package owns both versions of it — v3 (current) and
v2 (legacy, still readable) — the parsers that fold arbitrary JSON onto a valid document,
conversion in both directions, a query layer over the v3 collections, and the LWW
(last-write-wins) operators.

No field can fail a parse: every field is validated and falls back to its default, so
`schemaV3Parser({})` yields a complete empty document — that is how the editor seeds its
store. (`parser` still throws on a string that is not JSON at all.) Every v3 document a
parser returns is stamped with a `$schema` pointing at
[`json-schema/schema.json`](../../json-schema/schema.json), the JSON Schema for the format.

## Usage

```ts
import { readFileSync } from 'node:fs';

import { parser, query, toJson } from '@dineug/erd-editor-schema';

// reads either version, always returns ERDEditorSchemaV3
const schema = parser(readFileSync('example.erd.json', 'utf8'));

const table = query(schema.collections)
  .collection('tableEntities')
  .selectById('some-table-id');

const source = toJson(schema); // JSON string, ready to write back
```

`parserV2(source)` is the mirror image: it also accepts either version and returns
`ERDEditorSchemaV2`. `toJson` honours the document's `ignoreSaveSettings` bits, resetting
scroll position and zoom level before serializing when they are not meant to persist.

## Exports

- `parser`, `parserV2`, `toJson` — read and write a document from/to a JSON string.
- `schemaV3Parser`, `schemaV2Parser` — the same fold, but over an already-parsed object.
- `ERDEditorSchemaV3`, `ERDEditorSchemaV2` — the document types.
- `SchemaV3Constants`, `SchemaV2Constants` — the constant sets (`Database`, `NameCase`,
  `RelationshipType`, canvas bounds, …) each version allows.
- `query` — chainable reads and writes over the v3 collections, plus the operators below
  bound to a collection.
- `addOperator`, `removeOperator`, `replaceOperator`, and the `LWW` / `LWWTuple` types.

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
