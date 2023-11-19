import { Database } from '@/constants/schema';
import { ValuesType } from '@/internal-types';

import { MariaDBTypes } from './MariaDB';
import { MSSQLTypes } from './MSSQL';
import { MySQLTypes } from './MySQL';
import { OracleTypes } from './Oracle';
import { PostgreSQLTypes } from './PostgreSQL';
import { SQLiteTypes } from './SQLite';

export const PrimitiveType = {
  int: 'int',
  long: 'long',
  float: 'float',
  double: 'double',
  decimal: 'decimal',
  boolean: 'boolean',
  string: 'string',
  lob: 'lob',
  date: 'date',
  dateTime: 'dateTime',
  time: 'time',
} as const;
export type PrimitiveType = ValuesType<typeof PrimitiveType>;
export type PrimitiveTypeMap = Record<PrimitiveType, string>;

export type DataTypeHint = {
  name: string;
  primitiveType: PrimitiveType;
};

export type DatabaseHint = {
  database: number;
  dataTypeHints: DataTypeHint[];
};

export const DatabaseHintMap: Record<number, Array<DataTypeHint>> = {
  [Database.MariaDB]: MariaDBTypes,
  [Database.MSSQL]: MSSQLTypes,
  [Database.MySQL]: MySQLTypes,
  [Database.Oracle]: OracleTypes,
  [Database.PostgreSQL]: PostgreSQLTypes,
  [Database.SQLite]: SQLiteTypes,
};
