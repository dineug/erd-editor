# generator-code

**Parent context:** `../AGENTS.md`
**Generated:** 2026-10-11 · **Updated:** 2026-11-03

## Purpose

`src/utils/generator-code/` holds one module per Code Generator language behind `index.ts`'s `createGeneratorCode` and `createGeneratorCodeTable`, and `columnTypes.ts`, the shared vendor type classifier. The rules below are owner decisions and measured behaviour that describe output chosen on purpose, not bugs. The Code Generator tab's own rules (its options panel, the code as a snapshot, Save file, the language menu and highlighting) are in `src/components/generator-code/AGENTS.md`. The vendor type lists in `constants/sql/dataType/`, whose categories the classifier falls back to, are in the package file (`packages/erd-editor/AGENTS.md`) § Common Patterns.

## Rules

The rules every generator follows are below. What each generator writes on purpose is in a note of its own under `notes/`, one shared by Java, Kotlin and Scala. Before changing a generator, read its note, since only this file loads on its own. Each note opens with what its generator writes. Where a note has them, its Written as is bullets list output that a compiler, driver or library refuses or reads otherwise, left so on purpose. Its Measured bullets give the runs that checked its rules.

| Note | Generator | Code Generator language |
| --- | --- | --- |
| `notes/sqlalchemy.md` | `sqlalchemy.ts` | SQLAlchemy |
| `notes/typeorm.md` | `typeorm.ts` | TypeORM |
| `notes/sequelize.md` | `sequelize.ts` | Sequelize |
| `notes/drizzle.md` | `drizzle.ts` | Drizzle |
| `notes/graphql.md` | `graphql.ts` | GraphQL |
| `notes/csharp.md` | `csharp.ts` | C# |
| `notes/go.md` | `go.ts` | Go |
| `notes/java-kotlin-scala.md` | `java.ts`, `kotlin.ts` and `scala.ts` | Java, Kotlin and Scala |
| `notes/jpa.md` | `jpa.ts` | JPA |
| `notes/php.md` | `php.ts` | PHP |
| `notes/doctrine.md` | `doctrine.ts` | Doctrine |
| `notes/rust.md` | `rust.ts` | Rust |
| `notes/seaorm.md` | `seaorm.ts` | SeaORM |
| `notes/swift.md` | `swift.ts` | Swift |
| `notes/typescript.md` | `typescript.ts` | TypeScript |
| `notes/zod.md` | `zod.ts` | Zod |
| `notes/jsonSchema.md` | `jsonSchema.ts` | JSON Schema |
| `notes/dbml.md` | `dbml.ts` | DBML |
| `notes/aml.md` | `aml.ts` | AML |
| `notes/mermaid.md` | `mermaid.ts` | Mermaid |

### Rules every generator follows

- **Import headers.** A generator either writes the imports its code needs or leaves names unimported.
  - `sqlalchemy.ts` (`class Base(DeclarativeBase)`), `drizzle.ts`, `zod.ts` (`import * as z from "zod";`), `swift.ts` (`import Foundation`) and `doctrine.ts` (`use Doctrine\ORM\Mapping as ORM;`) emit an import header. They emit it in one table's code too.
  - `seaorm.ts` writes its `use sea_orm::entity::prelude::*;` inside each table's `pub mod` and atop a table's own file.
  - `jsonSchema.ts` writes its `$schema`.
  - `typeorm.ts`, `jpa.ts`, `sequelize.ts`, `rust.ts` (paths written whole, `chrono::NaiveDate`) and the plain generators of Java, Kotlin, Scala, Go, C# and PHP leave names unimported.
- **Four ORM generators render faithfully.** sqlalchemy, typeorm, sequelize and drizzle write the document as it is:
  - A reference names its target by class name.
  - Duplicate table names are kept; class names dedupe.
  - An unnamed column is written as `""`.
  - A keyless table is written as is.
