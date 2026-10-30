<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-10-11 | Updated: 2026-10-25 -->

# schema-sql

## Purpose

`src/utils/schema-sql/` writes the DDL of the eight databases: one writer per vendor, `createSchemaSQL` in `index.ts`, the options (statements, header, logical names as comments) in `options.ts`, and the helpers the writers share in `utils.ts`. The Schema SQL tab, the element's `getSchemaSQL()` and `mcp-server`'s `erd_read` call `createSchemaSQL`. Each rule below records deliberate behaviour, not a bug to fix. Other files hold the rest of the feature:

- The Schema SQL tab, its options panel, its Tables choice by table group and its script editors: `src/components/schema-sql/AGENTS.md`.
- The scripts as document content (`settings.ddlScripts`): `src/engine/AGENTS.md`.
- The code generators, which import this directory's referential action table and foreign key pairs, and the automatic names of `src/utils/tableName.ts`: `src/utils/generator-code/AGENTS.md`.
- How the importer reads this output back: `packages/schema-sql-parser/AGENTS.md`.

## Making a Change

1. **Read the files on the other side.** Purpose names them. Modules outside this directory import from it, so a change to one of these reaches them:
   - `referentialActionSupport`: the code generators and the relationship context menu (`src/components/erd/erd-context-menu/menus/relationshipMenus.ts`).
   - `toForeignKeyPairs` and `SQLite.ts`'s `isIntegerFamily`: the code generators.
   - The name helpers the writers import live in `src/utils/tableName.ts`, outside this directory, since modules that never reach the writers read them too. A change to one reaches:
     - `autoName`, `autoNameIgnoreCase`, `orderByNameASC` and `primaryKeyColumns`: the code generators; `autoName` and `primaryKeyColumns` also the GraphQL, DBML and AML importers (`src/utils/schema-{graphql,dbml,aml}-parser/convert.ts`), and `orderByNameASC` Find and Replace, the diff, the Explorer's tree and the palette.
     - `tableNamePart`: `src/utils/tableKeys.ts`, `src/utils/map-columns/prefill.ts` and `doctrine.ts`; `splitsTableName`: `src/utils/tableKeys.ts`.
   - `createSchemaSQL`, `SchemaSQLStatementsList` and `SchemaSQLHeaderList`: `peer.js`, through which `mcp-server`'s `erd_read` writes DDL (`src/peer/AGENTS.md`, `packages/mcp-server/AGENTS.md`).
2. **Update the fixture with the bytes.** `compose.test.ts` and the vendor specs compare the output with the files under `__fixtures__/options/<vendor>/` (Testing Requirements). A change to what a combination or a rule file writes updates that file in the same change.
3. **Run the output on its database.** Root step 6 names the docker loop for generated SQL (`docker/<vendor>/` with `data/*.sql`). Snowflake and Databricks have no container, so their output follows their documentation, unmeasured.
4. **Run the package's checks.** The package file (`packages/erd-editor/AGENTS.md`) § Making a Change gives the test task and the coverage run.

## Key Files

| File | Description |
| --- | --- |
| `index.ts` | `createSchemaSQL` and `CreateSchemaSQLOptions`: the parts in order, the table filter, the scripts |
| `options.ts` | `SchemaSQLOptions`, `schemaSQLSupport`, `resolveSchemaSQLOptions`, `HEADER_NAME_PATTERN`, `formatScript` |
| `utils.ts` | What the writers share: `commentToWrite`, `toStringLiteral`, `formatDefault`, `toForeignKeyPairs`, `toSchemaEntities`, `selectIndexColumns`, `referentialActionSupport` |
| `src/utils/tableName.ts` | The name helpers the writers share with the scene's key rows and the importers, outside this directory: `getBracket`, the name split (`splitNameParts`, `unquoteNamePart`, `splitTableName`, `tableNamePart`, `splitsTableName`), `autoName` and `autoNameIgnoreCase`, `primaryKeyColumns`, `orderByNameASC` |
| `MySQL.ts`, `MariaDB.ts`, `PostgreSQL.ts`, `MSSQL.ts`, `Oracle.ts`, `SQLite.ts`, `Snowflake.ts`, `Databricks.ts` | One writer per database; `Oracle.ts` also holds `oracleLongNames` |
| `__fixtures__/options/<vendor>/` | The bytes each combination writes, and the bytes of a few rules on their own |

