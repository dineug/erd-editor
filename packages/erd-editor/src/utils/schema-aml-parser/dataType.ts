import { Database } from '@/constants/schema';

import { AMLModel, AMLType } from './types';

/**
 * Every cell below is a name taken from that dialect's hint list under
 * @/constants/sql/dataType, so getPrimitiveType resolves it back to a
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

/**
 * enumValues carries the inline members, which never reach model.types. Both
 * entry points take them as a trailing optional argument, and inline members
 * take precedence over anything the name would resolve to.
 */
export function resolveDataType(
  typeName: string,
  database: number,
  model: AMLModel,
  enumValues: string[] = []
): string {
  const resolved = resolveType(typeName, model, enumValues);
  if (!resolved.members) {
    return resolved.typeName;
  }

  return (
    enumDataType(resolved.members, database) ??
    stringTypes[database] ??
    resolved.typeName
  );
}

/**
 * Keeps the members where the column type cannot hold them. Pass database to
 * drop it on the dialects whose ENUM(...) column already spells them out.
 */
export function enumCommentSuffix(
  typeName: string,
  model: AMLModel,
  database: number,
  enumValues: string[] = []
): string {
  const { members } = resolveType(typeName, model, enumValues);
  if (!members || enumDataType(members, database) !== undefined) {
    return '';
  }

  return ` ${typeName}: ${members.join(' | ')}`;
}

/**
 * Only MySQL.ts and MariaDB.ts list ENUM; every other dialect takes the string
 * fallback and leans on enumCommentSuffix to keep the members.
 */
function enumDataType(members: string[], database: number): string | undefined {
  if (database !== Database.MySQL && database !== Database.MariaDB) {
    return undefined;
  }

  return `ENUM(${members
    .map(member => `'${member.replace(/'/g, "''")}'`)
    .join(',')})`;
}

/**
 * Walks the alias chain until it lands on an enum or on a name model.types does
 * not hold. A struct and a custom type carry neither field, so they stop the
 * walk; seen is what makes a mutually aliased pair terminate.
 */
function resolveType(
  typeName: string,
  model: AMLModel,
  enumValues: string[]
): { typeName: string; members: string[] | null } {
  if (enumValues.length) {
    return { typeName, members: enumValues };
  }

  const seen = new Set<string>();
  let current = typeName;

  while (!seen.has(current)) {
    seen.add(current);

    const type = getType(current, model);
    if (!type) break;
    if (type.values.length) return { typeName: current, members: type.values };
    if (!type.alias) break;

    current = type.alias;
  }

  return { typeName: current, members: null };
}

/**
 * The reference parser cannot spell a scoped type in an attribute type
 * position, so an attribute only ever names a type bare. The qualified pass is
 * what lets namespace app + type app.status (...) still be found by name.
 */
function getType(typeName: string, model: AMLModel): AMLType | undefined {
  const type = model.types[typeName];
  if (type) {
    return type;
  }

  const qualified = Object.keys(model.types).find(
    name => name.slice(name.lastIndexOf('.') + 1) === typeName
  );

  return qualified === undefined ? undefined : model.types[qualified];
}
