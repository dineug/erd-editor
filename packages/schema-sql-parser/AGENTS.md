<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-08-27 | Updated: 2026-10-11 -->

# schema-sql-parser

## Purpose

`@dineug/schema-sql-parser` (private) is a hand-written, permissive DDL parser. `schemaSQLParser(source, { database })` tokenizes SQL of any dialect into a flat `Statement[]` of nine kinds: `create.table`, `create.index`, `alter.table.add.{primaryKey,unique,foreignKey,default}`, `alter.table.alter.column.autoIncrement` and `comment.on.{table,column}`. Unrecognised input is skipped, so a real dump imports partially instead of failing; `CREATE TYPE`, `CREATE DOMAIN`, `CREATE EXTENSION` and `CREATE SEQUENCE` are skipped this way. Its only consumer is `packages/erd-editor/src/utils/schema-sql-parser/`, which folds the statements into an `ERDEditorSchemaV3` document. That importer passes the document's database as `database`, the one option; only a Databricks source reads differently.

## Making a Change

1. Read the files root step 1 names. A change to a statement's shape, or to what the importer does with one, crosses into `erd-editor`. Read `packages/erd-editor/AGENTS.md` too, and the nested `AGENTS.md` it lists for each directory the change reaches. The importer is `packages/erd-editor/src/utils/schema-sql-parser/`; the SQL writers a round trip goes through are in `packages/erd-editor/src/utils/schema-sql/`.
2. Write the change with what root step 2 lists, plus what this package adds:
   - a new statement kind makes the seven edits under Rules § Parsing loop;
   - a new end-to-end case follows Testing Requirements, from a dump tool's real output where a tool writes the form;
   - a statement form or a data type the parser newly reads goes into `README.md` (Key Files);
   - a type added to a `src/parser/dataType/` list goes into `packages/erd-editor/src/constants/sql/dataType/` too (Rules § Data types).
3. Run `pnpm exec vp run --filter @dineug/schema-sql-parser --fail-if-no-match test` (root step 3). A change to `src/schema_sql_test_case.md` alone runs it too, since `index.test.ts` reads that file. A change to what `src/index.ts` exports, or to a statement type, runs `pnpm test` as well, because `erd-editor` type-checks against this package's `dist/**/*.d.ts`.
4. Run `pnpm --filter @dineug/schema-sql-parser --fail-if-no-match test:coverage` where shipping source changed (root step 4). `vitest.config.ts` names what it measures, each file at 80%.
5. Run root step 5 with `pnpm peer-graph` and `pnpm size`. `erd-editor` inlines this package, so a change to its shipping source changes `erd-editor`'s output.
6. When a change alters the DDL an imported schema exports again, run that DDL on the vendor through the docker loop (root step 6). Rules § Data types records one such round trip.
7. Report as root step 7 says.

## Key Files

| File | Description |
| --- | --- |
| `src/index.ts` | Public surface: `schemaSQLParser`, `StatementType`, `SortType`, `ReferentialAction`, the statement types, `SchemaSQLParserOptions` and `DatabaseVendor`; everything else is internal |
| `src/parser/tokenizer.ts` | Lexer (Rules § Tokenizer) |
| `src/parser/index.ts` | Dispatch loop: probes each matcher at `$pos`, runs a statement parser, else advances one token |
| `src/parser/helper.ts` | Token and value predicates, the `is*` lookahead matchers, the merged `DataTypes` set, `matchCreateTable`, `matchCreateIndex`, `matchQualifiedName`, `matchDataType`, `matchUserDataType`, `matchNestedDataType`, `matchReferentialClause`, `matchKeyModifier` (and `matchKeyModifiers`, a run of them), `matchUsingIndexName`, `matchAddExtendedProperty`, `matchAlterTableAlter`, `isNullFilter`, `isTableItemWord`, `isColumnKeywordValue`, `toStringLiteral`, `requote`, `unquoteTypeName` |
| `src/parser/statement/index.ts` | `Statement`, `StatementType`, `SortType`, `ReferentialAction`, `RefPos` |
| `src/parser/statement/create.table.ts` | The `create.table` parser, with `typePos`, `opensConstraintItem`, `onNullSpan` and `referencesParser` |
| `src/parser/statement/index.columns.ts` | Reads a key list for `create.table` (its primary and unique keys and its indexes), `create.index`, `alter.table.add.unique` and `alter.table.add.primaryKey` (Rules § Keys and indexes) |
| `src/parser/statement/default.expression.ts` | Reads a column's `DEFAULT` expression for `create.table`, writes back the one `alter.table.add.default` finds, and tells one call of `nextval('...')` for `create.table` and `alter.table.alter.column.autoIncrement` (`isNextvalDefault`) |
| `src/parser/statement/alter.table.alter.column.ts` | Reads the actions of an `ALTER TABLE ... ALTER [COLUMN]` |
| `src/parser/statement/add.extended.property.ts` | Reads `EXEC sp_addextendedproperty` into a `comment.on.*` statement, or none |
| `src/schema_sql_test_case.md` | End-to-end fixtures read by `index.test.ts` (Testing Requirements) |
| `README.md` | The syntax catalogue, kept by hand: Support Syntax shows each statement form the parser reads and Support DataType each vendor list with its count; a form or a type added here goes there in the same change, since no spec reads it |