- **One vendor type classifier.** `columnTypes.ts` is the one classifier of vendor types (an owner decision of 2026-10-09). `getColumnType(dataType, database)` reads a column's type by name before the shared vendor tables. Those tables file each name under one of eleven categories. `getColumnType` answers what the generators need:
  - The scalar: `bool`, integers by width and sign, `f32` or `f64`, `decimal`, `string`, `bytes`, `uuid`, `json`, `date`, `time`, `timeTz`, `dateTime`, `dateTimeUtc` (an instant shown in the session's zone), `dateTimeOffset`, `interval`.
  - The base name, lower case, with its arguments gone. On MySQL and MariaDB its UNSIGNED, ZEROFILL and SIGNED go too.
  - The numeric arguments.
  - The PostgreSQL array depth (`splitPostgresArray`).
  - An integer's width (24 for MEDIUMINT).
  - A character type's declared length.
  - A decimal's precision and scale. `NUMBER(*,s)` has precision 38.
  - An interval's fields: year to month, day to second, or both.
  - The network kind.
  - An ENUM's or SET's members (`enumMembers`), each read as MySQL reads a string literal.
  - Whether the type is unsigned: UNSIGNED, ZEROFILL or SERIAL on MySQL and MariaDB.
  - Whether it is a serial, a float or money.
  - Whether it is SQL Server's `uniqueidentifier` (`isGuid`: any 16 bytes, not only an RFC UUID) or `rowversion`.
  - Whether it is semi-structured: Snowflake's and Databricks' VARIANT, OBJECT, ARRAY, MAP, STRUCT.
  - Whether it is a PostgreSQL bit string.
  - Whether it is PostgreSQL's `xid`, `cid` or `xid8` (`isTextInteger`), since node-postgres hands them over as text.
  - Whether it is Databricks' `VOID` (`isNullOnly`).
  - Whether the database's vendor list names it (`isListed`).
- **Integer widths.** `columnScalar` gives the width a name declares. `getColumnType` widens every integer of Oracle, Snowflake and SQLite to `i64`. Oracle's is a NUMBER(38), Snowflake's a NUMBER(38,0), SQLite's eight bytes.
- **Who reads the classifier.** Every generator reads it except DBML, AML and Mermaid, which write types as is.
  - Swift, Zod, JSON Schema, TypeScript, Java, Kotlin, Scala, Go, GraphQL and JPA take their types from it.
  - C#, SQLAlchemy, TypeORM, Sequelize and Drizzle read it by name, before their own tables and the vendor tables.
  - PHP uses its `POSTGRES_BIT_TYPES`; Doctrine uses that set and `enumMembers`.
  - Rust and SeaORM read it through `rustTypes.ts`, the Rust layer on top (next bullet).
- **`rustTypes.ts` keeps Rust output as it was.** Rust and SeaORM output stayed byte for byte what it was as the classifier moved (an owner decision of 2026-10-09). The one exception is PostgreSQL's and SQLite's `dec`, which their vendor lists gained (below). `rustPrimitiveType` now reads it as a decimal (`notes/rust.md`, Types; an owner decision of 2026-10-10). The layer keeps:
  - sqlx's own choices, each as a `String`: MariaDB's `UUID`, PostgreSQL's `oid`, `cid`, `xid`, `xid8`, `timetz` and intervals, the semi-structured types, and SQLite's `BOOL`, `TIME` and `TIMESTAMP`.
  - The declared widths.
  - SIGNED in the name.
  - The vendor categories from before the tables were refiled (`rustPrimitiveType`).
- **Vendor tables refiled with the classifier.** An owner decision of 2026-10-09:
  - SQL Server's `bit` is a boolean; its `numeric`, `money` and `smallmoney` are decimals.
  - PostgreSQL's bit strings, `pg_lsn` and `money` are strings.
  - Oracle's `DATE` is a date and time; its `REAL` is a double.
  - SQL Server's `binary` and Oracle's `RAW` are filed as `varbinary` is.
  - `getPrimitiveType` (`utils.ts`) reads an Oracle or Snowflake `NUMBER(p,s)` with a scale above 0 as a decimal.
  - On MySQL, MariaDB, PostgreSQL and SQL Server, `getPrimitiveType` reads `FLOAT(1)` to `FLOAT(24)` as a float and `FLOAT(25)` to `FLOAT(53)` as a double.
- **Vendor lists gained five names.** SQLite's list gained `BOOL`, `DEC`, `TIME` and `TIMESTAMP`; PostgreSQL's gained `dec`. Each is in step with `schema-sql-parser`'s list, so the column cell suggests them too.
- **Case type names without the locale.** A type name is cased with `toLowerCase` / `toUpperCase`, never `toLocaleLowerCase`. This holds for the shared helpers in `utils.ts` and `columnTypes.ts`, and for the vendor tables. Under a Turkish or Azerbaijani default locale the locale form turns `I` into a dotless `ı`, so a name holding an I matched nothing. `__test-utils__/locale.ts`'s `underTurkishLocale` runs a spec under those rules (`utils.test.ts`, `columnTypes.test.ts`, `rustTypes.test.ts`, `seaorm.test.ts`).
- **Shared helpers live in `utils.ts`.** `splitLines` splits at `LINE_TERMINATOR`: CR, LF, CRLF, U+2028 and U+2029, where an ECMAScript line comment ends. C# adds U+0085. The other shared helpers are `fractionalNumber`, `baseTypeName` and `findDataTypeHint`.
- **The SQL importer keeps UNSIGNED and ZEROFILL.** It keeps MySQL's UNSIGNED and ZEROFILL in a column's data type (an owner decision of 2026-10-09). So an imported schema reaches every unsigned rule, and its DDL keeps them. The importer's side is in `packages/schema-sql-parser/AGENTS.md`.
  - It drops SIGNED, the default, which MySQL and MariaDB store as the bare type.
  - Kept, SIGNED hid the type's name from Rust, SeaORM and Doctrine, which read the whole name. A `TINYINT SIGNED` became an `i32` where the bare type is an `i8`, and Doctrine's INTEGER where it is a SMALLINT.
  - Kept, SIGNED also made DBML, AML and Mermaid quote the type.
  - A type with UNSIGNED or ZEROFILL goes into every database's DDL as written. PostgreSQL and SQL Server refuse it, as they refused one typed by hand.
- **A primary key column is NOT NULL.** A key column without the NN flag is NOT NULL in every generator (an owner decision of 2026-10-09). DBML, AML and Mermaid are the exception, since they transcribe the document. DBML and AML also import back; no importer reads Mermaid. So the three keep a key's NN flag as the document has it: `"id" int [pk]`, `id int nullable pk`, `int? id PK` (an owner decision of 2026-10-10).
- **No TypeScript directive in a comment.** Every TypeScript-family generator writes a comment line TypeScript would read as a directive as plain text (`escapeTypeScriptDirective`, `utils.ts`, an owner decision of 2026-10-10).
  - `typescript.ts`, `zod.ts` and `drizzle.ts` write a comment as `//` lines. Each line whose text opens with `@ts-`, after any white space and in any letter case, takes a backslash before its at sign: `// \@ts-ignore`, `//   \@TS-NOCHECK`. So it reads as written and is no directive.
  - A line where `@ts-` follows other text (`see @ts-ignore`) or a `/` stays as it is.
  - `typeorm.ts` and `sequelize.ts` write a comment inside a string literal alone (`comment: "@ts-ignore"`). TypeScript reads no directive there, so they need nothing (`typeorm.test.ts`, `sequelize.test.ts`).
  - The compilers read `@ts-ignore` and `@ts-expect-error` in lower case on any line, with any text after them (`@ts-ignored`, `@ts-expect-errors`). They hide the error of the next line that is no comment. Where that line holds no error, `@ts-expect-error` fails with TS2578.
  - The compilers read `@ts-nocheck` and `@ts-check` in any letter case in the comments a file opens with. `typescript.ts` puts the first table's comment there, so one left as is would turn off checking of the whole file.
  - On TypeScript 5.9 and 6.0, `@ts-nocheck` and `@ts-check` count when followed by white space, a colon or the line's end. On 7.0 they count when followed by anything but an ASCII letter or `-` (`@ts-nocheck1`, `@ts-nocheckß`).
  - Before the at sign, 5.9 and 6.0 skip any white space JavaScript's `\s` matches (U+00A0, U+FEFF). 7.0 skips spaces and tabs alone.
  - Measured on 2026-10-10 with TypeScript 5.9.3, 6.0.3 and 7.0.2 (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), zod 4.6.5, drizzle-orm 0.45.4, TypeORM 1.1.2 and Sequelize 6.37.8:
    - A table and two column comments held each of 13 directive spellings (each case, each kind of white space, a suffix). Under the eight databases, as the whole text and each table alone, that made 600 files across the five generators. All compiled with no error. Before the change, TypeScript's and Zod's had failed with 144 TS2578 each.
    - An unknown name was put after each of the 1,968 comment blocks holding such a line in the TypeScript, Zod and Drizzle files. It failed on all three compilers; no error was hidden.
    - Every language's output was generated for the 211 names of the vendor lists and the five `data/*.sql` fixtures under each database: 3,696 texts with the comment corpus. It matched the output from before byte for byte, except 1,344 comment lines of TypeScript, Zod and Drizzle. Each of those opens with `@ts-` and gained its backslash.

## Manual Notes

Notes under this heading are written by humans and preserved on regeneration.
