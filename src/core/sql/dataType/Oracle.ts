import { DataTypeHint } from '@/core/sql/dataType';

/**
 * https://docs.oracle.com/cd/B28359_01/server.111/b28318/datatype.htm#CNCPT012
 */
export const OracleTypes: DataTypeHint[] = [
  { name: 'BFILE', primitiveType: 'lob' },
  { name: 'BINARY_DOUBLE', primitiveType: 'double' },
  { name: 'BINARY_FLOAT', primitiveType: 'float' },
  { name: 'BLOB', primitiveType: 'lob' },
  { name: 'CHAR', primitiveType: 'string' },
  { name: 'CLOB', primitiveType: 'lob' },
  { name: 'DATE', primitiveType: 'date' },
  { name: 'DATETIME', primitiveType: 'dateTime' },
  { name: 'LONG RAW', primitiveType: 'lob' },
  { name: 'LONG', primitiveType: 'lob' },
  { name: 'NCHAR', primitiveType: 'string' },
  { name: 'NCLOB', primitiveType: 'lob' },
  { name: 'NUMBER', primitiveType: 'long' },
  { name: 'NVARCHAR2', primitiveType: 'string' },
  { name: 'RAW', primitiveType: 'lob' },
  { name: 'TIMESTAMP WITH LOCAL TIME ZONE', primitiveType: 'dateTime' },
  { name: 'TIMESTAMP WITH TIME ZONE', primitiveType: 'dateTime' },
  { name: 'TIMESTAMP', primitiveType: 'dateTime' },
  { name: 'UriType', primitiveType: 'string' },
  { name: 'VARCHAR', primitiveType: 'string' },
  { name: 'VARCHAR2', primitiveType: 'string' },
  { name: 'XMLType', primitiveType: 'string' },
];
