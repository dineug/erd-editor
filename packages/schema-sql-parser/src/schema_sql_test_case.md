# Schema SQL Test Case

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
