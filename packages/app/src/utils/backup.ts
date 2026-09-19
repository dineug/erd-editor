import { isPlainObject } from 'es-toolkit';
import { DateTime } from 'luxon';

import type {
  NewSchemaEntity,
  SchemaEntity,
} from '@/services/indexeddb/modules/schema';

export const BACKUP_FORMAT = 'erd-editor-app-backup';
export const BACKUP_VERSION = 1;

export type BackupSchema = Pick<
  SchemaEntity,
  'name' | 'value' | 'createAt' | 'updateAt'
>;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: number;
  schemas: BackupSchema[];
};

export type ParsedBackup = {
  schemas: NewSchemaEntity[];
  skipped: number;
};

/** The last millisecond a Date can hold; a larger number makes an Invalid Date. */
const MAX_DATE = 8.64e15;

const isTimestamp = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value <= MAX_DATE;

/** A saved value is empty for a schema never opened, and a JSON object otherwise. */
export function isSchemaValue(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value === '') return true;

  try {
    return isPlainObject(JSON.parse(value));
  } catch {
    return false;
  }
}

/** Every schema outside the trash, newest edit first, without ids or trash marks. */
export function createBackup(entities: SchemaEntity[], now: DateTime): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toMillis(),
    schemas: entities
      .filter(entity => typeof entity.deletedAt !== 'number')
      .sort((a, b) => b.updateAt - a.updateAt)
      .map(({ name, value, createAt, updateAt }) => ({
        name,
        value,
        createAt,
        updateAt,
      })),
  };
}

export function backupFileName(now: DateTime) {
  return `erd-editor-backup-${now.toFormat('yyyy-MM-dd')}.json`;
}

export function isBackup(json: unknown): json is { format: string } {
  return isPlainObject(json) && Reflect.get(json, 'format') === BACKUP_FORMAT;
}

function toNewSchemaEntity(item: unknown, now: number): NewSchemaEntity | null {
  if (!isPlainObject(item)) return null;

  const { name, value, createAt, updateAt } = item as Record<string, unknown>;
  if (typeof name !== 'string' || !name.trim()) return null;
  if (!isSchemaValue(value)) return null;
  if (!isTimestamp(createAt) || !isTimestamp(updateAt)) return null;

  // A time ahead of the import would hold the top of the list until it passed.
  return {
    name,
    value,
    createAt: Math.min(createAt, now),
    updateAt: Math.min(updateAt, now),
  };
}

/**
 * The schemas of a parsed backup file, each checked on its own so one broken
 * entry costs only itself. A version this app does not know, or a file without
 * a schema list, gives null. Times later than now are taken as now.
 */
export function parseBackup(json: unknown, now: number): ParsedBackup | null {
  if (!isBackup(json)) return null;

  const { version, schemas } = json as Record<string, unknown>;
  if (version !== BACKUP_VERSION || !Array.isArray(schemas)) return null;

  const result: ParsedBackup = { schemas: [], skipped: 0 };
  for (const item of schemas) {
    const schema = toNewSchemaEntity(item, now);
    schema ? result.schemas.push(schema) : (result.skipped += 1);
  }

  return result;
}
