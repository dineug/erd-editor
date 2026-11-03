# dbml.ts

**Parent context:** `../AGENTS.md`
**Generated:** 2026-10-11 · **Updated:** 2026-11-03

- **What it writes.** `dbml.ts` repairs the document, since DBML rejects what other generators render oddly.
  - A duplicate table is renamed.
  - A typeless or repeated column is dropped. So is a table those drops leave empty.
- **Names.** Identifiers are double-quoted.
- **Keys and relations.** A `Ref` is kept only when both its ends resolve.
- **Strings.** A comment is written as a `Note`.
- **Table colors.** A table color is written as `headercolor`, which takes `#rgb` or `#rrggbb` alone (`utils/tableColor.ts`, owner decisions).
  - An alpha is dropped.
  - An `rgb()` or `hsl()` is written as its hex.
  - A color that reads as neither a hex nor an `rgb()` or `hsl()` is left out.
- **Table groups.** A group holding a table the output writes becomes a `TableGroup` block after the refs.
  - Its `color` follows the `headercolor` rule.
  - Its members are written one a line, in table order, under the names their tables are written under.
  - DBML refuses two groups of one name, so each group is named in document order.
  - A blank name becomes `group_1`, `group_2` and on. A taken name gets `_2`, `_3` and on.
  - Neither ever takes a name another group holds.
  - The blocks are sorted by the name written. So a text that is imported and exported again comes out the same.
- **Importer read-back of colors.** The importer reads a `headercolor` back as written when it is `#rgb` or `#rrggbb`.
  - The tokenizer cuts `#3498DB` into a mark, a number and a name. The importer joins them while each touches the previous one (`Token.offset`).
  - It drops any other color, `#3498 DB` too.
  - A `TablePartial`'s `headercolor` is not inherited.
- **Importer read-back of groups.** The importer reads a `TableGroup` in any letter case, its name quoted or bare.
  - Each line names one table. The importer resolves it as a `Ref` resolves a table: an alias, any letter case, the schema optional.
  - It makes a group of that name with a `#rgb` or `#rrggbb` color.
  - A table named by two groups stays in the first.
  - A group that names no declared table is not made at all.
  - The group's note, inner or a setting, goes to `skipped` as `tablegroup note`.
  - Its other settings go to `skipped` as `tablegroup <key>`.
  - The group's rect is the placement's, which wraps it round its members (`utils/file/importSchema.test.ts`).
- **Highlighting.** DBML highlights as `sql` (`LanguageToLangMap`), as AML does.
- **Tests.** `dbml.test.ts` parses the output with `@dbml/parse`. It also round-trips the groups through the importer.
