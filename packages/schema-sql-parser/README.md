# schema-sql-parser

## Support DataType

- MySQL / MariaDB

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

- MSSQL

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

- Oracle

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

- PostgreSQL

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

- SQLite
  > blob
  > integer
  > numeric
  > real
  > text

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
