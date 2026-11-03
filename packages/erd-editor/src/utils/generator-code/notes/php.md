# php.ts

**Parent context:** `../AGENTS.md`
**Generated:** 2026-10-11 · **Updated:** 2026-11-03

- **What it writes.** `php.ts` writes plain classes of typed public properties (owner decisions of 2026-10-07).
  - `<?php` and `declare(strict_types=1);` open the text with nothing before them. The other languages open with a blank line, but PHP refuses that declare after any output.
  - So `index.ts` hands the one-table view to `createTableCode`, which opens on the same header.
  - Doctrine, Swift, Zod and JSON Schema hand theirs to a `createTableCode` too, each opening on a header a file of its own needs. SeaORM's `createTableCode` writes a module file's body.
  - A NOT NULL column or a primary key is `T $x;`. Any other column is `?T $x = null;`.
  - A comment is a doc block, never `//`. A `?>` in the text would end a `//` comment.
  - A `*/` in the text is written `*\/`, since it would close the doc block early.
- **Types.**
  - A decimal or money type stays a string.
  - So does an Oracle or Snowflake `NUMBER` with a scale. The shared tables file every `NUMBER` under long; a bare `NUMBER` stays an `int`.
  - A time and an interval are strings. PHP has no time-of-day type, and the shared tables file a PostgreSQL interval under time.
  - PostgreSQL's arrays, bit strings and `pg_lsn` are strings, because pdo_pgsql reads them as text.
  - A date is `\DateTimeImmutable`.
  - SQL Server's `bit` is a `bool`, and its `numeric` a string.
- **Names.**
  - A name PHP refuses for a class, in any letter case, gets `_` after it.
  - Examples are `List`, `Match`, `Object`, `Readonly`, and `_`, which PHP 8.4 deprecates. The set is `RESERVED_CLASS_NAMES`.
  - Every other name, column names included, stays as the name cases give it.
- **Layout.** An empty table is `class X {}`, PER Coding Style's form. PSR-12 wants the braces on two lines.
- **Written as is.** Both follow from leaving names as the name cases give them.
  - A name that is no PHP identifier.
  - A repeated name.
- **Measured.**
  - `RESERVED_CLASS_NAMES` was measured on PHP 8.1 and 8.4.
  - On 2026-10-07, PHP 8.1 and 8.4 linted and ran the output for the five `data/*.sql` fixtures, whole and per table.
  - On the same date, php-cs-fixer's `@PER-CS2.0` and `@PER-CS3.0` left that output as it was.
