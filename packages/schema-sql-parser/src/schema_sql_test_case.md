# Schema SQL Test Case

## Support DataType

- MySQL

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

- Databricks

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

- MariaDB

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

- MSSQL

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

- Oracle

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

- PostgreSQL

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

- Snowflake

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

- SQLite

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

## Support Syntax

### Basics

```sql
CREATE TABLE a (
 b bigint
)
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "a",
      "comment": "",
      "columns": [
        {
          "name": "b",
          "dataType": "bigint",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
```

### Double Quote

```sql
CREATE TABLE "a" (
 "b" bigint
)
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "a",
      "comment": "",
      "columns": [
        {
          "name": "b",
          "dataType": "bigint",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
```

### Single Quote

```sql
CREATE TABLE 'a' (
 'b' bigint
)
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "a",
      "comment": "",
      "columns": [
        {
          "name": "b",
          "dataType": "bigint",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
```

### Backtick

```sql
CREATE TABLE `a` (
 `b` bigint
)
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "a",
      "comment": "",
      "columns": [
        {
          "name": "b",
          "dataType": "bigint",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
```

### database.table

```sql
CREATE TABLE test.a (
 b bigint
)
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "a",
      "comment": "",
      "columns": [
        {
          "name": "b",
          "dataType": "bigint",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
```

### [database].[table]

```sql
CREATE TABLE [test].[a] (
 b bigint
)
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "a",
      "comment": "",
      "columns": [
        {
          "name": "b",
          "dataType": "bigint",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
```

### Column Options

```sql
CREATE TABLE a (
 b varchar(255) NOT NULL DEFAULT 'c' COMMENT 'd' PRIMARY KEY AUTO_INCREMENT UNIQUE
)
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "a",
      "comment": "",
      "columns": [
        {
          "name": "b",
          "dataType": "varchar(255)",
          "default": "'c'",
          "comment": "d",
          "primaryKey": true,
          "autoIncrement": true,
          "unique": true,
          "nullable": false
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
```

### Column DEFAULT expressions

```sql
CREATE TABLE public.orders (
    id integer DEFAULT nextval('public.orders_id_seq'::regclass) NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    note character varying(200) DEFAULT NULL::character varying,
    created_at timestamp without time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
    ratio numeric(3,2) DEFAULT 0.5,
    code integer GENERATED BY DEFAULT AS IDENTITY,
    flag bit(1) DEFAULT B'0'::"bit",
    placed_at timestamp with time zone DEFAULT ('now'::text)::timestamp with time zone NOT NULL
);

CREATE TABLE [dbo].[Users] (
    [Id] uniqueidentifier NOT NULL DEFAULT (newid()),
    [Active] bit NOT NULL DEFAULT ((0)),
    [Created] datetime2(7) DEFAULT (getdate()) NOT NULL,
    [Label] nvarchar(20) DEFAULT (N'(none)'),
    [Tags] nvarchar(20) DEFAULT (N'a,b') NOT NULL
);

CREATE TABLE `events` (
  `id` binary(16) NOT NULL DEFAULT (uuid_to_bin(uuid())),
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'last change',
  `expires_at` datetime DEFAULT ((now() + interval 1 day))
);
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "orders",
      "comment": "",
      "columns": [
        {
          "name": "id",
          "dataType": "integer",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": true,
          "unique": false,
          "nullable": false
        },
        {
          "name": "status",
          "dataType": "character varying(20)",
          "default": "'draft'",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "note",
          "dataType": "character varying(200)",
          "default": "NULL",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "created_at",
          "dataType": "timestamp without time zone",
          "default": "now() AT TIME ZONE 'utc'::text",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "ratio",
          "dataType": "numeric(3,2)",
          "default": "0.5",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "code",
          "dataType": "integer",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": true,
          "unique": false,
          "nullable": true
        },
        {
          "name": "flag",
          "dataType": "bit(1)",
          "default": "B'0'",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "placed_at",
          "dataType": "timestamp with time zone",
          "default": "('now'::text)::timestamp with time zone",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "create.table",
      "name": "Users",
      "comment": "",
      "columns": [
        {
          "name": "Id",
          "dataType": "uniqueidentifier",
          "default": "newid()",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Active",
          "dataType": "bit",
          "default": "0",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Created",
          "dataType": "datetime2(7)",
          "default": "getdate()",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Label",
          "dataType": "nvarchar(20)",
          "default": "N'(none)'",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "Tags",
          "dataType": "nvarchar(20)",
          "default": "N'a,b'",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "create.table",
      "name": "events",
      "comment": "",
      "columns": [
        {
          "name": "id",
          "dataType": "binary(16)",
          "default": "uuid_to_bin(uuid())",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "updated_at",
          "dataType": "timestamp",
          "default": "CURRENT_TIMESTAMP",
          "comment": "last change",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "expires_at",
          "dataType": "datetime",
          "default": "now() + interval 1 day",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
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

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "a",
      "comment": "",
      "columns": [
        {
          "name": "b",
          "dataType": "varchar(255)",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "c",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "create.table",
      "name": "b",
      "comment": "",
      "columns": [
        {
          "name": "b",
          "dataType": "varchar(255)",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "c",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [{ "name": "PK_B", "columnNames": ["b", "c"] }],
      "foreignKeys": []
    }
  ]
}
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

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "a",
      "comment": "",
      "columns": [
        {
          "name": "b",
          "dataType": "varchar(255)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "c",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [
        {
          "name": "",
          "unique": true,
          "columns": [
            {
              "name": "b",
              "sort": "ASC"
            },
            {
              "name": "c",
              "sort": "ASC"
            }
          ]
        }
      ],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "create.table",
      "name": "b",
      "comment": "",
      "columns": [
        {
          "name": "b",
          "dataType": "varchar(255)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "c",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [
        {
          "name": "UC_B",
          "unique": true,
          "columns": [
            {
              "name": "b",
              "sort": "ASC"
            },
            {
              "name": "c",
              "sort": "ASC"
            }
          ]
        }
      ],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
```

### Column INDEX

```sql
CREATE TABLE a (
 b varchar(255),
 c int,
 INDEX IDX_A (b DESC, c ASC)
)
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "a",
      "comment": "",
      "columns": [
        {
          "name": "b",
          "dataType": "varchar(255)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "c",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [
        {
          "name": "IDX_A",
          "unique": false,
          "columns": [
            {
              "name": "b",
              "sort": "DESC"
            },
            {
              "name": "c",
              "sort": "ASC"
            }
          ]
        }
      ],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
```

### Column INDEX UNIQUE, SQL Server

```sql
CREATE TABLE [dbo].[t] (
 [a] int NOT NULL,
 [b] int NOT NULL,
 INDEX [ix_ab] UNIQUE NONCLUSTERED ([a] ASC, [b] DESC),
 INDEX [ix_b] UNIQUE ([b])
)
GO
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "t",
      "comment": "",
      "columns": [
        {
          "name": "a",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "b",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": true,
          "nullable": false
        }
      ],
      "indexes": [
        {
          "name": "ix_ab",
          "unique": true,
          "columns": [
            { "name": "a", "sort": "ASC" },
            { "name": "b", "sort": "DESC" }
          ]
        }
      ],
      "keys": [{ "name": "ix_b", "columnNames": ["b"] }],
      "foreignKeys": []
    }
  ]
}
```

### Column INDEX UNIQUE with a filter, SQL Server

