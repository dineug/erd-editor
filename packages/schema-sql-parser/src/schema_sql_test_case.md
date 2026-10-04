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
          "default": "nextval('public.orders_id_seq'::regclass)",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
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

```sql
ALTER TABLE [dbo].[Orders] ADD  CONSTRAINT [DF_Orders_Status]  DEFAULT ('draft') FOR [Status]
GO
ALTER TABLE [dbo].[Orders] ADD  DEFAULT ((0)) FOR [Qty]
GO
ALTER TABLE [dbo].[Orders] ADD  CONSTRAINT [DF_Orders_Created]  DEFAULT (getdate()) FOR [Created]
GO
ALTER TABLE [dbo].[Orders] ADD  DEFAULT (NEXT VALUE FOR [dbo].[OrderSeq]) FOR [Number]
GO
ALTER TABLE [dbo].[Orders] ADD  DEFAULT (N'(none)') FOR [Label]
GO
```

```json
{
  "statements": [
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