## Rules

### Quoting and string literals

- **`bracketType` decides Snowflake's quoting.** In `Snowflake.ts`, `bracketType` decides whether to quote a name, since a quoted name is case sensitive.
- **Write comments through `toStringLiteral`.** A comment, and a name SQL Server's `sp_addextendedproperty` takes, is written through `toStringLiteral` (`utils.ts`), the `MS_Description` call included. It doubles quotes, as the importer reads them (`packages/schema-sql-parser/AGENTS.md`).
- **Databricks escapes with a backslash.** `Databricks.ts` escapes a quote and a backslash with a backslash instead. That is the form every Spark release reads; only the newest read a doubled quote.
- **The importer reads Databricks by Spark's rules.** It does so when the document's database is Databricks. `toSchemaImportJson`, which `loadSchemaSQLAction$` and a placed import share, hands `settings.database` to `schemaSQLParser`. Every backslash then escapes the character after it. A `DEFAULT` literal, or a STRUCT field's `COMMENT` inside the type, goes back as `'it\'s'`. So import, Databricks export and import again agree.
- **Other databases keep the importer's guess.** An escaped quote inside a word comes back as a quote, and an escaped backslash keeps both. A `DEFAULT` doubles its quotes.

### SQL Server comments (`MS_Description`)

- **Name schema, table and column by level.** `MSSQL.ts` names an `MS_Description` call's schema at level 0 as `'schema'`, its table at level 1 and its column at level 2 (an owner decision of 2026-10-04). SQL Server refuses `'table', 'dbo.users'` for the table an unquoted `CREATE TABLE dbo.users` makes. SQL Server 2022 ran this output the same day for `sales.users` and `users`, unquoted and double-quoted. `sys.extended_properties` kept every comment on its table and column.
- **Split an unquoted name into parts.** The last part is the table and the one before it the schema. Where the name gives no schema, the schema is `dbo`, the default schema of the database owner, which the export assumes.
- **Each part loses one enclosing pair.** A part loses one enclosing pair of brackets or double quotes (an owner decision of 2026-10-05). `[sales].[users]` gives `'sales'` and `'users'`, and `[Order]` gives `'Order'`.
- **The part before the schema names the database.** The calls run that database's own procedure (`EXECUTE shop.sys.sp_addextendedproperty`), an owner decision of 2026-10-05. The levels name no database, and a call acts on the database of its procedure. So a script connected to any database finds `shop.sales.users`.
- **Otherwise read a part as SQL Server does.**
  - A dot splits only outside a pair: `[sales.v2].users` is `users` in schema `sales.v2`. Split there, `[sales` before the procedure would leave a bracket open that swallows every later batch.
  - A doubled closing character inside the pair is one: `[x]]y]` gives `'x]y'`.
  - The database goes before the procedure as typed (`[my shop].sys.…`), and only as a regular identifier or one delimited name. Otherwise it is dropped: `o'shop.o'sales.users`, whose `CREATE TABLE` fails too, would open a quote.
  - A fourth part is dropped, since `CREATE TABLE` refuses it (Msg 117).
- **Measured on SQL Server 2022, 2026-10-05.** Connected to another database, it ran the output for `[sales].[users]`, `"sales"."orders"`, `shop.sales.users`, `[my shop].[sales].[users]`, `[my.db].sales.users`, `[sales.v2].users`, `"sales.v2".users`, `[x.y.z]`, `[x]]y]` and `"x""y"`. `sys.extended_properties` kept every comment on its table and column, and the table after it in the script kept its own. The earlier output failed there with Msg 15135. Those tables had no key.
- **A key's name takes the same table part.** It splits the name the same way (`tableNamePart`, under Dotted table names). On 2026-10-05 SQL Server 2022 ran the export of `sales.users`, `[sales].[users]`, `"sales"."users"`, `[Order]` and, connected to another database, `shop.sales.users`. Each stood beside an orders table, with a primary key, a unique column, a foreign key, indexes and comments. Every statement passed, and `sys.extended_properties` held each comment on its table and column. The `PK_[users]` and `PK_[Order]` an earlier split wrote failed with Msg 102.
- **A quoted name goes whole to level 1.** It goes to level 1 in `dbo`, the one table `CREATE TABLE "dbo.users"` makes, which reads back as `dbo.users`.
- **Level 1 holds the importer's table name.** Either way, quoted or not, level 1 holds the name the importer gives the table: `sales.users` quoted; `users` for `[sales].[users]`, `[sales.v2].users` or `shop.sales.users`; `x.y.z` for `[x.y.z]`. So the comments survive the round trip. The exception is `[x]]y]`, which the importer reads as a table `x` with no columns.
- **A column name reaches level 2 as typed.** So a bracketed one in an unquoted export (`'[Order Id]'`) is refused by SQL Server (Msg 15135). It also matches no column the importer reads (`Order Id`). The owner has not decided this case.
- **The text is a national literal.** `MSSQL.ts` writes each `MS_Description` value as `N'…'` (`toDescription`), the form SSMS writes. SQL Server reads a plain literal as varchar in the database's code page. On 2026-10-20, SQL Server 2022 under its default collation, `SQL_Latin1_General_CP1_CI_AS`, kept the Korean `회원` of a plain literal as `??` and of a national one as written. The level names stay plain literals, so the same day a table named `회원` failed its call with Msg 15135, a case the owner has not decided. The importer reads either form.
- **Older exports keep their comments.** `findCommentTable` (`src/utils/schema-sql-parser/index.ts`) reads a call naming an unquoted `dbo.users` whole at level 1 by its last part. So a file an older export wrote (`'user', dbo, 'table', 'dbo.users'`, which SQL Server refuses) keeps its comments. Its `CREATE TABLE dbo.users` reads back as `users`.

### Logical names as comments

- **An empty comment can write the logical name**, as the owner decided. Under `logicalNameAsComment` (`SchemaSQLOptions`, off when left out), a table or column whose comment is blank writes its logical name where its comment would go. `commentToWrite` (`utils.ts`) picks the text: the comment while not blank, else the logical name while the option is on and it is not blank, else nothing. Every table and column comment place of the eight writers calls it, so each vendor writes a logical name in the form it writes a comment:
  - MySQL and MariaDB inline (`COMMENT 'x'` on the column, `) COMMENT 'x';` on the table), MySQL's ifNotExists batch too;
  - PostgreSQL and Oracle `COMMENT ON TABLE` / `COMMENT ON COLUMN` after the table, Oracle's blank lines written as one line break (below);
  - SQL Server an `MS_Description` call per table and column (SQL Server comments, above);
  - Snowflake inline, `COMMENT = 'x'` on the table;
  - Databricks inline, in its Spark string literal (Quoting and string literals, above);
  - SQLite a `--` comment line above the table or column, since it keeps no comment, its line breaks written as a space (below).
- **A comment that is not blank stays.** The logical name never replaces or joins it.
- **SQLite writes a line break as a space** (an owner decision of 2026-10-20). A line break would end the `--` line and run the text after it as SQL, so `SQLite.ts` writes each run of line breaks in a comment or a logical name as one space (`toCommentLine`). On 2026-10-20 SQLite 3.54 refused the earlier output of a table comment on two lines and created neither table of the document; it ran this output clean.
- **Oracle writes a run of blank lines as one line break** (an owner decision of 2026-10-21). SQL*Plus ends a statement at a blank line, one of spaces or tabs alike, and skips the rest of it, and `WHENEVER SQLERROR EXIT FAILURE` still exits 0. So `Oracle.ts` writes each run of blank lines in a comment or a logical name as one line break (`toCommentLiteral`). On 2026-10-21 SQL*Plus on Oracle AI Database 26ai Free dropped, with exit 0, the 16 comments of the earlier output that held a blank line in one of eight shapes; it kept all 18 of this output.
- **Only `true` turns it on.** `createSchemaSQL` reads any other value, from a host's `getSchemaSQL()` or an agent's read, as left out. The Schema SQL tab's switch (`src/components/schema-sql/AGENTS.md`) passes the window's choice; Table Properties' one table never writes it.
- **Measured on 2026-10-20.** MySQL 8.4, MariaDB 11.4, PostgreSQL 17, SQL Server 2022, Oracle AI Database 26ai Free and SQLite 3.54 ran the DDL of a document whose tables and columns had logical names and no comment, Korean ones and one with a quote among them, beside a table comment and a column comment. Each catalog held every logical name and comment on its table and column, SQL Server's once its descriptions were national literals (SQL Server comments, above). SQLite's schema text keeps the column lines alone, since a table's line stands before its `CREATE TABLE`.

### Column defaults

- **Write a default as stored, wrapped where needed.** A column default goes out as stored, but in parentheses where the database reads that expression only inside them (`formatDefault`, `utils.ts`). The writer adds them since the importer keeps a default without the parentheses around it (`packages/schema-sql-parser/AGENTS.md`).
- **MySQL wraps by the default and type.**
  - It wraps anything but a literal or the current time. A current time with an `ON UPDATE` written into the default by hand stays bare.
  - From the column's type it is handed, it also wraps two defaults that MySQL reads only in parentheses. One is any default but `NULL` on a BLOB, TEXT, JSON or spatial column. The other is the current time on any column but a TIMESTAMP or DATETIME.
  - A type that opens with `LONG` is among the BLOB and TEXT types, since MySQL reads it as MEDIUMTEXT or MEDIUMBLOB.
- **MariaDB, SQLite and PostgreSQL wrap less.** MariaDB wraps anything but a literal, the current time, a function call or a name. SQLite wraps anything but a literal or a name. PostgreSQL wraps only an expression holding a word its `DEFAULT` refuses outside parentheses (`AT TIME ZONE`, `AND`, `IS`, `COLLATE`, `= ANY`, …).
- **Four databases take an expression bare.** SQL Server, Oracle, Snowflake and Databricks do, so their output is the stored text. So is a default its database takes bare.

### Dotted table names

- **Build automatic names from the table part.** An unquoted table name with a dot is schema and table. So SQL Server, Oracle, MySQL, MariaDB and PostgreSQL build an automatic constraint or index name from its last part (`tableNamePart`, `src/utils/tableName.ts`). `sales.users` writes `PK_users`, `UQ_users_email`, `FK_users_TO_orders` and `IDX_users`. Each of those databases refused these names with the dot in them.
- **SQLite builds only `IDX_users` that way.** SQLite names no constraint: it writes its primary key, unique and foreign key clauses bare. So the only automatic name it builds from the table part is `IDX_users`. It refused that name with the dot in it too.
- **Split as `MSSQL.ts` reads its levels.** The name splits by the rule `MSSQL.ts` reads its `MS_Description` levels with; both use `splitNameParts` and `unquoteNamePart`. It splits at a dot outside brackets or double quotes. The last part loses one enclosing pair, and a doubled closing character inside reads as one.
  - `[sales].[users]` and `"sales"."users"` write `PK_users` too.
  - `[Order]`, which has no dot, writes `PK_Order`.
  - `[x.y.z]` stays one part, `PK_x.y.z`, which no database reads unquoted. SQL Server refuses its `CREATE TABLE` with Msg 102, as it refused the `PK_z]` an earlier split wrote.
- **Statements keep delimiters as typed.** The schema and the table a statement names keep their delimiters as typed (`splitTableName`). That covers Oracle's and SQLite's index, sequence and trigger qualifier (`"sales".IDX_users`; a quoted Oracle schema is case sensitive). It also covers SQLite's `ON` and `REFERENCES` table (`"users"`).
- **Measured on 2026-10-05 for `"sales"."users"`.** The export ran clean on PostgreSQL 17, Oracle 23ai Free (in a user `"sales"`, the trigger filling the key on insert) and SQLite 3.54. Under `ANSI_QUOTES` it ran clean on MySQL 8.4 and MariaDB 11.8. Each refused the `IDX_"users"` or `PK_"users"` an earlier split wrote.
- **The Indexes tab splits for the same six.** `splitsTableName` names the six databases that build names from the table part (SQL Server, Oracle, MySQL, MariaDB, PostgreSQL and SQLite) for the Indexes tab's key rows (`getColumnKeys`, `src/utils/tableKeys.ts`). Under Snowflake and Databricks the rows keep the whole name, as their DDL does.
- **Two schemas, one table name.** The export repeats the primary key and unique names of a table name two schemas hold; every database that names them keeps them in the table's schema. It numbers the foreign key and index names across the whole export. SQL Server 2022, Oracle 23ai Free, MySQL 8.4, MariaDB 11, PostgreSQL 17 and SQLite ran that script clean.
- **Number names that differ only in case.** Those six number an automatic index name that repeats an earlier one, or repeats it but for case, quoted or not (`autoNameIgnoreCase`, `src/utils/tableName.ts`), as the owner decided. The five that name foreign keys number an automatic foreign key name the same way.
  - `sales.users` and `hr.Users` referenced from `sales.orders` write `FK_users_TO_orders` and `FK_Users_TO_orders1`. Those five refused the unnumbered pair and ran the numbered script clean. SQLite, which writes no foreign key name, ran either script.
  - MySQL and MariaDB refused the unnumbered pair for a quoted `users` and `Users` too, since a foreign key's index name folds. PostgreSQL and Oracle ran that pair either way, and SQL Server and SQLite refuse its second table.
- **Other numbering compares exactly.** A name differing in more than case keeps its bytes. Snowflake, Databricks, Oracle's sequence names, the importers and the code generators but `doctrine.ts` number through `autoName`, which compares exactly. `doctrine.ts` numbers a blank index name with `autoNameIgnoreCase`, as its Indexes rule says (`src/utils/generator-code/AGENTS.md`, `doctrine.ts`).
- **Oracle qualifies indexes on a dotted table.** Oracle writes every index on a dotted table beside it, automatic or named (`sales.IDX_users`, `sales.idx_users_name`). Unqualified, an index lands in the current user's schema, where one name given in two schemas clashes.
- **Oracle puts the sequence and trigger there too.** It creates an `autoIncrement` column's sequence and trigger in the table's schema, named from the table part: `sales.SEQ_users` and `sales.SEQ_TRG_users`, whose body reads `sales.SEQ_users.NEXTVAL`. Oracle ran it as SYSTEM and as each schema's owner. The trigger name is numbered against the sequence names, never the earlier triggers.
- **SQLite qualifies the index name only.** SQLite writes `CREATE INDEX sales.IDX_users ON users` and `REFERENCES users`, the only spelling it reads. A foreign key resolves in the child table's schema.
- **A qualified index name keeps its schema.** In Oracle and SQLite, an index name the user already qualified keeps its own schema.
- **A quoted name stays one identifier.** It keeps the whole name (`"PK_sales.users"`).

### Foreign key pairs

- **Read a relationship pair by pair.** The eight SQL generators read a relationship pair by pair (`toForeignKeyPairs`, `utils.ts`).
- **Drop a pair whose column has left.** A pair one of whose columns has left its table is dropped whole, and the rest stay paired. A removed table or column made DDL reference what it never creates.
- **Order pairs by the key's declaration.** Pairs referencing the start table's whole primary key follow its declaration order: the table's column order, which the PRIMARY KEY clause writes. Any other pairs follow the stored order. MySQL refuses a foreign key naming a key's columns in another order (error 6125), and MariaDB does too (errno 150).
- **Skip a relationship with nothing to write.** A relationship whose table is out of the document, or with no pair left, is skipped. It writes no constraint, uses up no constraint name and leaves no blank line.
- **SQLite counts the foreign keys it writes.** It counts them for the comma after the PRIMARY KEY clause, and after the last column of a table with no primary key.
- **`seaorm.ts` reads the pairs too.** It reads them for its `from` and `to`. The other ORM generators and DBML, AML and Mermaid do not yet.

### Some tables and their indexes

- **Write the given tables and what they hold.** `createSchemaSQL` given table ids (`toSchemaEntities`) writes those tables, their indexes and the foreign keys they hold. The ids are what `mcp-server`'s `erd_read` with `tableIds`, `tableNames` or `groupNames` and the Schema SQL tab's Tables write.
- **Judge a parent left out by the document.** A parent the selection leaves out is judged by the whole document. So a reference out of the selection stays, where a removed parent's does not.
- **Read indexes as the saved file keeps them.** An index of a table out of the document is skipped. An index column whose column has left its table is dropped (`selectIndexColumns`, `utils.ts`). So a session's DDL and its file's agree.
- **An index with no column writes nothing.** An index left with no column still writes no statement in any vendor.

### `createSchemaSQL`: order, options and scripts

- **Write the parts in a fixed order.** `createSchemaSQL(state, database?, tableIds?, options?)` in `index.ts` writes the header, the before script, the DROP block, the tables and the after script, in that order (owner decisions of 2026-10-07). Each part has no blank lines at its edges, and one blank line stands between two.
- **Keep output without an after script unchanged.** The blank line an index with no column left leaves at the tables' end is dropped only before an after script. So an output without one stays byte for byte what it was.
- **No options write Create, no header and no logical name.** `getSchemaSQL()` and `mcp-server`'s `erd_read` write that by default.
- **No database writes the one the state shows.** `createSchemaSQL` reads the live settings, the bracket always and the database unless given one. So a readonly reader's `getSchemaSQL()` with no vendor writes the database and bracket picked on their screen, as their Schema SQL tab does, while `value` keeps the document's (`src/components/schema-sql/SchemaSQL.readonly.browser.test.ts`). Under the bracket's lock a writable pick turns the bracket on that screen alone, sent to no peer, while `value` keeps the locked one (`src/engine/AGENTS.md` § Locks), so the bracket written is always the one shown.
- **Scripts follow the whole document by default.** The scripts go into the whole document's DDL by default and into that of some tables (`tableIds`) only under `scripts: true`. `scripts: false` leaves them out of either. The option is a field of `CreateSchemaSQLOptions`. The Schema SQL tab passes `scripts: true`; `getSchemaSQL()`, which picks the statements, the header and the logical names alone, and `erd_read` never do.
- **An empty document writes `''`.** A document with neither tables nor scripts writes `''` under any option.
- **Resolve options per database in `options.ts`.** It resolves the statements and header asked for per database (`schemaSQLSupport`, `resolveSchemaSQLOptions`).
  - Statements: IF NOT EXISTS on MySQL, MariaDB, PostgreSQL, SQLite and Databricks, Create elsewhere.
  - Header: `use` alone on Oracle, `createAndUse` alone on PostgreSQL, neither on SQLite. `createAndUse` falls back to `use`, and `use` to none.
- **Write a header only for a plain identifier.** A header, and with it the schema PostgreSQL's DROP names a table in, is written only while `settings.databaseName` is a plain identifier (`HEADER_NAME_PATTERN`). That way no vendor needs the name escaped.
- **`formatScript` normalizes, never checks, a script.** It writes a script with LF line breaks, no blank line ahead and no trailing whitespace. On SQL Server it adds `GO` after a script whose last line is no `GO` (or `GO n`), so the script ends its batch. The text is otherwise the user's, never checked. On Oracle a PL/SQL block's `/` is the user's to write.

### IF NOT EXISTS and Drop & re-create

- **MySQL's IF NOT EXISTS is one batch.** It sits between `FOREIGN_KEY_CHECKS` turned off and restored. Each table holds its unique constraints, indexes and foreign keys inside its CREATE TABLE, named as the Create batch names them. MySQL has no IF NOT EXISTS for those.
- **MariaDB marks each statement.** MariaDB writes IF NOT EXISTS on each statement of its own batch.
- **PostgreSQL and Databricks re-add foreign keys.** They drop a foreign key IF EXISTS before they add it back.
- **Drop & re-create drops every written table first.** It drops every table written before creating them. Each database does it its own way:
  - MySQL and MariaDB drop with the foreign key checks off.
  - PostgreSQL drops in one `DROP TABLE IF EXISTS`, which refuses a table another outside it references.
  - SQL Server drops in one transaction (2016 or later). It first drops each foreign key a written table holds, so a key held from a table outside them still refuses. It reads those keys from the `sys.foreign_keys` of the database the table's name gives (`shop.sys.foreign_keys` for `shop.sales.users`). It reads them only once `OBJECT_ID` finds the table, since a missing database's catalog fails past the `CATCH`, the transaction left open.
  - SQLite drops after `PRAGMA foreign_keys=OFF`, which stays off for the connection.
  - Oracle drops in PL/SQL blocks that pass over ORA-00942 and ORA-02289.
  - Databricks drops table by table.
  - Snowflake replaces by `CREATE OR REPLACE TABLE`.

### Oracle triggers, long names and auto increment

- **Oracle writes triggers for its command-line clients.** `Oracle.ts` writes each auto-increment trigger for SQL*Plus and SQLcl: a `/` line after its `END;`, and `:NEW` in its `INTO` (owner decisions of 2026-10-07).
- **`oracleLongNames` lists names past 30 bytes.** It lists the names `Oracle.ts` writes, for the document or the tables given, past the 30 bytes Oracle 12.1 and older allow. The options panel shows them, and the output stays unchanged (owner decisions of 2026-10-07).
- **Keep the clause where the database takes it.** An auto-increment column keeps its clause only where the database takes it (owner decisions of 2026-10-07). Elsewhere it loses the clause, and a comment line after its table names it.
  - `SQLite.ts` writes the lone primary key column of an integer type as `INTEGER`, the one type AUTOINCREMENT runs on. It drops the keyword from one of any other type.
  - `PostgreSQL.ts` writes IDENTITY only on `smallint`, `integer` or `bigint`, by any name PostgreSQL gives them.
  - `Databricks.ts` writes it only on `BIGINT` or its alias `LONG`, from its documentation.

### Referential actions

- **Unset actions write no clause.** A relationship's `onDelete` / `onUpdate` (`ReferentialAction`, `none` by default) write no clause while unset. So the output stays byte for byte what it was.
- **`referentialActionSupport` drops what a database lacks.** `referentialActionSupport` (`utils.ts`) names per database what its DDL writes, and drops the rest, leaving the database default.
  - MySQL and MariaDB refuse SET DEFAULT.
  - SQL Server has no RESTRICT.
  - Oracle writes only ON DELETE CASCADE or SET NULL.
  - Databricks and Snowflake write only NO ACTION.
- **Snowflake's DDL names what it left out.** Snowflake takes every action, yet creates no foreign key on a standard table whose action is another (from its documentation, not measured). So its DDL names what it left out in a comment above the `ALTER TABLE`.
- **The ORM generators follow the same table.** They follow it for `settings.database`, with these differences:
  - `drizzle.ts` follows it for the dialect it writes: PostgreSQL's where it borrows pg-core, which drizzle-kit turns into PostgreSQL DDL.
  - `typeorm.ts` also leaves SET DEFAULT out, since TypeORM writes it `DEFAULT`.
  - `doctrine.ts` writes its ON DELETE alone, Doctrine having no ON UPDATE.
  - `seaorm.ts` writes both, as `on_update` and `on_delete`.
  - `jpa.ts` writes none: JPA has no option, and the generator stays plain JPA, never Hibernate's `@OnDelete`.
- **DBML and AML write every action.** `dbml.ts` and `aml.ts` do, since the documents are vendor-neutral. `aml.ts` writes a relationship with actions as a `rel` statement, since AML hands an inline relation's properties to its attribute. Its `formatTable`, which writes no `rel` statement, keeps the relation inline without them.
- **The context menu offers every action.** The relationship context menu (`src/components/erd/erd-context-menu/menus/relationshipMenus.ts`) offers every action and notes one the current database would drop (`not in MySQL`). So the document stays vendor-neutral, and the user sees why the DDL has no clause.

## Testing Requirements

- **`__fixtures__/options/` holds each combination's bytes.** For each database it holds the bytes each statements and header combination writes, and for a few combinations the same with the before and after scripts (`*-scripts.sql`). They were run on each database but Snowflake and Databricks, which follow their documentation, unmeasured.
- **Rule files sit beside them.** Each is named for the rule it shows and holds the bytes of that rule on its own:
  - Oracle's SQL*Plus triggers and names past 30 bytes.
  - SQLite's AUTOINCREMENT.
  - IDENTITY left off a key type PostgreSQL or Databricks does not take it on, and kept on Databricks' BIGINT.
  - Snowflake's referential actions.
  - A database name that is no plain identifier, which writes no header and no schema on PostgreSQL's DROP (`*-invalid-name.sql`).
  - Logical names as comments, one per database (`logical-name-comment-create-none.sql`): tables and columns with a logical name and no comment, a table and a column whose comments stay, and a logical name holding a quote.
- **`compose.test.ts` and the vendor specs read them.** `compose.test.ts` reads the combination files, Oracle's long names, PostgreSQL's identity comment under the editor defaults (`non-integer-identity-ifNotExists-createAndUse.sql`), the invalid names and the logical name files, and holds that no option writes no logical name. Each vendor spec holds its own form of a logical name comment. `Oracle.test.ts`, `SQLite.test.ts`, `PostgreSQL.test.ts`, `Databricks.test.ts` and `Snowflake.test.ts` read their own rule files.

<!-- MANUAL: notes added below this line are preserved on regeneration -->
