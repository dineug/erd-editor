import { DataTypeHint } from '@/constants/sql/dataType';

/**
 * https://www.sqlite.org/datatype3.html
 */
export const SQLiteTypes: DataTypeHint[] = [
  { name: 'BIGINT', primitiveType: 'long' },
  { name: 'BLOB', primitiveType: 'lob' },
  { name: 'BOOLEAN', primitiveType: 'boolean' },
  { name: 'CHARACTER', primitiveType: 'string' },
  { name: 'CLOB', primitiveType: 'lob' },
  { name: 'DATE', primitiveType: 'date' },
  { name: 'DATETIME', primitiveType: 'dateTime' },
  { name: 'DECIMAL', primitiveType: 'decimal' },
  { name: 'DOUBLE PRECISION', primitiveType: 'double' },
  { name: 'DOUBLE', primitiveType: 'double' },
  { name: 'FLOAT', primitiveType: 'double' },
  { name: 'INT', primitiveType: 'int' },
  { name: 'INT2', primitiveType: 'int' },
  { name: 'INT8', primitiveType: 'long' },
  { name: 'INTEGER', primitiveType: 'int' },
  { name: 'MEDIUMINT', primitiveType: 'int' },
  { name: 'NATIVE CHARACTER', primitiveType: 'string' },
  { name: 'NCHAR', primitiveType: 'string' },
  { name: 'NUMERIC', primitiveType: 'decimal' },
  { name: 'NVARCHAR', primitiveType: 'string' },
  { name: 'REAL', primitiveType: 'double' },
  { name: 'SMALLINT', primitiveType: 'int' },
  { name: 'TEXT', primitiveType: 'string' },
  { name: 'TINYINT', primitiveType: 'int' },
  { name: 'UNSIGNED BIG INT', primitiveType: 'long' },
  { name: 'VARCHAR', primitiveType: 'string' },
  { name: 'VARYING CHARACTER', primitiveType: 'string' },
];
