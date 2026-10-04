import { Database } from '@/constants/schema';

const SERIAL = 'serial';

/** The serial types only PostgreSQL has, each with the integer type it stores. */
const POSTGRESQL_SERIALS: ReadonlyMap<string, string> = new Map([
  ['smallserial', 'smallint'],
  ['serial2', 'smallint'],
  ['serial4', 'integer'],
  ['bigserial', 'bigint'],
  ['serial8', 'bigint'],
]);

/** What a bare serial stores in each database that has one. */
const SERIAL_BY_DATABASE: ReadonlyMap<number, string> = new Map([
  [Database.PostgreSQL, 'integer'],
  [Database.MySQL, 'bigint unsigned'],
  [Database.MariaDB, 'bigint unsigned'],
]);

const toTypeKey = (dataType: string) => dataType.trim().toLowerCase();

/**
 * Tells a serial type, serial or one of PostgreSQL's own, by its whole name
 * without case once trimmed, whatever the database; serial(4) is none.
 */
export const isSerialType = (dataType: string) => {
  const key = toTypeKey(dataType);
  return key === SERIAL || POSTGRESQL_SERIALS.has(key);
};

/**
 * The data type a foreign key takes from its key: the integer a serial key
 * stores, in capitals when the key's type is written in capitals, and any other
 * type as it is, a bare serial kept where the database has none.
 */
export function toReferenceDataType(dataType: string, database: number) {
  const key = toTypeKey(dataType);
  const reference =
    key === SERIAL
      ? SERIAL_BY_DATABASE.get(database)
      : POSTGRESQL_SERIALS.get(key);
  if (!reference) return dataType;

  const name = dataType.trim();
  return name === name.toUpperCase() ? reference.toUpperCase() : reference;
}