## Subdirectories

| Directory | Purpose |
| --- | --- |
| `src/parser/statement/` | One parser per statement kind, with the shared readers Key Files lists |
| `src/parser/dataType/` | Per-vendor type lists: MySQL, MariaDB, PostgreSQL, MSSQL, Oracle, SQLite, Databricks, Snowflake (Rules § Data types) |

## Rules

### Parsing loop

- **Skip unrecognised SQL rather than throw.** The loop advances `$pos` and continues, because bailing out turns a partial import into a failed one.
- **`$pos` is a shared mutable cursor.** `$pos` (`RefPos = { value: number }`) is a shared mutable cursor, and each parser leaves it just past what it consumed. Off by one, it either loops forever or swallows a statement.
- **A new statement kind is seven edits.**
  - the parser file;
  - the `Statement` union and `StatementType`;
  - a matcher in `parser/helper.ts`;
  - a branch in `parser/index.ts`;
  - the two specs that pin every `StatementType` entry and their count (`src/index.test.ts`, `src/parser/statement/index.test.ts`);
  - a `case` in the importer's switch (`packages/erd-editor/src/utils/schema-sql-parser/index.ts`), which has no default, so a kind it lacks is parsed and silently dropped.

  A kind opened by a word `isNewStatement` (`helper.ts`) does not count yet also goes into `isNewStatement`, or the statement before it reads on through the new one.
- **Keywords are unquoted, case-insensitive `string` tokens.** Every `is*Value` matcher refuses a `quoted` token, so `` `key` `` is a column and `KEY` an index.

### Tokenizer

