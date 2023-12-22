export interface Translation {
  liquibase: string;
  unsupportedDatabase: string;

  postgresql: string;
  mssql: string;
  oracle: string;
}

export const translations: Translation[] = [
  {
    liquibase: 'boolean',
    postgresql: 'BOOLEAN',
    unsupportedDatabase: 'BOOLEAN',
    mssql: 'BIT',
    oracle: 'NUMBER(1)',
  },
  {
    liquibase: 'tinyint',
    postgresql: 'SMALLINT',
    unsupportedDatabase: 'TINYINT',
    mssql: 'TINYINT',
    oracle: 'NUMBER(3)',
  },
  {
    liquibase: 'int',
    postgresql: 'INT',
    unsupportedDatabase: 'INT',
    mssql: 'INT',
    oracle: 'INTEGER',
  },
  {
    liquibase: 'mediumint',
    postgresql: 'MEDIUMINT',
    unsupportedDatabase: 'MEDIUMINT',
    mssql: 'INT',
    oracle: 'MEDIUMINT',
  },
  {
    liquibase: 'bigint',
    postgresql: 'BIGINT',
    unsupportedDatabase: 'BIGINT',
    mssql: 'BIGINT',
    oracle: 'NUMBER(38, 0)',
  },
  {
    liquibase: 'float',
    postgresql: 'FLOAT',
    unsupportedDatabase: 'FLOAT',
    mssql: 'FLOAT(53)',
    oracle: 'FLOAT',
  },
  {
    liquibase: 'double',
    postgresql: 'DOUBLE PRECISION',
    unsupportedDatabase: 'DOUBLE',
    mssql: 'FLOAT(53)',
    oracle: 'FLOAT(24)',
  },
  {
    liquibase: 'decimal',
    postgresql: 'DECIMAL',
    unsupportedDatabase: 'DECIMAL',
    mssql: 'DECIMAL(18, 0)',
    oracle: 'DECIMAL',
  },
  {
    liquibase: 'number',
    postgresql: 'numeric',
    unsupportedDatabase: 'NUMBER',
    mssql: 'numeric(18, 0)',
    oracle: 'NUMBER',
  },
  {
    liquibase: 'blob',
    postgresql: 'BYTEA',
    unsupportedDatabase: 'BLOB',
    mssql: 'varbinary(MAX)',
    oracle: 'BLOB',
  },
  {
    liquibase: 'function',
    postgresql: 'FUNCTION',
    unsupportedDatabase: 'FUNCTION',
    mssql: 'FUNCTION',
    oracle: 'FUNCTION',
  },
  {
    liquibase: 'UNKNOWN',
    postgresql: 'UNKNOWN',
    unsupportedDatabase: 'UNKNOWN',
    mssql: 'UNKNOWN',
    oracle: 'UNKNOWN',
  },
  {
    liquibase: 'datetime',
    postgresql: 'TIMESTAMP',
    unsupportedDatabase: 'datetime',
    mssql: 'datetime',
    oracle: 'TIMESTAMP',
  },
  {
    liquibase: 'time',
    postgresql: 'TIME',
    unsupportedDatabase: 'time',
    mssql: 'time(7)',
    oracle: 'DATE',
  },
  {
    liquibase: 'timestamp',
    postgresql: 'TIMESTAMP',
    unsupportedDatabase: 'timestamp',
    mssql: 'datetime',
    oracle: 'TIMESTAMP',
  },
  {
    liquibase: 'date',
    postgresql: 'date',
    unsupportedDatabase: 'date',
    mssql: 'date',
    oracle: 'date',
  },
  {
    liquibase: 'char',
    postgresql: 'CHAR',
    unsupportedDatabase: 'CHAR',
    mssql: 'CHAR(1)',
    oracle: 'CHAR',
  },
  {
    liquibase: 'varchar',
    postgresql: 'VARCHAR',
    unsupportedDatabase: 'VARCHAR',
    mssql: 'VARCHAR(1)',
    oracle: 'VARCHAR2',
  },
  {
    liquibase: 'nchar',
    postgresql: 'NCHAR',
    unsupportedDatabase: 'NCHAR',
    mssql: 'NCHAR(1)',
    oracle: 'NCHAR',
  },
  {
    liquibase: 'nvarchar',
    postgresql: 'VARCHAR',
    unsupportedDatabase: 'NVARCHAR',
    mssql: 'NVARCHAR(1)',
    oracle: 'NVARCHAR2',
  },
  {
    liquibase: 'clob',
    postgresql: 'TEXT',
    unsupportedDatabase: 'CLOB',
    mssql: 'VARCHAR(MAX)',
    oracle: 'CLOB',
  },
  {
    liquibase: 'currency',
    postgresql: 'DECIMAL',
    unsupportedDatabase: 'DECIMAL',
    mssql: 'MONEY',
    oracle: 'NUMBER(15, 2)',
  },
  {
    liquibase: 'uuid',
    postgresql: 'UUID',
    unsupportedDatabase: 'char(36)',
    mssql: 'UNIQUEIDENTIFIER',
    oracle: 'RAW(16)',
  },
];
