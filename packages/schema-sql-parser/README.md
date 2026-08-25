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
<summary>MySQL (70 types)</summary>

  > bigint
  > binary
  > bit
  > blob
  > bool
  > boolean
  > char
  > char byte
  > character
  > character varying
  > date
  > datetime
  > dec
  > decimal
  > double
  > double precision
  > enum
  > fixed
  > float
  > float4
  > float8
  > geomcollection
  > geometry
  > geometrycollection
  > int
  > int1
  > int2
  > int3
  > int4
  > int8
  > integer
  > json
  > linestring
  > long
  > long varbinary
  > long varchar
  > longblob
  > longtext
  > mediumblob
  > mediumint
  > mediumtext
  > middleint
  > multilinestring
  > multipoint
  > multipolygon
  > national char
  > national char varying
  > national character
  > national character varying
  > national varchar
  > nchar
  > nchar varchar
  > numeric
  > nvarchar
  > point
  > polygon
  > real
  > serial
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
  > varcharacter
  > year

</details>

<details>
<summary>Databricks (45 types)</summary>

  > array
  > bigint
  > binary
  > boolean
  > byte
  > char
  > date
  > dec
  > decimal
  > double
  > float
  > geography
  > geometry
  > int
  > integer
  > interval
  > interval day
  > interval day to hour
  > interval day to minute
  > interval day to second
  > interval hour
  > interval hour to minute
  > interval hour to second
  > interval minute
  > interval minute to second
  > interval month
  > interval second
  > interval year
  > interval year to month
  > long
  > map
  > numeric
  > object
  > real
  > short
  > smallint
  > string
  > struct
  > timestamp
  > timestamp_ltz
  > timestamp_ntz
  > tinyint
  > varchar
  > variant
  > void

</details>

<details>
<summary>MariaDB (86 types)</summary>

  > bigint
  > binary
  > bit
  > blob
  > bool
  > boolean
  > char
  > char byte
  > char varying
  > character
  > character varying
  > clob
  > date
  > datetime
  > dec
  > decimal
  > double
  > double precision
  > enum
  > fixed
  > float
  > float4
  > float8
  > geometry
  > geometrycollection
  > inet4
  > inet6
  > int
  > int1
  > int2
  > int3
  > int4
  > int8
  > integer
  > json
  > linestring
  > long
  > long char varying
  > long character varying
  > long varbinary
  > long varchar
  > long varcharacter
  > longblob
  > longtext
  > mediumblob
  > mediumint
  > mediumtext
  > middleint
  > multilinestring
  > multipoint
  > multipolygon
  > national char
  > national char varying
  > national character
  > national character varying
  > national varchar
  > national varcharacter
  > nchar
  > nchar varchar
  > nchar varcharacter
  > nchar varying
  > number
  > numeric
  > nvarchar
  > point
  > polygon
  > raw
  > real
  > serial
  > set
  > smallint
  > sql_tsi_year
  > text
  > time
  > timestamp
  > tinyblob
  > tinyint
  > tinytext
  > uuid
  > varbinary
  > varchar
  > varchar2
  > varcharacter
  > vector
  > xmltype
  > year

</details>

<details>
<summary>MSSQL (48 types)</summary>

  > bigint
  > binary
  > binary varying
  > bit
  > char
  > char varying
  > character
  > character varying
  > date
  > datetime
  > datetime2
  > datetimeoffset
  > dec
  > decimal
  > double precision
  > float
  > geography
  > geometry
  > hierarchyid
  > image
  > int
  > integer
  > json
  > money
  > national char
  > national char varying
  > national character
  > national character varying
  > national text
  > nchar
  > ntext
  > numeric
  > nvarchar
  > real
  > rowversion
  > smalldatetime
  > smallint
  > smallmoney
  > sql_variant
  > text
  > time
  > timestamp
  > tinyint
  > uniqueidentifier
  > varbinary
  > varchar
  > vector
  > xml

</details>

<details>
<summary>Oracle (51 types)</summary>

  > anydata
  > bfile
  > binary_double
  > binary_float
  > blob
  > bool
  > boolean
  > char
  > char varying
  > character
  > character varying
  > clob
  > date
  > dec
  > decimal
  > double precision
  > float
  > int
  > integer
  > interval day to second
  > interval year to month
  > json
  > long
  > long raw
  > long varchar
  > national char
  > national char varying
  > national character
  > national character varying
  > nchar
  > nchar varying
  > nclob
  > number
  > numeric
  > nvarchar2
  > raw
  > real
  > rowid
  > sdo_geometry
  > sdo_georaster
  > sdo_topo_geometry
  > smallint
  > timestamp
  > timestamp with local time zone
  > timestamp with time zone
  > uritype
  > urowid
  > varchar
  > varchar2
  > vector
  > xmltype

</details>

