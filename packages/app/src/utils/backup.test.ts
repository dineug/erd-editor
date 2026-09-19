import { DateTime } from 'luxon';
import { describe, expect, it } from 'vite-plus/test';

import type { SchemaEntity } from '@/services/indexeddb/modules/schema';
import {
  BACKUP_FORMAT,
  backupFileName,
  createBackup,
  isBackup,
  isSchemaValue,
  parseBackup,
} from '@/utils/backup';

const NOW = DateTime.fromISO('2026-09-19T23:30:00', { zone: 'Asia/Seoul' });
const IMPORTED = NOW.toMillis();
const VALUE = JSON.stringify({ version: '3.0.0', doc: {} });

const entity = (
  name: string,
  updateAt: number,
  extra: Partial<SchemaEntity> = {}
): SchemaEntity => ({
  id: `id-${name}`,
  name,
  value: VALUE,
  createAt: 1,
  updateAt,
  ...extra,
});

describe('createBackup', () => {
  it('keeps name, value and times of every schema outside the trash', () => {
    const backup = createBackup(
      [
        entity('Orders', 10),
        entity('Old', 30, { deletedAt: 40 }),
        entity('Blog', 20, { deletedAt: null }),
      ],
      NOW
    );

    expect(backup).toEqual({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: NOW.toMillis(),
      schemas: [
        { name: 'Blog', value: VALUE, createAt: 1, updateAt: 20 },
        { name: 'Orders', value: VALUE, createAt: 1, updateAt: 10 },
      ],
    });
  });

  it('leaves the input array alone', () => {
    const input = [entity('a', 1), entity('b', 2)];

    createBackup(input, NOW);

    expect(input.map(({ name }) => name)).toEqual(['a', 'b']);
  });
});

describe('backupFileName', () => {
  it('names the file after the local calendar day', () => {
    expect(backupFileName(NOW)).toBe('erd-editor-backup-2026-09-19.json');
    expect(backupFileName(NOW.setZone('UTC'))).toBe(
      'erd-editor-backup-2026-09-19.json'
    );
    expect(backupFileName(NOW.plus({ hours: 1 }))).toBe(
      'erd-editor-backup-2026-09-20.json'
    );
  });
});

describe('isSchemaValue', () => {
  it('takes the empty value of a schema never opened', () => {
    expect(isSchemaValue('')).toBe(true);
  });

  it('takes a JSON object', () => {
    expect(isSchemaValue(VALUE)).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isSchemaValue('[]')).toBe(false);
    expect(isSchemaValue('42')).toBe(false);
    expect(isSchemaValue('{')).toBe(false);
    expect(isSchemaValue(42)).toBe(false);
    expect(isSchemaValue(undefined)).toBe(false);
  });
});

describe('isBackup', () => {
  it('tells a backup by its format field', () => {
    expect(isBackup({ format: BACKUP_FORMAT })).toBe(true);
    expect(isBackup({ format: 'something-else' })).toBe(false);
    expect(isBackup([{ format: BACKUP_FORMAT }])).toBe(false);
    expect(isBackup(null)).toBe(false);
  });
});

describe('parseBackup', () => {
  it('reads back what createBackup wrote', () => {
    const backup = createBackup([entity('Orders', 10)], NOW);

    expect(parseBackup(JSON.parse(JSON.stringify(backup)), IMPORTED)).toEqual({
      schemas: [{ name: 'Orders', value: VALUE, createAt: 1, updateAt: 10 }],
      skipped: 0,
    });
  });

  it('skips each broken entry on its own', () => {
    const valid = { name: 'Orders', value: '', createAt: 1, updateAt: 2 };

    expect(
      parseBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          schemas: [
            valid,
            null,
            'Orders',
            { ...valid, name: '  ' },
            { ...valid, name: 7 },
            { ...valid, value: '{' },
            { ...valid, value: undefined },
            { ...valid, createAt: -1 },
            { ...valid, updateAt: Number.NaN },
            { ...valid, updateAt: '2' },
          ],
        },
        IMPORTED
      )
    ).toEqual({ schemas: [valid], skipped: 9 });
  });

  it('refuses a time a Date cannot hold', () => {
    const valid = { name: 'Orders', value: '', createAt: 1, updateAt: 2 };

    expect(
      parseBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          schemas: [
            { ...valid, updateAt: 1e300 },
            { ...valid, createAt: 8.64e15 + 1 },
            { ...valid, updateAt: Number.POSITIVE_INFINITY },
          ],
        },
        IMPORTED
      )
    ).toEqual({ schemas: [], skipped: 3 });
  });

  it('takes a time after the import as the import time', () => {
    const later = IMPORTED + 24 * 60 * 60 * 1000;

    expect(
      parseBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          schemas: [
            { name: 'Future', value: '', createAt: later, updateAt: 8.64e15 },
            { name: 'Past', value: '', createAt: 1, updateAt: IMPORTED },
          ],
        },
        IMPORTED
      )?.schemas
    ).toEqual([
      { name: 'Future', value: '', createAt: IMPORTED, updateAt: IMPORTED },
      { name: 'Past', value: '', createAt: 1, updateAt: IMPORTED },
    ]);
  });

  it('drops extra fields such as ids and trash marks', () => {
    expect(
      parseBackup(
        {
          format: BACKUP_FORMAT,
          version: 1,
          schemas: [
            {
              id: 'x',
              name: 'Orders',
              value: '',
              createAt: 1,
              updateAt: 2,
              deletedAt: 3,
            },
          ],
        },
        IMPORTED
      )?.schemas
    ).toEqual([{ name: 'Orders', value: '', createAt: 1, updateAt: 2 }]);
  });

  it('refuses a version it does not know', () => {
    expect(
      parseBackup({ format: BACKUP_FORMAT, version: 2, schemas: [] }, IMPORTED)
    ).toBeNull();
  });

  it('refuses a backup without a schema list', () => {
    expect(
      parseBackup({ format: BACKUP_FORMAT, version: 1, schemas: {} }, IMPORTED)
    ).toBeNull();
  });

  it('refuses anything that is not a backup', () => {
    expect(parseBackup({ version: 1, schemas: [] }, IMPORTED)).toBeNull();
  });
});
