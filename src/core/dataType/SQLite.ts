import { DataTypeHint } from '@/core/dataType';

/**
 * https://www.sqlite.org/datatype3.html
 */
export const SQLiteTypes: DataTypeHint[] = [
  { name: 'BLOB', primitiveType: 'lob' },
  { name: 'INTEGER', primitiveType: 'int' },
  { name: 'NUMERIC', primitiveType: 'decimal' },
  { name: 'REAL', primitiveType: 'double' },
  { name: 'TEXT', primitiveType: 'string' },
];
