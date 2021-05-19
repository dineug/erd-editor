import { Database } from '@@types/engine/store/canvas.state';
import { MariaDBTypes } from './MariaDB';
import { MSSQLTypes } from './MSSQL';
import { MySQLTypes } from './MySQL';
import { OracleTypes } from './Oracle';
import { PostgreSQLTypes } from './PostgreSQL';
import { SQLiteTypes } from './SQLite';

export type PrimitiveType =
  | 'int'
  | 'long'
  | 'float'
  | 'double'
  | 'decimal'
  | 'boolean'
  | 'string'
  | 'lob'
  | 'date'
  | 'dateTime'
  | 'time';

export type PrimitiveTypeMap = Record<PrimitiveType, string>;

export interface DataTypeHint {
  name: string;
  primitiveType: PrimitiveType;
}

export interface DatabaseHint {
  database: Database;
  dataTypeHints: DataTypeHint[];
}

export const databaseHints: DatabaseHint[] = [
  {
    database: 'MariaDB',
    dataTypeHints: MariaDBTypes,
  },
  {
    database: 'MSSQL',
    dataTypeHints: MSSQLTypes,
  },
  {
    database: 'MySQL',
    dataTypeHints: MySQLTypes,
  },
  {
    database: 'Oracle',
    dataTypeHints: OracleTypes,
  },
  {
    database: 'PostgreSQL',
    dataTypeHints: PostgreSQLTypes,
  },
  {
    database: 'SQLite',
    dataTypeHints: SQLiteTypes,
  },
];
