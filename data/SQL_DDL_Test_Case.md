# SQL DDL Test Case

## case1

```sql
CREATE TABLE a (
 id bigint(20) NOT NULL
)
CREATE TABLE b (
 id bigint(20) NOT NULL
);
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
          "name": "id",
          "dataType": "bigint(20)",
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
      "type": "create.table",
      "name": "b",
      "comment": "",
      "columns": [
        {
          "name": "id",
          "dataType": "bigint(20)",
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
    }
  ]
}
```

## case2

```sql
CREATE TABLE a (
 id bigint(20) NOT NULL
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
          "name": "id",
          "dataType": "bigint(20)",
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
    }
  ]
}
```