```sql
CREATE TABLE [dbo].[t] (
 [a] int,
 [b] int,
 INDEX [uq_ab] UNIQUE NONCLUSTERED ([a] ASC, [b] ASC) WHERE ([a] IS NOT NULL AND [b] IS NOT NULL),
 INDEX [ix_b] UNIQUE ([b]) WHERE ([b] > 0)
)
GO
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "t",
      "comment": "",
      "columns": [
        {
          "name": "a",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "b",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [
        {
          "name": "uq_ab",
          "unique": true,
          "columns": [
            { "name": "a", "sort": "ASC" },
            { "name": "b", "sort": "ASC" }
          ]
        },
        {
          "name": "ix_b",
          "unique": false,
          "columns": [{ "name": "b", "sort": "ASC" }]
        }
      ],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
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

```json
{
  "statements": [
    {
      "columns": [
        {
          "autoIncrement": true,
          "comment": "",
          "dataType": "bigint",
          "default": "",
          "name": "id",
          "nullable": false,
          "primaryKey": true,
          "unique": false
        },
        {
          "autoIncrement": false,
          "comment": "",
          "dataType": "varchar(30)",
          "default": "",
          "name": "name",
          "nullable": false,
          "primaryKey": false,
          "unique": false
        },
        {
          "autoIncrement": false,
          "comment": "",
          "dataType": "varchar(30)",
          "default": "",
          "name": "email",
          "nullable": false,
          "primaryKey": false,
          "unique": true
        }
      ],
      "comment": "",
      "keys": [{ "name": "users_email_unique", "columnNames": ["email"] }],
      "foreignKeys": [],
      "indexes": [
        {
          "columns": [
            {
              "name": "name",
              "sort": "ASC"
            }
          ],
          "name": "test_name_index",
          "unique": false
        }
      ],
      "name": "users",
      "type": "create.table"
    }
  ]
}
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

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "a",
      "comment": "",
      "columns": [
        {
          "name": "b",
          "dataType": "varchar(255)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "c",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": [
        {
          "columnNames": ["b", "c"],
          "refTableName": "b",
          "refColumnNames": ["b", "c"],
          "onDelete": "",
          "onUpdate": ""
        }
      ]
    },
    {
      "type": "create.table",
      "name": "b",
      "comment": "",
      "columns": [
        {
          "name": "b",
          "dataType": "varchar(255)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "c",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": [
        {
          "columnNames": ["b", "c"],
          "refTableName": "a",
          "refColumnNames": ["b", "c"],
          "onDelete": "",
          "onUpdate": ""
        }
      ]
    }
  ]
}
```

### CREATE INDEX

```sql
CREATE INDEX IDX_A on A (a, b DESC)
CREATE UNIQUE INDEX IDX_B on B (a, b DESC)
```

```json
{
  "statements": [
    {
      "type": "create.index",
      "name": "IDX_A",
      "unique": false,
      "tableName": "A",
      "columns": [
        {
          "name": "a",
          "sort": "ASC"
        },
        {
          "name": "b",
          "sort": "DESC"
        }
      ]
    },
    {
      "type": "create.index",
      "name": "IDX_B",
      "unique": true,
      "tableName": "B",
      "columns": [
        {
          "name": "a",
          "sort": "ASC"
        },
        {
          "name": "b",
          "sort": "DESC"
        }
      ]
    }
  ]
}
```

### CREATE UNIQUE INDEX from dump tools

```sql
CREATE UNIQUE INDEX i_1 ON public.sp_region USING btree (code, name);
CREATE UNIQUE NONCLUSTERED INDEX [UQ_ab] ON [dbo].[t] ([a] ASC, [b] DESC) WITH (PAD_INDEX = OFF) ON [PRIMARY]
GO
CREATE UNIQUE INDEX "HR"."UQ_AB" ON "HR"."T" ("A", "B") TABLESPACE "USERS";
```

```json
{
  "statements": [
    {
      "type": "create.index",
      "name": "i_1",
      "unique": true,
      "tableName": "sp_region",
      "columns": [
        { "name": "code", "sort": "ASC" },
        { "name": "name", "sort": "ASC" }
      ]
    },
    {
      "type": "create.index",
      "name": "UQ_ab",
      "unique": true,
      "tableName": "t",
      "columns": [
        { "name": "a", "sort": "ASC" },
        { "name": "b", "sort": "DESC" }
      ]
    },
    {
      "type": "create.index",
      "name": "UQ_AB",
      "unique": true,
      "tableName": "T",
      "columns": [
        { "name": "A", "sort": "ASC" },
        { "name": "B", "sort": "ASC" }
      ]
    }
  ]
}
```

### CREATE UNIQUE INDEX key parts and partial indexes

```sql
CREATE UNIQUE INDEX uq_ab ON public.t USING btree (a, b DESC NULLS LAST);
CREATE UNIQUE INDEX uq_ba ON public.t USING btree (b text_pattern_ops, a COLLATE "C");
CREATE UNIQUE INDEX uq_live ON public.t USING btree (a, b) WHERE (deleted_at IS NULL);
CREATE UNIQUE NONCLUSTERED INDEX [uq_set] ON [dbo].[t] ([a] ASC, [b] ASC) WHERE ([a] IS NOT NULL AND [b] IS NOT NULL) WITH (PAD_INDEX = OFF) ON [PRIMARY]
GO
```

```json
{
  "statements": [
    {
      "type": "create.index",
      "name": "uq_ab",
      "unique": true,
      "tableName": "t",
      "columns": [
        { "name": "a", "sort": "ASC" },
        { "name": "b", "sort": "DESC" }
      ]
    },
    {
      "type": "create.index",
      "name": "uq_ba",
      "unique": true,
      "tableName": "t",
      "columns": [
        { "name": "b", "sort": "ASC" },
        { "name": "a", "sort": "ASC" }
      ]
    },
    {
      "type": "create.index",
      "name": "uq_live",
      "unique": false,
      "tableName": "t",
      "columns": [
        { "name": "a", "sort": "ASC" },
        { "name": "b", "sort": "ASC" }
      ]
    },
    {
      "type": "create.index",
      "name": "uq_set",
      "unique": true,
      "tableName": "t",
      "columns": [
        { "name": "a", "sort": "ASC" },
        { "name": "b", "sort": "ASC" }
      ]
    }
  ]
}
```

### Alter Table Add PRIMARY KEY

```sql
ALTER TABLE Persons ADD PRIMARY KEY (ID)
ALTER TABLE Persons ADD CONSTRAINT PK_Person PRIMARY KEY (ID,LastName)
```

```json
{
  "statements": [
    {
      "type": "alter.table.add.primaryKey",
      "name": "Persons",
      "constraintName": "",
      "usingIndexName": "",
      "columnNames": ["ID"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "Persons",
      "constraintName": "PK_Person",
      "usingIndexName": "",
      "columnNames": ["ID", "LastName"]
    }
  ]
}
```

### Alter database.Table Add PRIMARY KEY

```sql
ALTER TABLE "public".Persons ADD PRIMARY KEY (ID)
ALTER TABLE "public".Persons ADD CONSTRAINT PK_Person PRIMARY KEY (ID,LastName)
```

```json
{
  "statements": [
    {
      "type": "alter.table.add.primaryKey",
      "name": "Persons",
      "constraintName": "",
      "usingIndexName": "",
      "columnNames": ["ID"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "Persons",
      "constraintName": "PK_Person",
      "usingIndexName": "",
      "columnNames": ["ID", "LastName"]
    }
  ]
}
```

### Alter Table Add FOREIGN KEY

```sql
ALTER TABLE Orders
ADD FOREIGN KEY (PersonID) REFERENCES Persons(PersonID)

ALTER TABLE Orders
ADD CONSTRAINT FK_PersonOrder
FOREIGN KEY (PersonID) REFERENCES Persons(PersonID)
```

```json
{
  "statements": [
    {
      "type": "alter.table.add.foreignKey",
      "name": "Orders",
      "columnNames": ["PersonID"],
      "refTableName": "Persons",
      "refColumnNames": ["PersonID"],
      "onDelete": "",
      "onUpdate": ""
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "Orders",
      "columnNames": ["PersonID"],
      "refTableName": "Persons",
      "refColumnNames": ["PersonID"],
      "onDelete": "",
      "onUpdate": ""
    }
  ]
}
```

### Alter database.Table Add FOREIGN KEY

```sql
ALTER TABLE "public".Orders
ADD FOREIGN KEY (PersonID) REFERENCES "public".Persons(PersonID)

ALTER TABLE "public".Orders
ADD CONSTRAINT FK_PersonOrder
FOREIGN KEY (PersonID) REFERENCES "public".Persons(PersonID)
```

```json
{
  "statements": [
    {
      "type": "alter.table.add.foreignKey",
      "name": "Orders",
      "columnNames": ["PersonID"],
      "refTableName": "Persons",
      "refColumnNames": ["PersonID"],
      "onDelete": "",
      "onUpdate": ""
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "Orders",
      "columnNames": ["PersonID"],
      "refTableName": "Persons",
      "refColumnNames": ["PersonID"],
      "onDelete": "",
      "onUpdate": ""
    }
  ]
}
```

### Alter Table Add UNIQUE

```sql
ALTER TABLE Persons ADD UNIQUE (ID)
ALTER TABLE Persons ADD CONSTRAINT UC_Person UNIQUE (ID,LastName)
```

```json
{
  "statements": [
    {
      "type": "alter.table.add.unique",
      "name": "Persons",
      "constraintName": "",
      "usingIndexName": "",
      "columns": [{ "name": "ID", "sort": "ASC" }]
    },
    {
      "type": "alter.table.add.unique",
      "name": "Persons",
      "constraintName": "UC_Person",
      "usingIndexName": "",
      "columns": [
        { "name": "ID", "sort": "ASC" },
        { "name": "LastName", "sort": "ASC" }
      ]
    }
  ]
}
```

### Alter database.Table Add UNIQUE

```sql
ALTER TABLE "public".Persons ADD UNIQUE (ID)
ALTER TABLE "public".Persons ADD CONSTRAINT UC_Person UNIQUE (ID,LastName)
```

```json
{
  "statements": [
    {
      "type": "alter.table.add.unique",
      "name": "Persons",
      "constraintName": "",
      "usingIndexName": "",
      "columns": [{ "name": "ID", "sort": "ASC" }]
    },
    {
      "type": "alter.table.add.unique",
      "name": "Persons",
      "constraintName": "UC_Person",
      "usingIndexName": "",
      "columns": [
        { "name": "ID", "sort": "ASC" },
        { "name": "LastName", "sort": "ASC" }
      ]
    }
  ]
}
```

### Alter Table Add UNIQUE KEY

```sql
ALTER TABLE users ADD UNIQUE KEY uq_email (email);
ALTER TABLE users ADD CONSTRAINT sym UNIQUE INDEX uq_ab (a, b DESC);
```

```json
{
  "statements": [
    {
      "type": "alter.table.add.unique",
      "name": "users",
      "constraintName": "uq_email",
      "usingIndexName": "",
      "columns": [{ "name": "email", "sort": "ASC" }]
    },
    {
      "type": "alter.table.add.unique",
      "name": "users",
      "constraintName": "uq_ab",
      "usingIndexName": "",
      "columns": [
        { "name": "a", "sort": "ASC" },
        { "name": "b", "sort": "DESC" }
      ]
    }
  ]
}
```

### Alter Table Add several keys

```sql
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tenant_login` (`tenant`,`login`),
  ADD UNIQUE KEY `uq_email` (`email`),
  ADD KEY `idx_tenant` (`tenant`);
ALTER TABLE users ADD CONSTRAINT UNIQUE (a, b), ADD CONSTRAINT fk_x FOREIGN KEY (x) REFERENCES y (id);
```

```json
{
  "statements": [
    {
      "type": "alter.table.add.primaryKey",
      "name": "users",
      "constraintName": "",
      "usingIndexName": "",
      "columnNames": ["id"]
    },
    {
      "type": "alter.table.add.unique",
      "name": "users",
      "constraintName": "uq_tenant_login",
      "usingIndexName": "",
      "columns": [
        { "name": "tenant", "sort": "ASC" },
        { "name": "login", "sort": "ASC" }
      ]
    },
    {
      "type": "alter.table.add.unique",
      "name": "users",
      "constraintName": "uq_email",
      "usingIndexName": "",
      "columns": [{ "name": "email", "sort": "ASC" }]
    },
    {
      "type": "alter.table.add.unique",
      "name": "users",
      "constraintName": "",
      "usingIndexName": "",
      "columns": [
        { "name": "a", "sort": "ASC" },
        { "name": "b", "sort": "ASC" }
      ]
    }
  ]
}
```

### Alter Table Add UNIQUE USING INDEX, Oracle

```sql
CREATE UNIQUE INDEX "HR"."UQ_T_AB_IX" ON "HR"."T" ("A", "B") TABLESPACE "USERS";
ALTER TABLE "HR"."T" ADD CONSTRAINT "UQ_T_AB" UNIQUE ("A", "B") USING INDEX "HR"."UQ_T_AB_IX" ENABLE;
ALTER TABLE "HR"."T" ADD CONSTRAINT "UQ_T_CD" UNIQUE ("C", "D")
  USING INDEX PCTFREE 10 INITRANS 2 MAXTRANS 255 TABLESPACE "USERS" ENABLE;
```

```json
{
  "statements": [
    {
      "type": "create.index",
      "name": "UQ_T_AB_IX",
      "unique": true,
      "tableName": "T",
      "columns": [
        { "name": "A", "sort": "ASC" },
        { "name": "B", "sort": "ASC" }
      ]
    },
    {
      "type": "alter.table.add.unique",
      "name": "T",
      "constraintName": "UQ_T_AB",
      "usingIndexName": "UQ_T_AB_IX",
      "columns": [
        { "name": "A", "sort": "ASC" },
        { "name": "B", "sort": "ASC" }
      ]
    },
    {
      "type": "alter.table.add.unique",
      "name": "T",
      "constraintName": "UQ_T_CD",
      "usingIndexName": "",
      "columns": [
        { "name": "C", "sort": "ASC" },
        { "name": "D", "sort": "ASC" }
      ]
    }
  ]
}
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

```json
{
  "statements": [
    {
      "type": "alter.table.add.primaryKey",
      "name": "Persons",
      "constraintName": "",
      "usingIndexName": "",
      "columnNames": ["ID"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "Persons",
      "constraintName": "PK_Person",
      "usingIndexName": "",
      "columnNames": ["ID", "LastName"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "Persons",
      "constraintName": "",
      "usingIndexName": "",
      "columnNames": ["ID"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "Persons",
      "constraintName": "PK_Person",
      "usingIndexName": "",
      "columnNames": ["ID", "LastName"]
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "Orders",
      "columnNames": ["PersonID"],
      "refTableName": "Persons",
      "refColumnNames": ["PersonID"],
      "onDelete": "",
      "onUpdate": ""
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "Orders",
      "columnNames": ["PersonID"],
      "refTableName": "Persons",
      "refColumnNames": ["PersonID"],
      "onDelete": "",
      "onUpdate": ""
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "Orders",
      "columnNames": ["PersonID"],
      "refTableName": "Persons",
      "refColumnNames": ["PersonID"],
      "onDelete": "",
      "onUpdate": ""
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "Orders",
      "columnNames": ["PersonID"],
      "refTableName": "Persons",
      "refColumnNames": ["PersonID"],
      "onDelete": "",
      "onUpdate": ""
    },
    {
      "type": "alter.table.add.unique",
      "name": "Persons",
      "constraintName": "",
      "usingIndexName": "",
      "columns": [{ "name": "ID", "sort": "ASC" }]
    },
    {
      "type": "alter.table.add.unique",
      "name": "Persons",
      "constraintName": "UC_Person",
      "usingIndexName": "",
      "columns": [
        { "name": "ID", "sort": "ASC" },
        { "name": "LastName", "sort": "ASC" }
      ]
    },
    {
      "type": "alter.table.add.unique",
      "name": "Persons",
      "constraintName": "",
      "usingIndexName": "",
      "columns": [{ "name": "ID", "sort": "ASC" }]
    },
    {
      "type": "alter.table.add.unique",
      "name": "Persons",
      "constraintName": "UC_Person",
      "usingIndexName": "",
      "columns": [
        { "name": "ID", "sort": "ASC" },
        { "name": "LastName", "sort": "ASC" }
      ]
    }
  ]
}
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

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "role",
      "comment": "role",
      "columns": [
        {
          "name": "id",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": true,
          "unique": false,
          "nullable": false
        },
        {
          "name": "key",
          "dataType": "varchar(30)",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "description",
          "dataType": "text",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
```

### Table COMMENT with parentheses

```sql
CREATE TABLE `test` (
  `id` int NOT NULL COMMENT '(a)b',
  `name` varchar(30)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='(test)bug here!!';
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "test",
      "comment": "(test)bug here!!",
      "columns": [
        {
          "name": "id",
          "dataType": "int",
          "default": "",
          "comment": "(a)b",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "name",
          "dataType": "varchar(30)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
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

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "users",
      "comment": "",
      "columns": [
        {
          "name": "id",
          "dataType": "INT",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "email",
          "dataType": "VARCHAR(255)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "comment.on.table",
      "name": "users",
      "comment": "user table"
    },
    {
      "type": "comment.on.column",
      "tableName": "users",
      "columnName": "id",
      "comment": "user id"
    },
    {
      "type": "comment.on.column",
      "tableName": "users",
      "columnName": "email",
      "comment": "email address"
    }
  ]
}
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

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "users",
      "comment": "",
      "columns": [
        {
          "name": "id",
          "dataType": "INTEGER",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "email",
          "dataType": "TEXT",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
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

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "events",
      "comment": "",
      "columns": [
        {
          "name": "event_id",
          "dataType": "BIGINT",
          "default": "",
          "comment": "event id",
          "primaryKey": true,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "user_id",
          "dataType": "STRING",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "occurred_at",
          "dataType": "TIMESTAMP_NTZ",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "tags",
          "dataType": "ARRAY<STRING>",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "props",
          "dataType": "MAP<STRING, STRING>",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [{ "name": "pk_events", "columnNames": ["event_id"] }],
      "foreignKeys": []
    }
  ]
}
```
### Snowflake CREATE OR REPLACE TABLE

```sql
create or replace TABLE MYDATABASE.PUBLIC.SALESORDERS cluster by LINEAR(ORDER_DATE)(
	ORDER_ID NUMBER(38,0) NOT NULL autoincrement start 1 increment 1,
	ORDER_DATE DATE NOT NULL,
	DESCRIPTION VARCHAR(16777216) COMMENT 'free text',
	PROFILE OBJECT(city VARCHAR, zip NUMBER),
	TAGS ARRAY(VARCHAR),
	CREATED_AT TIMESTAMP_TZ(9),
	SP_ID NUMBER(38,0) NOT NULL,
	unique (SP_ID),
	constraint PK_ORDER_ID primary key (ORDER_ID) not enforced rely,
	constraint FK_SP_ID foreign key (SP_ID) references MYDATABASE.PUBLIC.SALESPEOPLE(SP_ID) not enforced
)
COMMENT = 'sales orders'
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "SALESORDERS",
      "comment": "sales orders",
      "columns": [
        {
          "name": "ORDER_ID",
          "dataType": "NUMBER(38,0)",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": true,
          "unique": false,
          "nullable": false
        },
        {
          "name": "ORDER_DATE",
          "dataType": "DATE",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "DESCRIPTION",
          "dataType": "VARCHAR(16777216)",
          "default": "",
          "comment": "free text",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "PROFILE",
          "dataType": "OBJECT(city VARCHAR,zip NUMBER)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "TAGS",
          "dataType": "ARRAY(VARCHAR)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "CREATED_AT",
          "dataType": "TIMESTAMP_TZ(9)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "SP_ID",
          "dataType": "NUMBER(38,0)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": true,
          "nullable": false
        }
      ],
      "indexes": [],
      "keys": [{ "name": "PK_ORDER_ID", "columnNames": ["ORDER_ID"] }],
      "foreignKeys": [
        {
          "columnNames": [
            "SP_ID"
          ],
          "refTableName": "SALESPEOPLE",
          "refColumnNames": [
            "SP_ID"
          ],
          "onDelete": "",
          "onUpdate": ""
        }
      ]
    }
  ]
}
```

### Snowflake transient table and a fully qualified ALTER

```sql
CREATE OR REPLACE TRANSIENT TABLE analytics.dbt_dev.users (
  user_id INT IDENTITY(1,1),
  username VARCHAR(50) NOT NULL
);

ALTER TABLE analytics.dbt_dev.users ADD CONSTRAINT PK_USERS PRIMARY KEY (user_id);

ALTER TABLE analytics.dbt_dev.orders ADD FOREIGN KEY (user_id) REFERENCES analytics.dbt_dev.users (user_id);
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "users",
      "comment": "",
      "columns": [
        {
          "name": "user_id",
          "dataType": "INT",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": true,
          "unique": false,
          "nullable": true
        },
        {
          "name": "username",
          "dataType": "VARCHAR(50)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "users",
      "constraintName": "PK_USERS",
      "usingIndexName": "",
      "columnNames": [
        "user_id"
      ]
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "orders",
      "columnNames": [
        "user_id"
      ],
      "refTableName": "users",
      "refColumnNames": [
        "user_id"
      ],
      "onDelete": "",
      "onUpdate": ""
    }
  ]
}
```

### Referential actions

```sql
CREATE TABLE orders (
  id INT PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  shop_id INT,
  FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE items ADD CONSTRAINT fk_items_orders FOREIGN KEY (order_id) REFERENCES orders (id) MATCH SIMPLE ON UPDATE NO ACTION ON DELETE RESTRICT;
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "orders",
      "comment": "",
      "columns": [
        {
          "name": "id",
          "dataType": "INT",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "user_id",
          "dataType": "INT",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "shop_id",
          "dataType": "INT",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": [
        {
          "columnNames": ["user_id"],
          "refTableName": "users",
          "refColumnNames": ["id"],
          "onDelete": "CASCADE",
          "onUpdate": ""
        },
        {
          "columnNames": ["shop_id"],
          "refTableName": "shops",
          "refColumnNames": ["id"],
          "onDelete": "SET NULL",
          "onUpdate": "CASCADE"
        }
      ]
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "items",
      "columnNames": ["order_id"],
      "refTableName": "orders",
      "refColumnNames": ["id"],
      "onDelete": "RESTRICT",
      "onUpdate": "NO ACTION"
    }
  ]
}
```

### SQL Server WITH CHECK ADD CONSTRAINT

```sql
CREATE TABLE [dbo].[b](
	[id] [int] NOT NULL,
	[a_id] [int] NULL
) ON [PRIMARY]
GO
ALTER TABLE [dbo].[b]  WITH CHECK ADD  CONSTRAINT [FK_b_a] FOREIGN KEY([a_id])
REFERENCES [dbo].[a] ([id])
ON UPDATE SET NULL
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[b] CHECK CONSTRAINT [FK_b_a]
GO
ALTER TABLE [dbo].[b] WITH NOCHECK ADD CONSTRAINT [UQ_b] UNIQUE ([a_id])
GO
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "b",
      "comment": "",
      "columns": [
        {
          "name": "id",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "a_id",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "b",
      "columnNames": ["a_id"],
      "refTableName": "a",
      "refColumnNames": ["id"],
      "onDelete": "CASCADE",
      "onUpdate": "SET NULL"
    },
    {
      "type": "alter.table.add.unique",
      "name": "b",
      "constraintName": "UQ_b",
      "usingIndexName": "",
      "columns": [{ "name": "a_id", "sort": "ASC" }]
    }
  ]
}
```

### SQL Server ALTER TABLE ADD PRIMARY KEY CLUSTERED

Script Key as CREATE output of SMO 17.100.0.0 (SQL Server Management Objects, the scripting
engine of SSMS, from the SqlServer PowerShell module 22.4.5.1) against SQL Server 2022
16.0.4295.3: `Index.Script()` with Object Explorer's scripting defaults for each primary key of
one database, then for a key whose name SQL Server generated, which SMO writes without
`CONSTRAINT`. SMO, run on Linux, wrote ASCII with LF line endings, kept here byte for byte, the
space after `CLUSTERED` included; the harness that ran it put GO and a blank line after each
batch, as SSMS does in a query window. Generate Scripts and Script Table as CREATE declared the
same keys inside `CREATE TABLE` instead.

```sql
USE [p2r_pk]
GO

/****** Object:  Index [PK_Roles]    Script Date: 10/4/2026 12:21:50 PM ******/
ALTER TABLE [dbo].[Roles] ADD  CONSTRAINT [PK_Roles] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

USE [p2r_pk]
GO

/****** Object:  Index [PK_UserRoles]    Script Date: 10/4/2026 12:21:50 PM ******/
ALTER TABLE [dbo].[UserRoles] ADD  CONSTRAINT [PK_UserRoles] PRIMARY KEY NONCLUSTERED 
(
	[UserId] ASC,
	[RoleId] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

USE [p2r_pk]
GO

/****** Object:  Index [PK_Users]    Script Date: 10/4/2026 12:21:50 PM ******/
ALTER TABLE [dbo].[Users] ADD  CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

USE [p2r_defaults]
GO

/****** Object:  Index [PK__Drafts__3214EC072E0F6FD4]    Script Date: 10/4/2026 12:18:22 PM ******/
ALTER TABLE [dbo].[Drafts] ADD PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
```

```json
{
  "statements": [
    {
      "type": "alter.table.add.primaryKey",
      "name": "Roles",
      "constraintName": "PK_Roles",
      "usingIndexName": "",
      "columnNames": ["Id"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "UserRoles",
      "constraintName": "PK_UserRoles",
      "usingIndexName": "",
      "columnNames": ["UserId", "RoleId"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "Users",
      "constraintName": "PK_Users",
      "usingIndexName": "",
      "columnNames": ["Id"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "Drafts",
      "constraintName": "",
      "usingIndexName": "",
      "columnNames": ["Id"]
    }
  ]
}
```

### SQL Server ALTER TABLE ADD DEFAULT FOR

Generate Scripts output of SMO 17.100.0.0 (SQL Server Management Objects, the scripting engine
of SSMS, from the SqlServer PowerShell module 22.4.5.1) against SQL Server 2022 16.0.4295.3:
`SqlScriptPublishModel`, the wizard's own engine, with the wizard's default options, for every
table of one database. SMO writes no default inside `CREATE TABLE`: each one follows all the
tables as an `ALTER TABLE ... ADD` of its own, with `CONSTRAINT` for a default the DDL named
(`Orders`) and without it for one SQL Server named (`Drafts`). Then Script Constraint as CREATE
(`DefaultConstraint.Script()` with Object Explorer's scripting defaults) for the four defaults of
a table in another database whose name holds a space. The wizard wrote UTF-16LE with a BOM, here
UTF-8; SMO, run on Linux, wrote LF line endings; every other byte is kept, the two spaces after
`ADD` and before `DEFAULT` included. The harness that ran Script Constraint as CREATE put GO and
a blank line after each batch, as SSMS does in a query window, and a blank line parts the two.

```sql
USE [p2r_defaults]
GO
/****** Object:  Table [dbo].[Drafts]    Script Date: 10/4/2026 12:18:21 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Drafts](
	[Id] [int] NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[Qty] [int] NOT NULL,
	[Created] [datetime2](7) NULL,
	[Label] [nvarchar](20) NULL,
PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Orders]    Script Date: 10/4/2026 12:18:21 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Orders](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[Qty] [int] NOT NULL,
	[Created] [datetime2](7) NOT NULL,
	[Number] [int] NOT NULL,
	[Label] [nvarchar](20) NULL,
 CONSTRAINT [PK_Orders] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
ALTER TABLE [dbo].[Drafts] ADD  DEFAULT ('draft') FOR [Status]
GO
ALTER TABLE [dbo].[Drafts] ADD  DEFAULT ((0)) FOR [Qty]
GO
ALTER TABLE [dbo].[Drafts] ADD  DEFAULT (getdate()) FOR [Created]
GO
ALTER TABLE [dbo].[Drafts] ADD  DEFAULT (N'(none)') FOR [Label]
GO
ALTER TABLE [dbo].[Orders] ADD  CONSTRAINT [DF_Orders_Status]  DEFAULT ('draft') FOR [Status]
GO
ALTER TABLE [dbo].[Orders] ADD  CONSTRAINT [DF_Orders_Qty]  DEFAULT ((0)) FOR [Qty]
GO
ALTER TABLE [dbo].[Orders] ADD  CONSTRAINT [DF_Orders_Created]  DEFAULT (getdate()) FOR [Created]
GO
ALTER TABLE [dbo].[Orders] ADD  CONSTRAINT [DF_Orders_Number]  DEFAULT (NEXT VALUE FOR [dbo].[OrderSeq]) FOR [Number]
GO
ALTER TABLE [dbo].[Orders] ADD  CONSTRAINT [DF_Orders_Label]  DEFAULT (N'(none)') FOR [Label]
GO

USE [p2r_edge]
GO

ALTER TABLE [dbo].[Order Lines] ADD  CONSTRAINT [DF_Order_Lines_Price]  DEFAULT ((1.50)) FOR [Unit Price]
GO

USE [p2r_edge]
GO

ALTER TABLE [dbo].[Order Lines] ADD  CONSTRAINT [DF_Order_Lines_Folder]  DEFAULT (N'C:\') FOR [Folder]
GO

USE [p2r_edge]
GO

ALTER TABLE [dbo].[Order Lines] ADD  CONSTRAINT [DF_Order_Lines_Token]  DEFAULT (newid()) FOR [Token]
GO

USE [p2r_edge]
GO

ALTER TABLE [dbo].[Order Lines] ADD  CONSTRAINT [DF_Order_Lines_Active]  DEFAULT ((1)) FOR [Active]
GO
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "Drafts",
      "comment": "",
      "columns": [
        {
          "name": "Id",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Status",
          "dataType": "nvarchar(20)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Qty",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Created",
          "dataType": "datetime2(7)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "Label",
          "dataType": "nvarchar(20)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "create.table",
      "name": "Orders",
      "comment": "",
      "columns": [
        {
          "name": "Id",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": true,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Status",
          "dataType": "nvarchar(20)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Qty",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Created",
          "dataType": "datetime2(7)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Number",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Label",
          "dataType": "nvarchar(20)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [{ "name": "PK_Orders", "columnNames": ["Id"] }],
      "foreignKeys": []
    },
    {
      "type": "alter.table.add.default",
      "name": "Drafts",
      "columnName": "Status",
      "default": "'draft'"
    },
    {
      "type": "alter.table.add.default",
      "name": "Drafts",
      "columnName": "Qty",
      "default": "0"
    },
    {
      "type": "alter.table.add.default",
      "name": "Drafts",
      "columnName": "Created",
      "default": "getdate()"
    },
    {
      "type": "alter.table.add.default",
      "name": "Drafts",
      "columnName": "Label",
      "default": "N'(none)'"
    },
    {
      "type": "alter.table.add.default",
      "name": "Orders",
      "columnName": "Status",
      "default": "'draft'"
    },
    {
      "type": "alter.table.add.default",
      "name": "Orders",
      "columnName": "Qty",
      "default": "0"
    },
    {
      "type": "alter.table.add.default",
      "name": "Orders",
      "columnName": "Created",
      "default": "getdate()"
    },
    {
      "type": "alter.table.add.default",
      "name": "Orders",
      "columnName": "Number",
      "default": "NEXT VALUE FOR [dbo].[OrderSeq]"
    },
    {
      "type": "alter.table.add.default",
      "name": "Orders",
      "columnName": "Label",
      "default": "N'(none)'"
    },
    {
      "type": "alter.table.add.default",
      "name": "Order Lines",
      "columnName": "Unit Price",
      "default": "1.50"
    },
    {
      "type": "alter.table.add.default",
      "name": "Order Lines",
      "columnName": "Folder",
      "default": "N'C:\\'"
    },
    {
      "type": "alter.table.add.default",
      "name": "Order Lines",
      "columnName": "Token",
      "default": "newid()"
    },
    {
      "type": "alter.table.add.default",
      "name": "Order Lines",
      "columnName": "Active",
      "default": "1"
    }
  ]
}
```

### SQL Server sp_addextendedproperty MS_Description

Output of SMO 17.100.0.0 (SQL Server Management Objects, the scripting engine of SSMS, from the
SqlServer PowerShell module 22.4.5.1) against SQL Server 2022 16.0.4295.3: `Scripter.EnumScript`
with Object Explorer's scripting defaults over the schema, tables and view of one database, the
text Generate Scripts writes for those objects when it scripts the whole database. SMO writes
each MS_Description after all the objects, with named arguments and a table's columns before the
table, for tables in `dbo` and in `sales` and for the view and one of its columns; those of the
view give no comment, nor does the `Caption` property. SMO wrote UTF-16LE with a BOM, here UTF-8;
run on Linux, it wrote LF line endings; every other byte is kept, the space before the comma
after each `@value` included.

```sql
USE [p2r_comments]
GO
/****** Object:  Schema [sales]    Script Date: 10/4/2026 12:18:23 PM ******/
CREATE SCHEMA [sales]
GO
/****** Object:  Table [dbo].[Customers]    Script Date: 10/4/2026 12:18:23 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Customers](
	[Id] [int] NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[Email] [nvarchar](200) NULL,
 CONSTRAINT [PK_Customers] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  View [dbo].[CustomerNames]    Script Date: 10/4/2026 12:18:23 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [dbo].[CustomerNames] AS SELECT [Id], [Name] FROM [dbo].[Customers]
GO
/****** Object:  Table [sales].[Invoices]    Script Date: 10/4/2026 12:18:23 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [sales].[Invoices](
	[Id] [int] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[Total] [decimal](10, 2) NOT NULL,
 CONSTRAINT [PK_Invoices] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Customer id' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'Customers', @level2type=N'COLUMN',@level2name=N'Id'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Customer''s full name' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'Customers', @level2type=N'COLUMN',@level2name=N'Name'
GO
EXEC sys.sp_addextendedproperty @name=N'Caption', @value=N'Not a description' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'Customers', @level2type=N'COLUMN',@level2name=N'Email'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'People who buy' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'Customers'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Amount in EUR (€), tax included' , @level0type=N'SCHEMA',@level0name=N'sales', @level1type=N'TABLE',@level1name=N'Invoices', @level2type=N'COLUMN',@level2name=N'Total'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Billed invoices' , @level0type=N'SCHEMA',@level0name=N'sales', @level1type=N'TABLE',@level1name=N'Invoices'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'View column' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'VIEW',@level1name=N'CustomerNames', @level2type=N'COLUMN',@level2name=N'Name'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Names only' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'VIEW',@level1name=N'CustomerNames'
GO
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "Customers",
      "comment": "",
      "columns": [
        {
          "name": "Id",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Name",
          "dataType": "nvarchar(100)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Email",
          "dataType": "nvarchar(200)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [
        {
          "name": "PK_Customers",
          "columnNames": [
            "Id"
          ]
        }
      ],
      "foreignKeys": []
    },
    {
      "type": "create.table",
      "name": "Invoices",
      "comment": "",
      "columns": [
        {
          "name": "Id",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "CustomerId",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Total",
          "dataType": "decimal(10,2)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        }
      ],
      "indexes": [],
      "keys": [
        {
          "name": "PK_Invoices",
          "columnNames": [
            "Id"
          ]
        }
      ],
      "foreignKeys": []
    },
    {
      "type": "comment.on.column",
      "tableName": "Customers",
      "columnName": "Id",
      "comment": "Customer id"
    },
    {
      "type": "comment.on.column",
      "tableName": "Customers",
      "columnName": "Name",
      "comment": "Customer's full name"
    },
    {
      "type": "comment.on.table",
      "name": "Customers",
      "comment": "People who buy"
    },
    {
      "type": "comment.on.column",
      "tableName": "Invoices",
      "columnName": "Total",
      "comment": "Amount in EUR (€), tax included"
    },
    {
      "type": "comment.on.table",
      "name": "Invoices",
      "comment": "Billed invoices"
    }
  ]
}
```

### SQL Server sp_addextendedproperty by position

The editor's MSSQL export has written each comment by position, level 0 as `'user', dbo`, a form
SMO never writes. `MS_DiagramPane1`, which SSMS's view designer keeps on a view, is no
description, and its value, cut short here, holds brackets.

```sql
EXECUTE sys.sp_addextendedproperty 'MS_Description',
  'Order''s header', 'user', dbo, 'table', 'Orders'
GO

EXECUTE sys.sp_addextendedproperty 'MS_Description',
  'order id', 'user', dbo, 'table', 'Orders', 'column', 'Id'
GO

EXEC sys.sp_addextendedproperty @name=N'MS_DiagramPane1', @value=N'[0E232FF0-B466-11cf-A24F-00AA00A3EFFF, 1.00]' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'VIEW',@level1name=N'OrderView'
GO
```

```json
{
  "statements": [
    {
      "type": "comment.on.table",
      "name": "Orders",
      "comment": "Order's header"
    },
    {
      "type": "comment.on.column",
      "tableName": "Orders",
      "columnName": "Id",
      "comment": "order id"
    }
  ]
}
```

### SQL Server Generate Scripts of a whole database

Generate Scripts output of SMO 17.100.0.0 (SQL Server Management Objects, the scripting engine
of SSMS, from the SqlServer PowerShell module 22.4.5.1) against SQL Server 2022 16.0.4295.3:
`SqlScriptPublishModel`, the wizard's own engine, with the wizard's default options, scripting
the entire database and all its objects. Around the tables it writes `CREATE DATABASE` with
Linux file paths, 34 `ALTER DATABASE ... SET`, a schema, a sequence and a view, none of which the
parser reads, nor the view's MS_Description. Each primary and unique key stays inside its
`CREATE TABLE`; the indexes, defaults, foreign keys and comments follow all the tables. The
wizard wrote UTF-16LE with a BOM, here UTF-8; SMO, run on Linux, wrote LF line endings; every
other byte is kept.

```sql
USE [master]
GO
/****** Object:  Database [p2r_full]    Script Date: 10/4/2026 12:18:23 PM ******/
CREATE DATABASE [p2r_full]
 CONTAINMENT = NONE
 ON  PRIMARY 
( NAME = N'p2r_full', FILENAME = N'/var/opt/mssql/data/p2r_full.mdf' , SIZE = 8192KB , MAXSIZE = UNLIMITED, FILEGROWTH = 65536KB )
 LOG ON 
( NAME = N'p2r_full_log', FILENAME = N'/var/opt/mssql/data/p2r_full_log.ldf' , SIZE = 8192KB , MAXSIZE = 2048GB , FILEGROWTH = 65536KB )
 WITH CATALOG_COLLATION = DATABASE_DEFAULT, LEDGER = OFF
GO
ALTER DATABASE [p2r_full] SET COMPATIBILITY_LEVEL = 160
GO
IF (1 = FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'))
begin
EXEC [p2r_full].[dbo].[sp_fulltext_database] @action = 'enable'
end
GO
ALTER DATABASE [p2r_full] SET ANSI_NULL_DEFAULT OFF 
GO
ALTER DATABASE [p2r_full] SET ANSI_NULLS OFF 
GO
ALTER DATABASE [p2r_full] SET ANSI_PADDING OFF 
GO
ALTER DATABASE [p2r_full] SET ANSI_WARNINGS OFF 
GO
ALTER DATABASE [p2r_full] SET ARITHABORT OFF 
GO
ALTER DATABASE [p2r_full] SET AUTO_CLOSE OFF 
GO
ALTER DATABASE [p2r_full] SET AUTO_SHRINK OFF 
GO
ALTER DATABASE [p2r_full] SET AUTO_UPDATE_STATISTICS ON 
GO
ALTER DATABASE [p2r_full] SET CURSOR_CLOSE_ON_COMMIT OFF 
GO
ALTER DATABASE [p2r_full] SET CURSOR_DEFAULT  GLOBAL 
GO
ALTER DATABASE [p2r_full] SET CONCAT_NULL_YIELDS_NULL OFF 
GO
ALTER DATABASE [p2r_full] SET NUMERIC_ROUNDABORT OFF 
GO
ALTER DATABASE [p2r_full] SET QUOTED_IDENTIFIER OFF 
GO
ALTER DATABASE [p2r_full] SET RECURSIVE_TRIGGERS OFF 
GO
ALTER DATABASE [p2r_full] SET  ENABLE_BROKER 
GO
ALTER DATABASE [p2r_full] SET AUTO_UPDATE_STATISTICS_ASYNC OFF 
GO
ALTER DATABASE [p2r_full] SET DATE_CORRELATION_OPTIMIZATION OFF 
GO
ALTER DATABASE [p2r_full] SET TRUSTWORTHY OFF 
GO
ALTER DATABASE [p2r_full] SET ALLOW_SNAPSHOT_ISOLATION OFF 
GO
ALTER DATABASE [p2r_full] SET PARAMETERIZATION SIMPLE 
GO
ALTER DATABASE [p2r_full] SET READ_COMMITTED_SNAPSHOT OFF 
GO
ALTER DATABASE [p2r_full] SET HONOR_BROKER_PRIORITY OFF 
GO
ALTER DATABASE [p2r_full] SET RECOVERY FULL 
GO
ALTER DATABASE [p2r_full] SET  MULTI_USER 
GO
ALTER DATABASE [p2r_full] SET PAGE_VERIFY CHECKSUM  
GO
ALTER DATABASE [p2r_full] SET DB_CHAINING OFF 
GO
ALTER DATABASE [p2r_full] SET FILESTREAM( NON_TRANSACTED_ACCESS = OFF ) 
GO
ALTER DATABASE [p2r_full] SET TARGET_RECOVERY_TIME = 60 SECONDS 
GO
ALTER DATABASE [p2r_full] SET DELAYED_DURABILITY = DISABLED 
GO
ALTER DATABASE [p2r_full] SET ACCELERATED_DATABASE_RECOVERY = OFF  
GO
EXEC sys.sp_db_vardecimal_storage_format N'p2r_full', N'ON'
GO
ALTER DATABASE [p2r_full] SET QUERY_STORE = ON
GO
ALTER DATABASE [p2r_full] SET QUERY_STORE (OPERATION_MODE = READ_WRITE, CLEANUP_POLICY = (STALE_QUERY_THRESHOLD_DAYS = 30), DATA_FLUSH_INTERVAL_SECONDS = 900, INTERVAL_LENGTH_MINUTES = 60, MAX_STORAGE_SIZE_MB = 1000, QUERY_CAPTURE_MODE = AUTO, SIZE_BASED_CLEANUP_MODE = AUTO, MAX_PLANS_PER_QUERY = 200, WAIT_STATS_CAPTURE_MODE = ON)
GO
USE [p2r_full]
GO
/****** Object:  Schema [sales]    Script Date: 10/4/2026 12:18:23 PM ******/
CREATE SCHEMA [sales]
GO
USE [p2r_full]
GO
/****** Object:  Sequence [sales].[OrderSeq]    Script Date: 10/4/2026 12:18:23 PM ******/
CREATE SEQUENCE [sales].[OrderSeq] 
 AS [int]
 START WITH 1000
 INCREMENT BY 1
 MINVALUE -2147483648
 MAXVALUE 2147483647
 CACHE 
GO
/****** Object:  Table [dbo].[Customers]    Script Date: 10/4/2026 12:18:23 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Customers](
	[Id] [int] IDENTITY(1,1) NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[Email] [nvarchar](200) NULL,
 CONSTRAINT [PK_Customers] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Customers_Email] UNIQUE NONCLUSTERED 
(
	[Email] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [sales].[Orders]    Script Date: 10/4/2026 12:18:23 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [sales].[Orders](
	[Id] [int] NOT NULL,
	[CustomerId] [int] NOT NULL,
	[Status] [nvarchar](20) NOT NULL,
	[Qty] [int] NOT NULL,
	[Created] [datetime2](7) NOT NULL,
	[Number] [int] NOT NULL,
	[Label] [nvarchar](20) NULL,
 CONSTRAINT [PK_Orders] PRIMARY KEY CLUSTERED 
(
	[Id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_Orders_Number] UNIQUE NONCLUSTERED 
(
	[Number] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  View [sales].[OrderSummary]    Script Date: 10/4/2026 12:18:23 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE VIEW [sales].[OrderSummary] AS SELECT o.[Id], c.[Name], o.[Qty] FROM [sales].[Orders] o JOIN [dbo].[Customers] c ON c.[Id] = o.[CustomerId]
GO
/****** Object:  Table [sales].[OrderTags]    Script Date: 10/4/2026 12:18:23 PM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [sales].[OrderTags](
	[OrderId] [int] NOT NULL,
	[Tag] [nvarchar](30) NOT NULL,
	[Weight] [int] NOT NULL,
 CONSTRAINT [PK_OrderTags] PRIMARY KEY NONCLUSTERED 
(
	[OrderId] ASC,
	[Tag] DESC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [IX_Orders_Created]    Script Date: 10/4/2026 12:18:23 PM ******/
CREATE NONCLUSTERED INDEX [IX_Orders_Created] ON [sales].[Orders]
(
	[Created] DESC,
	[Status] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
SET ANSI_PADDING ON
GO
/****** Object:  Index [UX_OrderTags_Tag]    Script Date: 10/4/2026 12:18:23 PM ******/
CREATE UNIQUE NONCLUSTERED INDEX [UX_OrderTags_Tag] ON [sales].[OrderTags]
(
	[Tag] ASC,
	[OrderId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [sales].[Orders] ADD  CONSTRAINT [DF_Orders_Status]  DEFAULT ('draft') FOR [Status]
GO
ALTER TABLE [sales].[Orders] ADD  CONSTRAINT [DF_Orders_Qty]  DEFAULT ((0)) FOR [Qty]
GO
ALTER TABLE [sales].[Orders] ADD  CONSTRAINT [DF_Orders_Created]  DEFAULT (getdate()) FOR [Created]
GO
ALTER TABLE [sales].[Orders] ADD  CONSTRAINT [DF_Orders_Number]  DEFAULT (NEXT VALUE FOR [sales].[OrderSeq]) FOR [Number]
GO
ALTER TABLE [sales].[Orders] ADD  CONSTRAINT [DF_Orders_Label]  DEFAULT (N'(none)') FOR [Label]
GO
ALTER TABLE [sales].[OrderTags] ADD  CONSTRAINT [DF_OrderTags_Weight]  DEFAULT ((1)) FOR [Weight]
GO
ALTER TABLE [sales].[Orders]  WITH CHECK ADD  CONSTRAINT [FK_Orders_Customers] FOREIGN KEY([CustomerId])
REFERENCES [dbo].[Customers] ([Id])
ON DELETE CASCADE
GO
ALTER TABLE [sales].[Orders] CHECK CONSTRAINT [FK_Orders_Customers]
GO
ALTER TABLE [sales].[OrderTags]  WITH CHECK ADD  CONSTRAINT [FK_OrderTags_Orders] FOREIGN KEY([OrderId])
REFERENCES [sales].[Orders] ([Id])
GO
ALTER TABLE [sales].[OrderTags] CHECK CONSTRAINT [FK_OrderTags_Orders]
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Customer''s full name' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'Customers', @level2type=N'COLUMN',@level2name=N'Name'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'People who buy' , @level0type=N'SCHEMA',@level0name=N'dbo', @level1type=N'TABLE',@level1name=N'Customers'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Units ordered' , @level0type=N'SCHEMA',@level0name=N'sales', @level1type=N'TABLE',@level1name=N'Orders', @level2type=N'COLUMN',@level2name=N'Qty'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Placed orders' , @level0type=N'SCHEMA',@level0name=N'sales', @level1type=N'TABLE',@level1name=N'Orders'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Tags per order' , @level0type=N'SCHEMA',@level0name=N'sales', @level1type=N'TABLE',@level1name=N'OrderTags'
GO
EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'Order totals' , @level0type=N'SCHEMA',@level0name=N'sales', @level1type=N'VIEW',@level1name=N'OrderSummary'
GO
USE [master]
GO
ALTER DATABASE [p2r_full] SET  READ_WRITE 
GO
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "Customers",
      "comment": "",
      "columns": [
        {
          "name": "Id",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": true,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Name",
          "dataType": "nvarchar(100)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Email",
          "dataType": "nvarchar(200)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": true,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [
        {
          "name": "PK_Customers",
          "columnNames": [
            "Id"
          ]
        },
        {
          "name": "UQ_Customers_Email",
          "columnNames": [
            "Email"
          ]
        }
      ],
      "foreignKeys": []
    },
    {
      "type": "create.table",
      "name": "Orders",
      "comment": "",
      "columns": [
        {
          "name": "Id",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "CustomerId",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Status",
          "dataType": "nvarchar(20)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Qty",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Created",
          "dataType": "datetime2(7)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Number",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": true,
          "nullable": false
        },
        {
          "name": "Label",
          "dataType": "nvarchar(20)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [
        {
          "name": "PK_Orders",
          "columnNames": [
            "Id"
          ]
        },
        {
          "name": "UQ_Orders_Number",
          "columnNames": [
            "Number"
          ]
        }
      ],
      "foreignKeys": []
    },
    {
      "type": "create.table",
      "name": "OrderTags",
      "comment": "",
      "columns": [
        {
          "name": "OrderId",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Tag",
          "dataType": "nvarchar(30)",
          "default": "",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Weight",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        }
      ],
      "indexes": [],
      "keys": [
        {
          "name": "PK_OrderTags",
          "columnNames": [
            "OrderId",
            "Tag"
          ]
        }
      ],
      "foreignKeys": []
    },
    {
      "type": "create.index",
      "name": "IX_Orders_Created",
      "unique": false,
      "tableName": "Orders",
      "columns": [
        {
          "name": "Created",
          "sort": "DESC"
        },
        {
          "name": "Status",
          "sort": "ASC"
        }
      ]
    },
    {
      "type": "create.index",
      "name": "UX_OrderTags_Tag",
      "unique": true,
      "tableName": "OrderTags",
      "columns": [
        {
          "name": "Tag",
          "sort": "ASC"
        },
        {
          "name": "OrderId",
          "sort": "ASC"
        }
      ]
    },
    {
      "type": "alter.table.add.default",
      "name": "Orders",
      "columnName": "Status",
      "default": "'draft'"
    },
    {
      "type": "alter.table.add.default",
      "name": "Orders",
      "columnName": "Qty",
      "default": "0"
    },
    {
      "type": "alter.table.add.default",
      "name": "Orders",
      "columnName": "Created",
      "default": "getdate()"
    },
    {
      "type": "alter.table.add.default",
      "name": "Orders",
      "columnName": "Number",
      "default": "NEXT VALUE FOR [sales].[OrderSeq]"
    },
    {
      "type": "alter.table.add.default",
      "name": "Orders",
      "columnName": "Label",
      "default": "N'(none)'"
    },
    {
      "type": "alter.table.add.default",
      "name": "OrderTags",
      "columnName": "Weight",
      "default": "1"
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "Orders",
      "columnNames": [
        "CustomerId"
      ],
      "refTableName": "Customers",
      "refColumnNames": [
        "Id"
      ],
      "onDelete": "CASCADE",
      "onUpdate": ""
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "OrderTags",
      "columnNames": [
        "OrderId"
      ],
      "refTableName": "Orders",
      "refColumnNames": [
        "Id"
      ],
      "onDelete": "",
      "onUpdate": ""
    },
    {
      "type": "comment.on.column",
      "tableName": "Customers",
      "columnName": "Name",
      "comment": "Customer's full name"
    },
    {
      "type": "comment.on.table",
      "name": "Customers",
      "comment": "People who buy"
    },
    {
      "type": "comment.on.column",
      "tableName": "Orders",
      "columnName": "Qty",
      "comment": "Units ordered"
    },
    {
      "type": "comment.on.table",
      "name": "Orders",
      "comment": "Placed orders"
    },
    {
      "type": "comment.on.table",
      "name": "OrderTags",
      "comment": "Tags per order"
    }
  ]
}
```

### PostgreSQL serial and identity columns from pg_dump

Output of pg_dump 17.11 `--schema-only` against PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) for a
database with two serial columns, a bigserial and a smallserial column, an identity column
GENERATED ALWAYS and one GENERATED BY DEFAULT, and a column whose default calls `nextval` on a
sequence no column owns, in a schema `app` and in `public`. pg_dump writes each table without its
identity or its serial defaults: an identity follows its table as `ALTER TABLE ... ADD GENERATED
... AS IDENTITY`, and each serial default follows all the tables and sequences as `ALTER TABLE
ONLY ... SET DEFAULT nextval(...)`, while the default on the sequence no column owns stays in its
`CREATE TABLE`; all of them read as auto increment. The `\restrict` and `\unrestrict` lines, psql
meta-commands with a key pg_dump generates for each dump, give no statement. pg_dump wrote ASCII
with LF line endings, kept here byte for byte.

```sql
--
-- PostgreSQL database dump
--

\restrict qil86iAetUiPOk6kuZddEJBORdtdPOhJRWHEqkn1D3eeOqnOd0XxId9hxWldvUE

-- Dumped from database version 17.11 (Debian 17.11-1.pgdg13+2)
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: app; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA app;


ALTER SCHEMA app OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.audit (
    id bigint NOT NULL,
    event_id integer,
    at timestamp with time zone DEFAULT now()
);


ALTER TABLE app.audit OWNER TO postgres;

--
-- Name: COLUMN audit.id; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.audit.id IS 'identity by default from 100';


--
-- Name: audit_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

ALTER TABLE app.audit ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME app.audit_id_seq
    START WITH 100
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: events; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.events (
    id integer NOT NULL,
    order_id bigint,
    kind text NOT NULL
);


ALTER TABLE app.events OWNER TO postgres;

--
-- Name: events_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

ALTER TABLE app.events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME app.events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: some_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.some_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.some_seq OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.orders (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    line smallint NOT NULL,
    ticket integer DEFAULT nextval('app.some_seq'::regclass),
    note character varying(50) DEFAULT 'none'::character varying
);


ALTER TABLE app.orders OWNER TO postgres;

--
-- Name: COLUMN orders.ticket; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.orders.ticket IS 'from a shared sequence';


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.orders_id_seq OWNER TO postgres;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.orders_id_seq OWNED BY app.orders.id;


--
-- Name: orders_line_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.orders_line_seq
    AS smallint
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.orders_line_seq OWNER TO postgres;

--
-- Name: orders_line_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.orders_line_seq OWNED BY app.orders.line;


--
-- Name: users; Type: TABLE; Schema: app; Owner: postgres
--

CREATE TABLE app.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    name text
);


ALTER TABLE app.users OWNER TO postgres;

--
-- Name: TABLE users; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.users IS 'app users';


--
-- Name: COLUMN users.id; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.users.id IS 'user id';


--
-- Name: COLUMN users.email; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.users.email IS 'login email';


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: app; Owner: postgres
--

CREATE SEQUENCE app.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE app.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: app; Owner: postgres
--

ALTER SEQUENCE app.users_id_seq OWNED BY app.users.id;


--
-- Name: items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.items (
    id integer NOT NULL,
    order_id bigint,
    label text DEFAULT 'x'::text
);


ALTER TABLE public.items OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.items_id_seq OWNER TO postgres;

--
-- Name: items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.items_id_seq OWNED BY public.items.id;


--
-- Name: orders id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.orders ALTER COLUMN id SET DEFAULT nextval('app.orders_id_seq'::regclass);


--
-- Name: orders line; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.orders ALTER COLUMN line SET DEFAULT nextval('app.orders_line_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.users ALTER COLUMN id SET DEFAULT nextval('app.users_id_seq'::regclass);


--
-- Name: items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items ALTER COLUMN id SET DEFAULT nextval('public.items_id_seq'::regclass);


--
-- Name: audit audit_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.audit
    ADD CONSTRAINT audit_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: items items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_pkey PRIMARY KEY (id);


--
-- Name: orders_user_idx; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX orders_user_idx ON app.orders USING btree (user_id);


--
-- Name: audit audit_event_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.audit
    ADD CONSTRAINT audit_event_id_fkey FOREIGN KEY (event_id) REFERENCES app.events(id);


--
-- Name: events events_order_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.events
    ADD CONSTRAINT events_order_id_fkey FOREIGN KEY (order_id) REFERENCES app.orders(id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES app.users(id);


--
-- Name: items items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.items
    ADD CONSTRAINT items_order_id_fkey FOREIGN KEY (order_id) REFERENCES app.orders(id);


--
-- PostgreSQL database dump complete
--

\unrestrict qil86iAetUiPOk6kuZddEJBORdtdPOhJRWHEqkn1D3eeOqnOd0XxId9hxWldvUE

```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "audit",
      "comment": "",
      "columns": [
        {
          "name": "id",
          "dataType": "bigint",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "event_id",
          "dataType": "integer",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "at",
          "dataType": "timestamp with time zone",
          "default": "now()",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "comment.on.column",
      "tableName": "audit",
      "columnName": "id",
      "comment": "identity by default from 100"
    },
    {
      "type": "alter.table.alter.column.autoIncrement",
      "name": "audit",
      "columnName": "id"
    },
    {
      "type": "create.table",
      "name": "events",
      "comment": "",
      "columns": [
        {
          "name": "id",
          "dataType": "integer",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "order_id",
          "dataType": "bigint",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "kind",
          "dataType": "text",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "alter.table.alter.column.autoIncrement",
      "name": "events",
      "columnName": "id"
    },
    {
      "type": "create.table",
      "name": "orders",
      "comment": "",
      "columns": [
        {
          "name": "id",
          "dataType": "bigint",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "user_id",
          "dataType": "integer",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "line",
          "dataType": "smallint",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "ticket",
          "dataType": "integer",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": true,
          "unique": false,
          "nullable": true
        },
        {
          "name": "note",
          "dataType": "character varying(50)",
          "default": "'none'",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "comment.on.column",
      "tableName": "orders",
      "columnName": "ticket",
      "comment": "from a shared sequence"
    },
    {
      "type": "create.table",
      "name": "users",
      "comment": "",
      "columns": [
        {
          "name": "id",
          "dataType": "integer",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "email",
          "dataType": "character varying(255)",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "name",
          "dataType": "text",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "comment.on.table",
      "name": "users",
      "comment": "app users"
    },
    {
      "type": "comment.on.column",
      "tableName": "users",
      "columnName": "id",
      "comment": "user id"
    },
    {
      "type": "comment.on.column",
      "tableName": "users",
      "columnName": "email",
      "comment": "login email"
    },
    {
      "type": "create.table",
      "name": "items",
      "comment": "",
      "columns": [
        {
          "name": "id",
          "dataType": "integer",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "order_id",
          "dataType": "bigint",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "label",
          "dataType": "text",
          "default": "'x'",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "alter.table.alter.column.autoIncrement",
      "name": "orders",
      "columnName": "id"
    },
    {
      "type": "alter.table.alter.column.autoIncrement",
      "name": "orders",
      "columnName": "line"
    },
    {
      "type": "alter.table.alter.column.autoIncrement",
      "name": "users",
      "columnName": "id"
    },
    {
      "type": "alter.table.alter.column.autoIncrement",
      "name": "items",
      "columnName": "id"
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "audit",
      "constraintName": "audit_pkey",
      "usingIndexName": "",
      "columnNames": ["id"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "events",
      "constraintName": "events_pkey",
      "usingIndexName": "",
      "columnNames": ["id"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "orders",
      "constraintName": "orders_pkey",
      "usingIndexName": "",
      "columnNames": ["id"]
    },
    {
      "type": "alter.table.add.unique",
      "name": "users",
      "constraintName": "users_email_key",
      "usingIndexName": "",
      "columns": [
        {
          "name": "email",
          "sort": "ASC"
        }
      ]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "users",
      "constraintName": "users_pkey",
      "usingIndexName": "",
      "columnNames": ["id"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "items",
      "constraintName": "items_pkey",
      "usingIndexName": "",
      "columnNames": ["id"]
    },
    {
      "type": "create.index",
      "name": "orders_user_idx",
      "unique": false,
      "tableName": "orders",
      "columns": [
        {
          "name": "user_id",
          "sort": "ASC"
        }
      ]
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "audit",
      "columnNames": ["event_id"],
      "refTableName": "events",
      "refColumnNames": ["id"],
      "onDelete": "",
      "onUpdate": ""
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "events",
      "columnNames": ["order_id"],
      "refTableName": "orders",
      "refColumnNames": ["id"],
      "onDelete": "",
      "onUpdate": ""
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "orders",
      "columnNames": ["user_id"],
      "refTableName": "users",
      "refColumnNames": ["id"],
      "onDelete": "",
      "onUpdate": ""
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "items",
      "columnNames": ["order_id"],
      "refTableName": "orders",
      "refColumnNames": ["id"],
      "onDelete": "",
      "onUpdate": ""
    }
  ]
}
```

### MariaDB sequence defaults from mariadb-dump

Output of mariadb-dump `--no-data` (10.20-11.8.9-MariaDB) against MariaDB 11.8.9 for a database
whose three tables take their defaults from one sequence, created as `nextval(shop.order_seq)`,
`(NEXT VALUE FOR shop.order_seq)`, `NEXTVAL(order_seq)`, `NEXT VALUE FOR order_seq` and, through
an `ALTER TABLE ... SET DEFAULT`, `(nextval(shop.order_seq))`. MariaDB stores every one of them in
one form, which `SHOW CREATE TABLE` and the dump write: `nextval` of the sequence qualified by its
database, each name in backticks. Each stays the column's default, with no auto increment.
mariadb-dump wrote ASCII with LF line endings, kept here byte for byte, the space after the
sandbox comment on the first line included.

```sql
/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.20-11.8.9-MariaDB, for debian-linux-gnu (aarch64)
--
-- Host: localhost    Database: shop
-- ------------------------------------------------------
-- Server version	11.8.9-MariaDB-ubu2404

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Sequence structure for `order_seq`
--

DROP SEQUENCE IF EXISTS `order_seq`;
CREATE SEQUENCE `order_seq` start with 1 minvalue 1 maxvalue 9223372036854775806 increment by 1 cache 1000 nocycle ENGINE=InnoDB;
DO SETVAL(`order_seq`, 1, 0);

--
-- Table structure for table `invoices`
--

DROP TABLE IF EXISTS `invoices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `invoices` (
  `id` bigint(20) DEFAULT nextval(`shop`.`order_seq`),
  `total` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint(20) NOT NULL DEFAULT nextval(`shop`.`order_seq`),
  `note` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `refs`
--

DROP TABLE IF EXISTS `refs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `refs` (
  `ref` bigint(20) DEFAULT nextval(`shop`.`order_seq`),
  `code` int(11) DEFAULT nextval(`shop`.`order_seq`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-10-04 11:56:38
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "invoices",
      "comment": "",
      "columns": [
        {
          "name": "id",
          "dataType": "bigint(20)",
          "default": "nextval(`shop`.`order_seq`)",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "total",
          "dataType": "int(11)",
          "default": "NULL",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "create.table",
      "name": "orders",
      "comment": "",
      "columns": [
        {
          "name": "id",
          "dataType": "bigint(20)",
          "default": "nextval(`shop`.`order_seq`)",
          "comment": "",
          "primaryKey": true,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "note",
          "dataType": "varchar(20)",
          "default": "NULL",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "create.table",
      "name": "refs",
      "comment": "",
      "columns": [
        {
          "name": "ref",
          "dataType": "bigint(20)",
          "default": "nextval(`shop`.`order_seq`)",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "code",
          "dataType": "int(11)",
          "default": "nextval(`shop`.`order_seq`)",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
```

### MariaDB sequence defaults

Written by hand, for the forms of a sequence default a script may hold and mariadb-dump never
writes, since it writes each default as MariaDB stores it (the case above): a bare
`NEXTVAL(order_seq)`, `NEXT VALUE FOR` in a `CREATE TABLE`, and an `ALTER TABLE ... SET DEFAULT`,
which sets no default here. The sequence and its `DO SETVAL` are spelled as mariadb-dump spells
them.

```sql
CREATE SEQUENCE `order_seq` start with 1 minvalue 1 maxvalue 9223372036854775806 increment by 1 cache 1000 nocycle ENGINE=InnoDB;
DO SETVAL(`order_seq`, 1, 0);

CREATE TABLE `orders` (
  `ref` bigint(20) DEFAULT NEXTVAL(order_seq),
  `code` int(11) DEFAULT NEXT VALUE FOR `order_seq`
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `orders` ALTER COLUMN `ref` SET DEFAULT (nextval(shop.order_seq));
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "orders",
      "comment": "",
      "columns": [
        {
          "name": "ref",
          "dataType": "bigint(20)",
          "default": "NEXTVAL(order_seq)",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "code",
          "dataType": "int(11)",
          "default": "NEXT VALUE FOR `order_seq`",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
```

### PostgreSQL user-defined types, domains and arrays

```sql
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE public.mood AS ENUM ('sad', 'ok', 'it''s');

CREATE TYPE address AS (street text, city text);

CREATE DOMAIN us_postal AS TEXT CHECK (VALUE ~ '^\d{5}$');

CREATE TABLE public.person (
    id integer NOT NULL,
    current_mood public.mood DEFAULT 'ok'::public.mood NOT NULL,
    zip us_postal,
    home address,
    email citext,
    tags "public"."mood"[],
    scores integer[]
);

COMMENT ON COLUMN public.person.current_mood IS 'it''s how they feel';
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "person",
      "comment": "",
      "columns": [
        {
          "name": "id",
          "dataType": "integer",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "current_mood",
          "dataType": "public.mood",
          "default": "'ok'",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "zip",
          "dataType": "us_postal",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "home",
          "dataType": "address",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "email",
          "dataType": "citext",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "tags",
          "dataType": "\"public\".\"mood\"[]",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "scores",
          "dataType": "integer[]",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    },
    {
      "type": "comment.on.column",
      "tableName": "person",
      "columnName": "current_mood",
      "comment": "it's how they feel"
    }
  ]
}
```

### SQL Server alias types

```sql
CREATE TYPE [dbo].[Phone] FROM [nvarchar](20) NULL;

CREATE TYPE dbo.LineItems AS TABLE (id INT, qty INT);

CREATE TABLE [dbo].[Customer] (
  [Id] [int] IDENTITY(1,1) NOT NULL,
  [Phone] [dbo].[Phone] NULL,
  [Owner] [sysname] NOT NULL,
  [Status] [dbo].[Order] NULL
);
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "Customer",
      "comment": "",
      "columns": [
        {
          "name": "Id",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": true,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Phone",
          "dataType": "[dbo].[Phone]",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "Owner",
          "dataType": "[sysname]",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        },
        {
          "name": "Status",
          "dataType": "[dbo].[Order]",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
```

### MySQL ENUM and SET values

```sql
CREATE TABLE `film` (
  `rating` ENUM('G','PG','PG-13','R','NC-17') DEFAULT 'G',
  `special_features` SET('Trailers','Deleted Scenes') NULL,
  `note` ENUM('it''s','') NOT NULL COMMENT 'it''s a note'
);
```

```json
{
  "statements": [
    {
      "type": "create.table",
      "name": "film",
      "comment": "",
      "columns": [
        {
          "name": "rating",
          "dataType": "ENUM('G','PG','PG-13','R','NC-17')",
          "default": "'G'",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "special_features",
          "dataType": "SET('Trailers','Deleted Scenes')",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": true
        },
        {
          "name": "note",
          "dataType": "ENUM('it''s','')",
          "default": "",
          "comment": "it's a note",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": false,
          "nullable": false
        }
      ],
      "indexes": [],
      "keys": [],
      "foreignKeys": []
    }
  ]
}
```
