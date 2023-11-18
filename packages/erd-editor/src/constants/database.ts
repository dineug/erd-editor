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
