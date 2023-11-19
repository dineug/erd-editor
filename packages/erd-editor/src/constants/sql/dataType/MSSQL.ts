import { DataTypeHint } from '@/constants/sql/dataType';

/**
 * https://docs.microsoft.com/ko-kr/sql/t-sql/data-types/data-types-transact-sql?view=sql-server-ver15
 */
export const MSSQLTypes: DataTypeHint[] = [
  { name: 'bigint', primitiveType: 'long' },
  { name: 'binary', primitiveType: 'lob' },
  { name: 'bit', primitiveType: 'int' },
  { name: 'char', primitiveType: 'string' },
  { name: 'date', primitiveType: 'date' },
  { name: 'datetime', primitiveType: 'dateTime' },
  { name: 'datetime2', primitiveType: 'dateTime' },
  { name: 'datetimeoffset', primitiveType: 'dateTime' },
  { name: 'decimal', primitiveType: 'decimal' },
  { name: 'float', primitiveType: 'double' },
  { name: 'geography', primitiveType: 'string' },
  { name: 'geometry', primitiveType: 'string' },
  { name: 'image', primitiveType: 'lob' },
  { name: 'int', primitiveType: 'int' },
  { name: 'money', primitiveType: 'double' },
  { name: 'nchar', primitiveType: 'string' },
  { name: 'ntext', primitiveType: 'lob' },
  { name: 'numeric', primitiveType: 'float' },
  { name: 'nvarchar', primitiveType: 'string' },
  { name: 'real', primitiveType: 'float' },
  { name: 'smalldatetime', primitiveType: 'dateTime' },
  { name: 'smallint', primitiveType: 'int' },
  { name: 'smallmoney', primitiveType: 'float' },
  { name: 'sql_variant', primitiveType: 'string' },
  { name: 'text', primitiveType: 'lob' },
  { name: 'time', primitiveType: 'time' },
  { name: 'tinyint', primitiveType: 'int' },
  { name: 'uniqueidentifier', primitiveType: 'string' },
  { name: 'varbinary', primitiveType: 'string' },
  { name: 'varchar', primitiveType: 'string' },
  { name: 'xml', primitiveType: 'lob' },
];
