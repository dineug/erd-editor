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
          "default": "c",
          "comment": "d",
          "primaryKey": true,
          "autoIncrement": true,
          "unique": true,
          "nullable": false
        }
      ],
      "indexes": [],
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
          "unique": true,
          "nullable": true
        },
        {
          "name": "c",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": true,
          "nullable": true
        }
      ],
      "indexes": [],
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
          "unique": true,
          "nullable": true
        },
        {
          "name": "c",
          "dataType": "int",
          "default": "",
          "comment": "",
          "primaryKey": false,
          "autoIncrement": false,
          "unique": true,
          "nullable": true
        }
      ],
      "indexes": [],
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
      "foreignKeys": [
        {
          "columnNames": ["b", "c"],
          "refTableName": "b",
          "refColumnNames": ["b", "c"]
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
      "foreignKeys": [
        {
          "columnNames": ["b", "c"],
          "refTableName": "a",
          "refColumnNames": ["b", "c"]
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
      "columnNames": ["ID"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "Persons",
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
      "columnNames": ["ID"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "Persons",
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
      "refColumnNames": ["PersonID"]
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "Orders",
      "columnNames": ["PersonID"],
      "refTableName": "Persons",
      "refColumnNames": ["PersonID"]
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
      "refColumnNames": ["PersonID"]
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "Orders",
      "columnNames": ["PersonID"],
      "refTableName": "Persons",
      "refColumnNames": ["PersonID"]
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
      "columnNames": ["ID"]
    },
    {
      "type": "alter.table.add.unique",
      "name": "Persons",
      "columnNames": ["ID", "LastName"]
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
      "columnNames": ["ID"]
    },
    {
      "type": "alter.table.add.unique",
      "name": "Persons",
      "columnNames": ["ID", "LastName"]
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
      "columnNames": ["ID"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "Persons",
      "columnNames": ["ID", "LastName"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "Persons",
      "columnNames": ["ID"]
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "Persons",
      "columnNames": ["ID", "LastName"]
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "Orders",
      "columnNames": ["PersonID"],
      "refTableName": "Persons",
      "refColumnNames": ["PersonID"]
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "Orders",
      "columnNames": ["PersonID"],
      "refTableName": "Persons",
      "refColumnNames": ["PersonID"]
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "Orders",
      "columnNames": ["PersonID"],
      "refTableName": "Persons",
      "refColumnNames": ["PersonID"]
    },
    {
      "type": "alter.table.add.foreignKey",
      "name": "Orders",
      "columnNames": ["PersonID"],
      "refTableName": "Persons",
      "refColumnNames": ["PersonID"]
    },
    {
      "type": "alter.table.add.unique",
      "name": "Persons",
      "columnNames": ["ID"]
    },
    {
      "type": "alter.table.add.unique",
      "name": "Persons",
      "columnNames": ["ID", "LastName"]
    },
    {
      "type": "alter.table.add.unique",
      "name": "Persons",
      "columnNames": ["ID"]
    },
    {
      "type": "alter.table.add.unique",
      "name": "Persons",
      "columnNames": ["ID", "LastName"]
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
      "foreignKeys": [
        {
          "columnNames": [
            "SP_ID"
          ],
          "refTableName": "SALESPEOPLE",
          "refColumnNames": [
            "SP_ID"
          ]
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
      "foreignKeys": []
    },
    {
      "type": "alter.table.add.primaryKey",
      "name": "users",
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
      ]
    }
  ]
}
```
