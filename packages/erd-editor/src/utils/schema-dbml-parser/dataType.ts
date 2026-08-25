import { Database } from '@/constants/schema';

import { DBMLModel } from './types';

/**
 * Every cell below is a name taken from that dialect's hint list under
 * `@/constants/sql/dataType`, so `getPrimitiveType` resolves it back to a
 * primitive the code generators understand.
 */
const stringTypes: Record<number, string> = {
  [Database.MariaDB]: 'VARCHAR(255)',
  [Database.MSSQL]: 'varchar(255)',
  [Database.MySQL]: 'VARCHAR(255)',
  [Database.Oracle]: 'VARCHAR2(255)',
  [Database.PostgreSQL]: 'varchar(255)',
  [Database.SQLite]: 'TEXT',
  [Database.Databricks]: 'STRING',
  [Database.Snowflake]: 'VARCHAR(255)',
};

export function resolveDataType(
  typeName: string,
  typeSchemaName: string,
  database: number,
  model: DBMLModel
): string {
  const members = getMembers(typeName, typeSchemaName, model);
  if (!members) {
    return typeName;
  }

  return enumDataType(members, database) ?? stringTypes[database] ?? typeName;
}

/**
 * Keeps the members where the column type cannot hold them. Pass `database` to
 * drop it on the dialects whose `ENUM(...)` column already spells them out.
 */
export function enumCommentSuffix(
  typeName: string,
  typeSchemaName: string,
  model: DBMLModel,
  database: number
): string {
  const members = getMembers(typeName, typeSchemaName, model);
  if (!members || enumDataType(members, database) !== undefined) {
    return '';
  }

  return ` ${typeName}: ${members.join(' | ')}`;
}

/**
 * Only MySQL.ts and MariaDB.ts list ENUM; every other dialect takes the string
 * fallback and leans on `enumCommentSuffix` to keep the members.
 */
function enumDataType(members: string[], database: number): string | undefined {
  if (database !== Database.MySQL && database !== Database.MariaDB) {
    return undefined;
  }

  return `ENUM(${members
    .map(member => `'${member.replace(/'/g, "''")}'`)
    .join(',')})`;
}

function getMembers(
  typeName: string,
  typeSchemaName: string,
  model: DBMLModel
): string[] | null {
  const qualified = typeSchemaName ? `${typeSchemaName}.${typeName}` : '';

  return model.enums[qualified] ?? model.enums[typeName] ?? null;
}