- **A quoted name or literal is one token.** `"x"`, `'x'`, `` `x` `` and `[x]` each become one `string` token. The delimiters are stripped and `quoted` is set to the opening delimiter.
- **A doubled delimiter is one character.** A doubled `''`, `""` or ``` `` ``` inside is one character of the value. A doubled `]]` is not, because a nested array literal closes on it.
- **A backslashed quote depends on what follows.** A `'` behind an odd run of backslashes is one character of the value too, its backslash dropped. It closes the literal instead when whitespace or one of `,;):]|+` follows it. That tells MySQL's `'it\'s'` from standard SQL's `'C:\'` and T-SQL's `'C:\'+name`.
- **A Databricks literal follows Spark's rules.** For a Databricks source, every backslash in a single-quoted literal escapes what follows it (`\'`, `\\`, `\n`, `\u0041`, `\101`).
- **A prefixed literal is one token.** A single-quoted literal right behind a prefix (`N`, `E`, `B`, `X`, `U&`, MySQL's `_utf8mb4`) is one such token too. The prefix is kept in `prefix`, which `requote` writes back.
- **A quote behind an operator opens a literal.** This holds for a quote right behind an operator character glued to a word, with or without a prefix between them. The word before the operators and the operators are each a token of their own: SQL Server's `N'a'+N' (b)'`, `'a'||'b'`, PostgreSQL's `data->>'k'`.
- **An unpaired `]` emits `rightBracket`.**
- **Comments never become tokens.** Both `--` and `/* */` are dropped.

### Statement heads

- **The `CREATE ... TABLE` header is measured, not counted.** `matchCreateTable` returns its span over a whitelist of modifiers (`OR REPLACE`, `TRANSIENT`, …). Scanning to the next `TABLE` would claim `CREATE VIEW ... FROM TABLE(...)`. `matchQualifiedName` measures an `ALTER TABLE db.schema.t` target the same way.
- **An unbalanced `CREATE TABLE` runs to the end.** A `CREATE TABLE` whose parentheses do not balance still runs to the end of the source.
- **The `ALTER TABLE ... ADD` head is measured too.** `matchAlterTableAddHead` allows `ONLY`, a qualified name, SQL Server's `WITH CHECK` / `WITH NOCHECK` (every foreign key SSMS scripts) and `CONSTRAINT name`. The four `alter.table.add.*` parsers step over the words it allows.
- **`CREATE [UNIQUE] [CLUSTERED | NONCLUSTERED] INDEX` reads what dump tools write**: `matchCreateIndex` measures the header through `INDEX`.
  - `CONCURRENTLY`, `IF NOT EXISTS` and a missing name are skipped, and so is `USING btree` before the key list.
  - The index and table names keep their last segment (pg_dump's `ON [ONLY] public.t`, Oracle's `"HR"."T"`).
  - Only the first `ON` names the table, never SSMS's `ON [PRIMARY]` filegroup.
  - Its `WHERE` follows Keys and indexes, below.

### Data types

- **One merged type set serves every dialect.** `helper.ts` merges all eight `dataType/` lists into one deduplicated uppercase set, so a type added to one vendor widens every dialect.
- **Two lists carry names their schemas use.** PostgreSQL's list has `dec`, which PostgreSQL reads as `numeric`. SQLite's has `BOOL`, `DEC`, `TIME` and `TIMESTAMP`, which SQLite schemas use: Django declares `bool` and `time`, and `DEC` takes the `NUMERIC` affinity `DECIMAL` has.
- **Change the editor's type lists together.** Each name is mirrored with a `primitiveType` in `packages/erd-editor/src/constants/sql/dataType/`. No test pins the parity, so change both lists in one change.
- **Type names match word by word, longest first.** Write multi-word names in full (`TIMESTAMP WITHOUT TIME ZONE`). `matchDataType` returns the token span, argument lists and an array suffix (`[]`, `[3]`, `ARRAY`) included.
- **Unlisted words before a listed type join it.** They join in the type's place, since SQLite takes any words as a type (`UNSIGNED BIG INTEGER`). With no listed type after them, only the first is the type (`hstore COMPRESSION pglz`).
- **Unlisted types are read only in type position.** That place is the token right after the column name (`typePos` in `statement/create.table.ts`): `mood`, `public.mood`, `hstore`.
  - A single-quoted literal and the words in `ColumnKeywords` (`helper.ts`) are refused there. A typeless column (SQLite, a computed `AS`, a `CREATE TABLE AS` column list) puts its first constraint in that place.
  - A column keyword the parser meets there goes into `ColumnKeywords`, or it becomes the type. The list also ends a `DEFAULT` expression.
  - `TAG` before `(` and `SORT` where the column ends are refused by position, since a PostgreSQL type may carry either name.
  - Anywhere else an unknown word is an attribute (`INT COLUMN_FORMAT FIXED`).
- **A quoted type argument keeps its delimiter.** `requote` writes it back, a single-quoted one through `toStringLiteral` as a default's is: `ENUM('a','b')`, `OBJECT("city" VARCHAR)`. `column.dataType` is raw SQL too.
- **A user type's quoted name keeps its quotes.** T-SQL brackets stay whether the name needs them or not (`"MyType"`, `[sysname]`, `[dbo].[Order]`, where `ORDER` is reserved). A listed type drops them (`[int]` → `int`), through `unquoteTypeName`. PostgreSQL's `"char"` and `"bit"` keep theirs, since they are other types than `char` and `bit`.
- **A nested type's quoted tokens keep theirs.** Examples: `STRUCT<name: STRING COMMENT 'x'>`, and `'it\'s'` for Databricks.
- **Angle-bracket generics are rebalanced in the parser.** `<` and `>` are not break characters, so `matchNestedDataType` rejoins `ARRAY` / `MAP` / `STRUCT` spans. It keeps their inner commas from ending the column.
- **MySQL's `UNSIGNED` and `ZEROFILL` stay in the type.** `isTypeModifier` (`helper.ts`) is read in `statement/create.table.ts` right after the type and its arguments.
  - A run of `SIGNED`, `UNSIGNED` and `ZEROFILL`, unquoted and in any case, joins `column.dataType` one space apart. It keeps the order and case written (`INT UNSIGNED`, `SMALLINT(5) UNSIGNED ZEROFILL`, mysqldump's `int unsigned`).
  - So an imported schema reaches every unsigned rule of the editor's code generators, and its exported DDL keeps them (an owner decision of 2026-10-09).
  - `SIGNED` is read and dropped (`TINYINT SIGNED` gives `TINYINT`, `INT UNSIGNED SIGNED` gives `INT UNSIGNED`). It is the default, and MySQL and MariaDB store the bare type.
  - Kept, `SIGNED` hid the type's name from the editor's Rust, SeaORM and Doctrine generators, which read the whole name; a `TINYINT SIGNED` was a 32-bit integer there. It also made DBML, AML and Mermaid quote the type.
  - A modifier after another column option is dropped, a position MySQL refuses (`INT NOT NULL UNSIGNED` gives `INT`). A quoted `"UNSIGNED"` is dropped too, and a column may still be named `unsigned`.
  - Measured on 2026-10-10: MySQL 8.4.11 and MariaDB 11.4.13 created the same column types from an imported and re-exported schema as from its source. Sakila's 36 unsigned columns were among them. PostgreSQL and SQL Server refuse such a type in the DDL the editor writes for them, as they refused one typed by hand.

### Column defaults

- **`column.default` is the whole expression as raw SQL.** Every exporter writes it after `DEFAULT` (`statement/default.expression.ts`). Its first token is the value whatever it is (`DEFAULT NULL`).
- **A default ends at a keyword or separator.** It runs to the next column keyword, a comma, `)` or an unpaired `]` at depth 0, or to a `;` at any depth.
  - The column keywords are `isColumnKeywordValue`, a constraint state and `CHARACTER SET`. They also include the vendor options `ColumnKeywords` leaves out: `ROWGUIDCOL`, `SPARSE`, `MASK`, `STORAGE`, `COLUMN_FORMAT`, SQL Server's inline `INDEX`, a `TAG` before its list.
  - A `CASE` opens a level its `END` closes, as a paren does, so the keywords inside a bare `CASE ... END` end nothing.
  - The `FOR` of `NEXT VALUE FOR` ends nothing. Neither do the `WITH` and `WITHOUT` of a cast to a type `WITH [LOCAL] TIME ZONE` or `WITHOUT TIME ZONE`.
  - Any other `WITH` or `WITHOUT` ends the default (T-SQL's `WITH VALUES`, MariaDB's `WITHOUT SYSTEM VERSIONING`).
  - MySQL's `ON UPDATE CURRENT_TIMESTAMP` ends the default and is dropped, since a column has no field for it.
- **Oracle's `ON NULL` clause is skipped.** `ON NULL [FOR INSERT ONLY | FOR INSERT AND UPDATE]` before the expression is skipped (`onNullSpan` in `create.table.ts`).
- **Tokens are joined by rule.** The lexer drops whitespace, leaves a cast glued to its neighbours (`0::int`) and cuts `>=`, `<=`, `!=` and `=>` at their `=`. So the default's text is rebuilt from its tokens:
  - no space inside parentheses, around `.` and `::`, before a comma, or inside an operator the lexer cut;
  - no space before an opening paren or an array subscript unless an operator stands before it (`now()`, `IN(1, 2)`, `ARRAY[1, 2]`, `- (1)`);
  - one space after a comma, before a T-SQL name in brackets (`NEXT VALUE FOR [dbo].[seq]`) and anywhere else (`now() AT TIME ZONE 'utc'`).
- **Outer parentheses and the outermost cast come off.** This is the owner's decision: `((0))` gives `0`, `(getdate())` gives `getdate()`, `'draft'::character varying` gives `'draft'`.
  - The parser takes that cast off a literal only, a prefixed one too (`NULL::character varying` gives `NULL`, `B'0'::"bit"` gives `B'0'`). Off anything else it changes or breaks what the default means (`ARRAY[]::text[]`, `('now'::text)::date`).
  - A cast inside stays (`lower('A'::text)`).
  - The editor's exporters put the parentheses back where a database reads the expression only inside them (`formatDefault` in `packages/erd-editor/src/utils/schema-sql/utils.ts`).
- **Quoted tokens go back into quotes.** The lexer has stripped them, and `PENDING` would read back as a name.
  - A quoted token inside the default goes back into its delimiters (`requote`).
  - A lone quoted value goes back into a string literal whatever its quotes (`toStringLiteral`). That is `'...'` with inner quotes doubled. For Databricks a quote and a backslash are escaped with a backslash, which Spark 4.0 and earlier read.
- **SQL Server's `ADD DEFAULT ... FOR column` is written back too.** `ALTER TABLE ... ADD [CONSTRAINT n] DEFAULT expression FOR column` is the form SSMS scripts every default in, apart from its table.
  - It goes through `writeDefaultExpression` into `alter.table.add.default`, written back the same way as an inline default.
  - A call of `nextval(...)` there stays its default, since SQL Server has no such function.
  - No column keyword ends it, since no column option can follow it. It ends only at the `FOR` that names the column (not that of `NEXT VALUE FOR`), a comma or a `)` nothing opened at depth 0. It also ends at a `;` or the next statement at any depth (a `GO` script).
  - So `DEFAULT 'a' COLLATE Latin1_General_CI_AS FOR c` keeps its `COLLATE` and names `c`.
  - The importer sets that column's default from it, and the constraint name is dropped (the owner's decision).

### Auto increment

- **An identity or one `nextval` call sets `autoIncrement`.** `GENERATED BY DEFAULT AS IDENTITY` reads no default; its `IDENTITY` sets `autoIncrement`. So does a default that is one call of `nextval('...')` (`isNextvalDefault`), a serial column's default.
  - This holds whether the default is inline or set apart from its table as pg_dump does (the owner's decision).
  - The reason: every exporter writes its own auto increment for the flag and leaves the default out. The sequence the call names has no place in the document.
- **`isNextvalDefault` reads one bare `nextval` call.** The name is unqualified, unquoted in any case or in double quotes in lowercase, as `pg_dump --quote-all-identifiers` writes it.
  - The call may stand in parentheses or not, with nothing after its argument list.
  - Its one argument is the sequence's name in a single-quoted literal, plain or with PostgreSQL's `E` or `U&` prefix.
  - That literal may sit under any casts to a type name and parentheses: `'s'`, `'s'::regclass`, `'s'::"regclass"`, or the late-bound `('s'::text)::regclass` PostgreSQL writes back for a `nextval('s'::text)` default.
- **Any other sequence call stays a default.** `nextval('s') + 1`, `nextval('s')::integer`, `nextval(N's')` and SQL Server's `NEXT VALUE FOR s` stay defaults. So does MariaDB's `nextval(db.seq)`, which names its sequence bare (the owner's decision).
- **A serial type name sets no flag.** A column typed `serial`, `bigserial` or `smallserial` inline (`id serial PRIMARY KEY`), which pg_dump never writes, keeps that type with `autoIncrement` off: the flag comes from a column's options and default, never its type name.
- **pg_dump sets defaults and identities apart from tables.** For a serial column it first writes `CREATE SEQUENCE ... ; ALTER SEQUENCE ... OWNED BY t.c`, then `ALTER TABLE ONLY t ALTER COLUMN c SET DEFAULT nextval('s'::regclass)`. For an identity column it writes `ALTER TABLE t ALTER COLUMN c ADD GENERATED {ALWAYS | BY DEFAULT} AS IDENTITY (SEQUENCE NAME s ...)`.
  - `matchAlterTableAlter` measures `ALTER TABLE [ONLY] name` before an `ALTER` that no `TABLE` follows, trying both readings of `ONLY` as for `ADD`.
  - `alterTableAlterColumnParser` reads every action of the list. Each opens with `ALTER [COLUMN] c` right after the head or a comma at depth 0, where an `ALTER TABLE` is the next statement instead.
  - An action that adds an identity, or sets a default `isNextvalDefault` reads as PostgreSQL's `nextval` call, yields `alter.table.alter.column.autoIncrement`. It carries the table's last segment and the column. For it, the importer sets that column's `autoIncrement` and clears its default.
  - Any other action yields none, so the column keeps the default its `CREATE TABLE` gave it. Examples: `SET DEFAULT 0`, MariaDB's `SET DEFAULT (nextval(db.seq))`, `DROP DEFAULT`, `SET NOT NULL`, `TYPE`, `ADD GENERATED ALWAYS AS (expr) STORED`.
  - The `CREATE SEQUENCE` and its `OWNED BY` are skipped, since the default alone makes the column auto increment.
- **A cut-off `ALTER ... ALTER` never swallows the next statement.** A `DROP` right after the column's name is stepped over, so the one of `DROP DEFAULT` ends no statement.
  - Any other statement word `isNewStatement` counts ends the statement, there or later, where no `;` comes first. So an `ALTER` cut off before its action ends there, and its `nextval(...)` is read only up to there.
  - A statement word in the column's place is the column's name only before a word a PostgreSQL column action opens with (`ColumnActionWords`: `ADD`, `DROP`, `OPTIONS`, `RESET`, `RESTART`, `SET`, `TYPE`). pg_dump leaves such a name unquoted where PostgreSQL does not reserve it (`ALTER COLUMN delete SET DEFAULT ...`).
  - Before anything else that word opens the next statement, so an `ALTER [COLUMN]` cut off before its column's name ends there too.
  - The exception is a `CREATE TYPE`, `ALTER TYPE` or `DROP TYPE` right after it. It reads as a column and its `TYPE` action, and yields no statement either way.

### `ALTER TABLE ... ADD`

- **One `ALTER TABLE name ADD` is dispatched once.** The loop in `parser/index.ts` dispatches it once, on `isAlterTableAdd`, whatever it adds.
  - The primary key, foreign key or default parser reads the statement when its first clause is one.
  - Then `alterTableAddUniqueParser` reads the same tokens again and returns one `alter.table.add.unique` per `UNIQUE` clause. So phpMyAdmin's `ADD PRIMARY KEY (...), ADD UNIQUE KEY ...` keeps every key.
- **A `CONSTRAINT` symbol names only its own clause.** A comma or `ADD` drops it.
- **An unclaimed word's `UNIQUE` belongs to the column.** A `UNIQUE` after a word no branch claims belongs to the column the clause adds (`ADD [COLUMN] c INT UNIQUE CHECK (...)`), and keys nothing.
- **Some clauses after the first are dropped.** A foreign key or a default after a first clause of another kind is still dropped, and so is `ADD KEY` / `ADD INDEX`. When the first clause is a foreign key, `alterTableAddForeignKeyParser` reads every one and keeps only the last. When it is a default, `alterTableAddDefaultParser` reads that one alone.
- **An open group ends at a `;`.** A group the parser skips (a `CHECK`, a foreign key's lists) ends at a `;`. So does a key list `indexColumnsParser` reads, the `ALTER`'s or `CREATE INDEX`'s, which then keys nothing. So a group the source leaves open never swallows the statements after it.

### Keys and indexes

- **A key part's first word names its column.** In a key list (`index.columns.ts`), the rest of a part is its sort or words that name none (`COLLATE "C"`, an operator class, `NULLS LAST`).
  - A numeric prefix length is skipped and not kept.
  - Any other group is an expression that leaves the key no column.
  - A list still open at a `;` leaves the key none either, with `$pos` on the `;`.
- **A multi-column `UNIQUE` is one unique index.** This holds in every spelling: `UNIQUE (a, b)`, `UNIQUE KEY` / `INDEX n`, SQL Server's inline `INDEX n UNIQUE`, `CONSTRAINT [n] UNIQUE`, `ALTER TABLE ... ADD [CONSTRAINT [n]] UNIQUE [KEY | INDEX] [IF NOT EXISTS] [n]`, `CREATE UNIQUE INDEX`.
  - It is named by its index name, else its `CONSTRAINT` symbol, else `''`.
  - A flag on each column would be a stricter key.
- **A one-column `UNIQUE` sets the column's `unique`.** It does so whatever its name, which is how the editor's own `UQ_<table>_<column>` comes back as the flag it was. `alter.table.add.unique` only reports the key; the editor's importer applies that rule to it.
- **A filtered unique index is a plain index.** A `WHERE` makes a unique index a plain one that keeps its name and columns, since a partial key unconditioned is a stricter one.
  - The exception is a filter `isNullFilter` reads as `key IS NOT NULL` over key columns, `AND`-joined, in parentheses that pair up. Those rows are the ones the SQL standard's `UNIQUE` already lets repeat; it is SQL Server's usual filter for a unique nullable column.
  - The rule covers `CREATE UNIQUE INDEX ... WHERE`. SQL Server's inline `INDEX n UNIQUE (...) [INCLUDE (...)] WHERE ...` reads its filter by the same rule. Unless the filter only drops NULL keys, the key is a plain index that keeps its name and columns, even over one column.
- **Key modifiers are never read as names.** `matchKeyModifier` keeps `NULLS NOT DISTINCT`, `NONCLUSTERED` and `USING BTREE` from being read as the name.
- **An `ALTER`'s primary key steps over modifiers.** It steps over a run of the same modifiers between `PRIMARY KEY` and its key list (`alterTableAddPrimaryKeyParser`, through `matchKeyModifiers` in `helper.ts`). Examples: SSMS's `PRIMARY KEY CLUSTERED ([Id] ASC)`, MySQL's `PRIMARY KEY USING BTREE (a, b)`. A key list left unread reports the key with no columns, which the importer drops. A memory-optimized table's `PRIMARY KEY NONCLUSTERED HASH (...)` is still not read.
- **A column's own `UNIQUE` reads no name.** It reads no name and no key list, since Oracle follows it with `USING INDEX (...)`.
- **Oracle's `USING INDEX` names the key's index.** An `ALTER`'s unique or primary key reports the index Oracle's `USING INDEX [schema.]index` names as `usingIndexName`. The primary key reports its `CONSTRAINT` symbol too. `matchUsingIndexName` refuses the index properties and constraint states that may stand there instead.
- **The importer folds that index into the key.** It reads the table's index of that name, else of the key's own name, over the same columns, as part of the key. SQL Developer exports `CREATE UNIQUE INDEX "UQ"` before `ADD CONSTRAINT "UQ" UNIQUE`.
  - A composite unique key is that index made unique.
  - A one-column key and a primary key take it into their flags, since Oracle refuses to index one column list twice.
- **An unnamed key takes over its columns' index.** Oracle's system-named `ADD PRIMARY KEY` / `ADD UNIQUE` has neither name, and SQL Developer exports its index as `SYS_C...`.
  - Such a key takes over, the same way, the table's index that covers its columns in the same order. That index may be inline or from a `CREATE INDEX`, unique or not, under any name or none.
  - The reason: Oracle enforces a primary or unique key through an index over its columns, a non-unique one too, rather than build another.
  - So `CREATE INDEX ix_id ON t (id); ALTER TABLE t ADD PRIMARY KEY (id);` imports as the primary key flag on `id` and no index. A second index a MySQL or PostgreSQL script keeps over those columns is taken over as well.
  - An index over the key's columns in another column order stays one of its own.
- **Where the `CREATE INDEX` stands plays no part.** The importer merges every `CREATE INDEX` before any `ALTER` key, so `ALTER TABLE t ADD PRIMARY KEY (id); CREATE INDEX ix_id ON t (id);` imports the same. The reason: `DBMS_METADATA`'s `CONSTRAINTS_AS_ALTER` output, followed by the table's dependent index DDL, writes each `ALTER` before the `SYS_C...` index of its key.
- **`create.table` reports named and `USING INDEX` keys.** Its `keys` holds each primary key and one-column unique key the source names, by `CONSTRAINT` or a one-column `UNIQUE KEY n` / `INDEX n UNIQUE`.
  - `keys` also holds every key with no name that Oracle's `USING INDEX` follows, a composite unique key too, which stays in `indexes` as well.
  - A key with no name that PostgreSQL's `USING INDEX TABLESPACE ts` follows is not reported. `DBMS_METADATA` never writes `TABLESPACE` right after `USING INDEX`, and Oracle refuses a second index over a key's columns (ORA-01408). So a `CREATE INDEX` over the columns of that key is an index of its own.
  - A column's `CONSTRAINT` names a key only when the key follows it at once.
- **A later `CREATE [UNIQUE] INDEX` folds in two cases.** The importer reads it as a key or index the table already has in two cases only. `DBMS_METADATA` writes one such index for each key a table declares inline.
  - It carries the name of a key or of an index of the table, and covers the same columns as that key or index, in any order.
  - It covers, in their order, the columns of a key with no name that `keys` reports, one Oracle's `USING INDEX` followed: `PRIMARY KEY ("ID") USING INDEX ...` or `UNIQUE ("A", "B") USING INDEX ...`, then `CREATE UNIQUE INDEX "HR"."SYS_C..."`.

  Read so, it adds no index: an index takes its name when it had none, and its `UNIQUE`.
- **A later index joins no other unnamed index.** That covers an earlier `CREATE INDEX` without a name and an inline `UNIQUE` without `USING INDEX`.
  - `UNIQUE (a, b)` then `CREATE INDEX ix_ab ON t (a, b)` keeps both, and so do `CREATE INDEX ON t (a, b)` then `CREATE UNIQUE INDEX uq ON t (a, b)`.
  - The editor's own exports write no `USING INDEX`, so an index over the columns of an unnamed key they write comes back as the index it was.

### Foreign keys

- **A foreign key keeps its referential actions.** They keep their SQL spelling (`ReferentialAction`), `''` where the clause is absent.
- **`referencesParser` reads all three foreign key forms.** It lives in `statement/create.table.ts` and reads the reference and the `ON DELETE` / `ON UPDATE` / `MATCH` clauses right after it. The forms are a table-level `FOREIGN KEY`, an `ALTER TABLE ... ADD FOREIGN KEY` and an inline column `REFERENCES`, which SQL Server and Snowflake may spell `FOREIGN KEY REFERENCES`.
- **A missing referenced column list leaves `refColumnNames` empty.** In all three forms it means the referenced table's primary key. The importer resolves it only when that key has one column, since `CreateTable` keeps no declared key order to pair a composite key by.
- **`matchReferentialClause` spans PostgreSQL's `SET` column list.** PostgreSQL lets `SET NULL` / `SET DEFAULT` name columns (`ON DELETE SET NULL (a_id)`), so a clause after that list is still read. It still skips a clause nothing claimed, MySQL's `ON UPDATE CURRENT_TIMESTAMP` included.

### Table items

- **A constraint or index item yields no column.** `opensConstraintItem` in `statement/create.table.ts` names the tokens that open one; a new opener goes there.
- **Shared opener words go into `isTableItemWord`.** An item opened by a word a column may be named too goes into `isTableItemWord` (`helper.ts`), told apart by what follows it.
  - Such openers: an unnamed `CHECK (...)` or `CHECK NOT FOR REPLICATION (...)`, `LIKE s`, `EXCLUDE USING`, `FULLTEXT ft (c)` or `SPATIAL (g)`, `PERIOD FOR`, `SUPPLEMENTAL LOG`.
  - A column named `check` is quoted anyway.

### SQL Server comments

- **Comments are `EXEC [[db.]sys.]sp_addextendedproperty` calls.** `add.extended.property.ts` reads them. SSMS writes them with named arguments (`@name=N'MS_Description', @value=N'...', @level0type=N'SCHEMA', ...`). The editor's MSSQL export (`packages/erd-editor/src/utils/schema-sql/MSSQL.ts`) writes them by position.
- **Only `MS_Description` is read.** This is the owner's decision. On level 1 `TABLE` it is a `comment.on.table`, on level 2 `COLUMN` a `comment.on.column`.
  - Anything else (another property, a view, an index, no name) yields no statement.
  - `sp_updateextendedproperty` is not read.
- **The level 1 name is kept whole.** The level 0 schema is dropped, as every qualified name keeps its last segment. The level 1 name names one table, so it stays whole.
  - The export writes a double-quoted table named `dbo.users` there as `'dbo.users'`, the name its `CREATE TABLE "dbo.users"` reads back as.
  - It splits an unquoted one: its schema at level 0 and `'users'` at level 1.
  - A file an older export wrote names an unquoted `dbo.users` whole there (`'user', dbo, 'table', 'dbo.users'`, which SQL Server refuses). How the importer still matches it: `packages/erd-editor/src/utils/schema-sql/AGENTS.md` (Older exports keep their comments).
- **Each argument is one token.**
  - The comment (`@value`) must be a string literal (`N'...'` or `'...'`); a number, `NULL` or `DEFAULT` there gives no statement.
  - The property name and a level's type or name may be any name token (`dbo`, `[Orders]`, `N'Orders'`).
  - A `NULL` or `DEFAULT` (the parameter's own default, `NULL`) leaves its parameter unset, so one at level 2 still gives a table comment.
  - An `@variable` for any argument but level 0's gives no statement, since a column's description read as its table's would replace that comment.
  - The list ends at the first argument no comma follows, an unquoted `GO` or the next statement.
  - An operator after a value (`N'a' + N'b'`) drops the whole call rather than keep part of the text.
- **The call needs `EXEC` or `EXECUTE`.** `isNewStatement` counts this call, not any other `EXEC`. The editor's export writes it right after a unique key's `ALTER TABLE`, which would otherwise read on through it.

## Testing Requirements

- The test task (Making a Change step 3) runs Vitest in the `node` environment.
- A new end-to-end case is a `### ` section in `src/schema_sql_test_case.md` with a fenced `sql` block and a fenced `json` block; `index.test.ts` deep-equals `{ statements }`.
- A case for what a dump tool writes (SMO, pg_dump, mariadb-dump) holds that tool's real output byte for byte, but for its encoding.
- A paragraph between the heading and the `sql` fence names the tool, its version, the server and the options it ran with.
- A hand-written case covers only a form no tool writes (the MSSQL export's positional `sp_addextendedproperty`). A hand-written imitation encodes a guess at the output (an owner decision of 2026-10-04).
- That paragraph holds no `### ` and no fence, since `index.test.ts` splits the file at every `### ` and reads the SQL up to the first fence that closes.
- `index.test.ts` also parses the root `data/sakila.sql` and pins its column, foreign key and index shape. The other `data/*.sql` dumps are for manual runs only.

## Common Patterns

- AST nodes are fully populated with `''` and `[]` rather than optional fields.
- A qualified table name (`db.schema.t`) keeps its last segment in every statement parser.

## Dependencies

### Internal

None: a leaf package.

### External

None at runtime.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
