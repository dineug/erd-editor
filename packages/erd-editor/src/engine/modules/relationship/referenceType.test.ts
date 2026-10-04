import { describe, expect, it } from 'vite-plus/test';

import { Database, DatabaseList } from '@/constants/schema';
import {
  isSerialType,
  toReferenceDataType,
} from '@/engine/modules/relationship/referenceType';

describe('toReferenceDataType', () => {
  it.each([
    ['serial4', 'integer'],
    ['smallserial', 'smallint'],
    ['serial2', 'smallint'],
    ['bigserial', 'bigint'],
    ['serial8', 'bigint'],
  ])(
    'gives %s the PostgreSQL integer %s under every database',
    (dataType, expected) => {
      for (const database of DatabaseList) {
        expect(toReferenceDataType(dataType, database)).toBe(expected);
      }
    }
  );

  it.each([
    [Database.PostgreSQL, 'integer'],
    [Database.MySQL, 'bigint unsigned'],
    [Database.MariaDB, 'bigint unsigned'],
  ])(
    'gives a bare serial what database %i stores for it',
    (database, expected) => {
      expect(toReferenceDataType('serial', database)).toBe(expected);
    }
  );

  it.each([
    Database.MSSQL,
    Database.Oracle,
    Database.SQLite,
    Database.Databricks,
    Database.Snowflake,
  ])('keeps a bare serial under database %i, which has none', database => {
    expect(toReferenceDataType('serial', database)).toBe('serial');
    expect(toReferenceDataType('SERIAL', database)).toBe('SERIAL');
  });

  it('writes capitals for a type written in capitals and lower case otherwise', () => {
    expect(toReferenceDataType('SERIAL', Database.MySQL)).toBe(
      'BIGINT UNSIGNED'
    );
    expect(toReferenceDataType('SERIAL', Database.PostgreSQL)).toBe('INTEGER');
    expect(toReferenceDataType('BIGSERIAL', Database.MySQL)).toBe('BIGINT');
    expect(toReferenceDataType('SERIAL4', Database.MySQL)).toBe('INTEGER');
    expect(toReferenceDataType('Serial', Database.PostgreSQL)).toBe('integer');
    expect(toReferenceDataType('bigSerial', Database.PostgreSQL)).toBe(
      'bigint'
    );
  });

  it('matches the whole name once trimmed, without case', () => {
    expect(toReferenceDataType('  serial8 ', Database.MySQL)).toBe('bigint');
    expect(toReferenceDataType('\tSERIAL\n', Database.PostgreSQL)).toBe(
      'INTEGER'
    );
  });

  it.each([
    'serial(4)',
    'serial primary key',
    'bigserial not null',
    'serial 4',
    'serials',
    'myserial',
    'serial16',
  ])('keeps %s, which carries more than a serial name', dataType => {
    expect(toReferenceDataType(dataType, Database.PostgreSQL)).toBe(dataType);
  });

  it('keeps any other type exactly as written, spaces included', () => {
    expect(toReferenceDataType(' int ', Database.PostgreSQL)).toBe(' int ');
    expect(toReferenceDataType('VARCHAR(255)', Database.MySQL)).toBe(
      'VARCHAR(255)'
    );
    expect(toReferenceDataType('', Database.MySQL)).toBe('');
  });

  it('reads no name off the object prototype', () => {
    expect(toReferenceDataType('constructor', Database.PostgreSQL)).toBe(
      'constructor'
    );
    expect(toReferenceDataType('__proto__', Database.PostgreSQL)).toBe(
      '__proto__'
    );
  });
});

describe('isSerialType', () => {
  it.each([
    'serial',
    'SERIAL',
    ' Serial ',
    'serial2',
    'serial4',
    'serial8',
    'smallserial',
    'BIGSERIAL',
  ])('tells %s for a serial type', dataType => {
    expect(isSerialType(dataType)).toBe(true);
  });

  it.each(['', 'int', 'integer', 'serial(4)', 'serial primary key', 'serials'])(
    'tells %s for none',
    dataType => {
      expect(isSerialType(dataType)).toBe(false);
    }
  );
});
