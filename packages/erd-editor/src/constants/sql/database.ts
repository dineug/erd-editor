import { Database } from '@/constants/schema';
import { ValuesType } from '@/internal-types';

export const DatabaseVendor = {
  MariaDB: 'MariaDB',
  MSSQL: 'MSSQL',
  MySQL: 'MySQL',
  Oracle: 'Oracle',
  PostgreSQL: 'PostgreSQL',
  Snowflake: 'Snowflake',
  SQLite: 'SQLite',
} as const;
export type DatabaseVendor = ValuesType<typeof DatabaseVendor>;
export const DatabaseVendorList: ReadonlyArray<string> =
  Object.values(DatabaseVendor);

export const DatabaseVendorToDatabase: Record<DatabaseVendor, number> = {
  [DatabaseVendor.MariaDB]: Database.MariaDB,
  [DatabaseVendor.MSSQL]: Database.MSSQL,
  [DatabaseVendor.MySQL]: Database.MySQL,
  [DatabaseVendor.Oracle]: Database.Oracle,
  [DatabaseVendor.PostgreSQL]: Database.PostgreSQL,
  [DatabaseVendor.Snowflake]: Database.Snowflake,
  [DatabaseVendor.SQLite]: Database.SQLite,
};
