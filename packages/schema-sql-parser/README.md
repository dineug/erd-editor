# schema-sql-parser

> Permissive DDL parser behind the editor's SQL import.

Internal to the erd-editor monorepo — this package is private and is never published to npm.

`schemaSQLParser(source)` tokenizes SQL of any dialect and returns a flat array of statements:
`create.table`, `create.index`, `alter.table.add.{primaryKey,unique,foreignKey}` and
`comment.on.{table,column}`. It is permissive
by design — anything it does not recognize is skipped instead of rejected, so a real dump full of
dialect quirks imports partially rather than failing outright. `--` and `/* */` comments are dropped by
the lexer. It never throws on bad input.

Its one consumer is `@dineug/erd-editor`, which depends on it as
`"@dineug/schema-sql-parser": "workspace:*"`.

## Usage

```ts
import { schemaSQLParser, StatementType } from '@dineug/schema-sql-parser';

const statements = schemaSQLParser(`
  CREATE TABLE users (
    id bigint NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email varchar(255) NOT NULL UNIQUE
  );

  ALTER TABLE orders ADD FOREIGN KEY (user_id) REFERENCES users (id);
`);

for (const statement of statements) {
  if (statement.type === StatementType.createTable) {
    // users [ 'id', 'email' ]
    console.log(statement.name, statement.columns.map(column => column.name));
  }
}
```

`statement.type` narrows the union. `CreateTable` carries `name`, `comment`, `columns`, `indexes` and
`foreignKeys`; `CreateIndex` carries `tableName`, `unique` and `columns`; the three `alter.table.add.*`
nodes carry the altered table's `name` and `columnNames`, plus `refTableName` / `refColumnNames` on
foreign keys — a `CONSTRAINT <id>` prefix is consumed and dropped, so the constraint's own name is not
reported. Index columns carry a `sort` of `SortType.asc` / `SortType.desc`. `CommentOnTable` carries the
table's `name` and its `comment`, `CommentOnColumn` carries `tableName`, `columnName` and `comment` —
PostgreSQL and Oracle attach comments with a statement of their own instead of a table option, so those
two arrive separately from the `create.table` they belong to.

## Support DataType

<details>
<summary>MySQL / MariaDB (44 types)</summary>

  > bigint
  > binary
  > bit
  > blob
  > bool
  > boolean
  > char
  > date
  > datetime
  > dec
  > decimal
  > double
  > enum
  > fixed
  > float
  > geometry
  > geometrycollection
  > int
  > integer
  > json
  > linestring
  > longblob
  > longtext
  > mediumblob
  > mediumint
  > mediumtext
  > multilinestring
  > multipoint
  > multipolygon
  > numeric
  > point
  > polygon
  > real
  > set
  > smallint
  > text
  > time
  > timestamp
  > tinyblob
  > tinyint
  > tinytext
  > varbinary
  > varchar
  > year

</details>

<details>
<summary>MSSQL (31 types)</summary>

  > bigint
  > binary
  > bit
  > char
  > date
  > datetime
  > datetime2
  > datetimeoffset
  > decimal
  > float
  > geography
  > geometry
  > image
  > int
  > money
  > nchar
  > ntext
  > numeric
  > nvarchar
  > real
  > smalldatetime
  > smallint
  > smallmoney
  > sql_variant
  > text
  > time
  > tinyint
  > uniqueidentifier
  > varbinary
  > varchar
  > xml

</details>

<details>
<summary>Oracle (19 types)</summary>

  > bfile
  > binary_double
  > binary_float
  > blob
  > char
  > clob
  > date
  > datetime
  > long
  > nchar
  > nclob
  > number
  > nvarchar2
  > raw
  > timestamp
  > uritype
  > varchar
  > varchar2
  > xmltype

</details>

<details>
<summary>PostgreSQL (53 types)</summary>

  > bigint
  > bigserial
  > bit
  > bool
  > boolean
  > box
  > bytea
  > char
  > character
  > cidr
  > circle
  > date
  > decimal
  > float4
  > float8
  > inet
  > int
  > int2
  > int4
  > int8
  > integer
  > interval
  > json
  > jsonb
  > line
  > lseg
  > macaddr
  > macaddr8
  > money
  > numeric
  > path
  > pg_lsn
  > point
  > polygon
  > real
  > serial
  > serial2
  > serial4
  > serial8
  > smallint
  > smallserial
  > text
  > time
  > timestamp
  > timestamptz
  > timetz
  > tsquery
  > tsvector
  > txid_snapshot
  > uuid
  > varbit
  > varchar
  > xml

</details>

<details>
<summary>SQLite (5 types)</summary>

  > blob
  > integer
  > numeric
  > real
  > text

</details>

## Support Syntax

### Basics

```sql
CREATE TABLE a (
 b bigint
)
```

### Double Quote

```sql
CREATE TABLE "a" (
 "b" bigint
)
```

### Single Quote

```sql
CREATE TABLE 'a' (
 'b' bigint
)
```

### Backtick

```sql
CREATE TABLE `a` (
 `b` bigint
)
```

### database.table

```sql
CREATE TABLE test.a (
 b bigint
)
```

### [database].[table]

```sql
CREATE TABLE [test].[a] (
 b bigint
)
```

### Column Options

```sql
CREATE TABLE a (
 b varchar(255) NOT NULL DEFAULT 'c' COMMENT 'd' PRIMARY KEY AUTO_INCREMENT UNIQUE
)
```

### Column PRIMARY KEY

```sql
CREATE TABLE a (
 b varchar(255),
 c int,
 PRIMARY KEY(b, c)
)
CREATE TABLE b (
 b varchar(255),
 c int,
 CONSTRAINT PK_B PRIMARY KEY(b, c)
)
```