<details>
<summary>PostgreSQL (106 types)</summary>

  > bigint
  > bigserial
  > bit
  > bit varying
  > bool
  > boolean
  > box
  > bpchar
  > bytea
  > char
  > character
  > character varying
  > cid
  > cidr
  > circle
  > date
  > datemultirange
  > daterange
  > decimal
  > double precision
  > float
  > float4
  > float8
  > inet
  > int
  > int2
  > int4
  > int4multirange
  > int4range
  > int8
  > int8multirange
  > int8range
  > integer
  > interval
  > interval day
  > interval day to hour
  > interval day to minute
  > interval day to second
  > interval hour
  > interval hour to minute
  > interval hour to second
  > interval minute
  > interval minute to second
  > interval month
  > interval second
  > interval year
  > interval year to month
  > json
  > jsonb
  > jsonpath
  > line
  > lseg
  > macaddr
  > macaddr8
  > money
  > name
  > numeric
  > nummultirange
  > numrange
  > oid
  > path
  > pg_lsn
  > pg_snapshot
  > point
  > polygon
  > real
  > regclass
  > regcollation
  > regconfig
  > regdictionary
  > regnamespace
  > regoper
  > regoperator
  > regproc
  > regprocedure
  > regrole
  > regtype
  > serial
  > serial2
  > serial4
  > serial8
  > smallint
  > smallserial
  > text
  > tid
  > time
  > time with time zone
  > time without time zone
  > timestamp
  > timestamp with time zone
  > timestamp without time zone
  > timestamptz
  > timetz
  > tsmultirange
  > tsquery
  > tsrange
  > tstzmultirange
  > tstzrange
  > tsvector
  > txid_snapshot
  > uuid
  > varbit
  > varchar
  > xid
  > xid8
  > xml

</details>

<details>
<summary>Snowflake (54 types)</summary>

  > array
  > bigint
  > binary
  > boolean
  > byteint
  > char
  > char varying
  > character
  > date
  > datetime
  > dec
  > decfloat
  > decimal
  > double
  > double precision
  > file
  > float
  > float4
  > float8
  > geography
  > geometry
  > int
  > integer
  > map
  > nchar
  > nchar varying
  > number
  > numeric
  > nvarchar
  > nvarchar2
  > object
  > real
  > smallint
  > string
  > text
  > time
  > timestamp
  > timestamp with local time zone
  > timestamp with time zone
  > timestamp without time zone
  > timestamp_ltz
  > timestamp_ntz
  > timestamp_tz
  > timestampltz
  > timestampntz
  > timestamptz
  > tinyint
  > unknown
  > uuid
  > varbinary
  > varchar
  > varchar2
  > variant
  > vector

</details>

<details>
<summary>SQLite (27 types)</summary>

  > bigint
  > blob
  > boolean
  > character
  > clob
  > date
  > datetime
  > decimal
  > double
  > double precision
  > float
  > int
  > int2
  > int8
  > integer
  > mediumint
  > native character
  > nchar
  > numeric
  > nvarchar
  > real
  > smallint
  > text
  > tinyint
  > unsigned big int
  > varchar
  > varying character

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

### Snowflake CREATE OR REPLACE TABLE

```sql
create or replace TABLE MYDATABASE.PUBLIC.SALESORDERS cluster by LINEAR(ORDER_DATE)(
	ORDER_ID NUMBER(38,0) NOT NULL autoincrement start 1 increment 1,
	ORDER_DATE DATE NOT NULL,
	PROFILE OBJECT(city VARCHAR, zip NUMBER),
	SP_ID NUMBER(38,0) NOT NULL,
	unique (SP_ID),
	constraint PK_ORDER_ID primary key (ORDER_ID) not enforced rely,
	constraint FK_SP_ID foreign key (SP_ID) references MYDATABASE.PUBLIC.SALESPEOPLE(SP_ID)
)
COMMENT = 'sales orders'
```

```sql
ALTER TABLE MY_DB.MY_SCHEMA.ORDERS ADD FOREIGN KEY (CUSTOMER_ID) REFERENCES MY_DB.MY_SCHEMA.CUSTOMER (CUSTOMER_ID)
```

### Databricks CREATE TABLE

```sql
CREATE TABLE `main`.`events` (
  `event_id` BIGINT NOT NULL COMMENT 'event id',
  `user_id` STRING NOT NULL,
  `occurred_at` TIMESTAMP_NTZ,
  `tags` ARRAY<STRING>,
  `props` MAP<STRING, STRING>,
  CONSTRAINT `pk_events` PRIMARY KEY (`event_id`) NOT ENFORCED RELY
)
USING DELTA
```

## Development

```sh
pnpm exec vp run --filter @dineug/schema-sql-parser --fail-if-no-match test
pnpm --filter @dineug/schema-sql-parser test:coverage
```
