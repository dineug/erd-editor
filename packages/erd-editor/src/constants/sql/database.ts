import { Database } from '@/constants/schema';
import { ValuesType } from '@/internal-types';

export const DatabaseVendor = {
  MariaDB: 'MariaDB',
  MSSQL: 'MSSQL',
  MySQL: 'MySQL',
  Oracle: 'Oracle',
  PostgreSQL: 'PostgreSQL',
  SQLite: 'SQLite',
} as const;
export type DatabaseVendor = ValuesType<typeof DatabaseVendor>;
export const DatabaseVendorList: ReadonlyArray<string> =
  Object.values(DatabaseVendor);

export const DatabaseToDatabaseVendor: Record<number, DatabaseVendor> = {
  [Database.MariaDB]: DatabaseVendor.MariaDB,
  [Database.MSSQL]: DatabaseVendor.MSSQL,
  [Database.MySQL]: DatabaseVendor.MySQL,
  [Database.Oracle]: DatabaseVendor.Oracle,
  [Database.PostgreSQL]: DatabaseVendor.PostgreSQL,
  [Database.SQLite]: DatabaseVendor.SQLite,
};