### Column UNIQUE

```sql
CREATE TABLE a (
 b varchar(255),
 c int,
 UNIQUE(b, c)
)
CREATE TABLE b (
 b varchar(255),
 c int,
 CONSTRAINT UC_B UNIQUE(b, c)
)
```

### Column INDEX

```sql
CREATE TABLE a (
 b varchar(255),
 c int,
 INDEX IDX_A (b DESC, c ASC)
)
```

### Column PRIMARY KEY, UNIQUE KEY, KEY

```sql
CREATE TABLE 'users' (
  'id' bigint unsigned NOT NULL AUTO_INCREMENT,
  'name' varchar(30) NOT NULL,
  'email' varchar(30) NOT NULL,
  PRIMARY KEY ('id'),
  UNIQUE KEY 'users_email_unique' ('email'),
  KEY 'test_name_index' ('name'),
);
```

### SQL Comments

```sql
-- the user table
CREATE TABLE users /* pk: id; see docs (v2) */ (
  id INTEGER NOT NULL, -- user id
  /* the address it was signed up with */
  email TEXT
);
```

### Table Options

```sql
CREATE TABLE `role` (
  `id` int NOT NULL AUTO_INCREMENT,
  `key` varchar(30) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `description` text,
  PRIMARY KEY (`id`,`key`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='role';
```

### Table COMMENT with parentheses

```sql
CREATE TABLE `test` (
  `id` int NOT NULL COMMENT '(a)b',
  `name` varchar(30)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='(test)bug here!!';
```

### COMMENT ON TABLE, COMMENT ON COLUMN

```sql
CREATE TABLE users (
  id INT NOT NULL,
  email VARCHAR(255)
);

COMMENT ON TABLE users IS 'user table';

COMMENT ON COLUMN users.id IS 'user id';

COMMENT ON COLUMN public.users.email IS 'email address';
```

### Column FOREIGN KEY

```sql
CREATE TABLE a (
 b varchar(255),
 c int,
 FOREIGN KEY(b, c) REFERENCES b (b, c)
)
CREATE TABLE b (
 b varchar(255),
 c int,
 CONSTRAINT FK_B FOREIGN KEY(b, c) REFERENCES a (b, c)
)
```

### CREATE INDEX

```sql
CREATE INDEX IDX_A on A (a, b DESC)
CREATE UNIQUE INDEX IDX_B on B (a, b DESC)
```

### Alter Table Add PRIMARY KEY

```sql
ALTER TABLE Persons ADD PRIMARY KEY (ID)
ALTER TABLE Persons ADD CONSTRAINT PK_Person PRIMARY KEY (ID,LastName)
```

### Alter database.Table Add PRIMARY KEY

```sql
ALTER TABLE "public".Persons ADD PRIMARY KEY (ID)
ALTER TABLE "public".Persons ADD CONSTRAINT PK_Person PRIMARY KEY (ID,LastName)
```

### Alter Table Add FOREIGN KEY

```sql
ALTER TABLE Orders
ADD FOREIGN KEY (PersonID) REFERENCES Persons(PersonID)

ALTER TABLE Orders
ADD CONSTRAINT FK_PersonOrder
FOREIGN KEY (PersonID) REFERENCES Persons(PersonID)
```

### Alter database.Table Add FOREIGN KEY

```sql
ALTER TABLE "public".Orders
ADD FOREIGN KEY (PersonID) REFERENCES "public".Persons(PersonID)

ALTER TABLE "public".Orders
ADD CONSTRAINT FK_PersonOrder
FOREIGN KEY (PersonID) REFERENCES "public".Persons(PersonID)
```

### Alter Table Add UNIQUE

```sql
ALTER TABLE Persons ADD UNIQUE (ID)
ALTER TABLE Persons ADD CONSTRAINT UC_Person UNIQUE (ID,LastName)
```

### Alter database.Table Add UNIQUE

```sql
ALTER TABLE "public".Persons ADD UNIQUE (ID)
ALTER TABLE "public".Persons ADD CONSTRAINT UC_Person UNIQUE (ID,LastName)
```

### Alter Table Only

```sql
ALTER TABLE ONLY Persons ADD PRIMARY KEY (ID)
ALTER TABLE ONLY Persons ADD CONSTRAINT PK_Person PRIMARY KEY (ID,LastName)
ALTER TABLE ONLY "public".Persons ADD PRIMARY KEY (ID)
ALTER TABLE ONLY "public".Persons ADD CONSTRAINT PK_Person PRIMARY KEY (ID,LastName)
ALTER TABLE ONLY Orders ADD FOREIGN KEY (PersonID) REFERENCES Persons(PersonID)
ALTER TABLE ONLY Orders ADD CONSTRAINT FK_PersonOrder FOREIGN KEY (PersonID) REFERENCES Persons(PersonID)
ALTER TABLE ONLY "public".Orders ADD FOREIGN KEY (PersonID) REFERENCES "public".Persons(PersonID)
ALTER TABLE ONLY "public".Orders ADD CONSTRAINT FK_PersonOrder FOREIGN KEY (PersonID) REFERENCES "public".Persons(PersonID)
ALTER TABLE ONLY Persons ADD UNIQUE (ID)
ALTER TABLE ONLY Persons ADD CONSTRAINT UC_Person UNIQUE (ID,LastName)
ALTER TABLE ONLY "public".Persons ADD UNIQUE (ID)
ALTER TABLE ONLY "public".Persons ADD CONSTRAINT UC_Person UNIQUE (ID,LastName)
```

## Development

```sh
pnpm exec vp run --filter @dineug/schema-sql-parser --fail-if-no-match test
pnpm --filter @dineug/schema-sql-parser test:coverage
```
