import { describe, expect, it } from 'vite-plus/test';

import { Database, DatabaseList } from '@/constants/schema';
import {
  DatabaseVendor,
  DatabaseVendorList,
  DatabaseVendorToDatabase,
} from '@/constants/sql/database';

describe('DatabaseVendor', () => {
  it('lists every supported vendor with the key as its own value', () => {
    expect(DatabaseVendor).toEqual({
      Databricks: 'Databricks',
      MariaDB: 'MariaDB',
      MSSQL: 'MSSQL',
      MySQL: 'MySQL',
      Oracle: 'Oracle',
      PostgreSQL: 'PostgreSQL',
      Snowflake: 'Snowflake',
      SQLite: 'SQLite',
    });

    for (const [key, value] of Object.entries(DatabaseVendor)) {
      expect(value).toBe(key);
    }
  });
});

describe('DatabaseVendorList', () => {
  it('is the alphabetically ordered vendor name list', () => {
    expect(DatabaseVendorList).toEqual([
      'Databricks',
      'MariaDB',
      'MSSQL',
      'MySQL',
      'Oracle',
      'PostgreSQL',
      'Snowflake',
      'SQLite',
    ]);
  });

  it('mirrors Object.values(DatabaseVendor) without duplicates', () => {
    expect([...DatabaseVendorList]).toEqual(Object.values(DatabaseVendor));
    expect(new Set(DatabaseVendorList).size).toBe(DatabaseVendorList.length);
  });
});

describe('DatabaseVendorToDatabase', () => {
  it('maps each vendor name to its Database flag', () => {
    expect(DatabaseVendorToDatabase).toEqual({
      Databricks: Database.Databricks,
      MariaDB: Database.MariaDB,
      MSSQL: Database.MSSQL,
      MySQL: Database.MySQL,
      Oracle: Database.Oracle,
      PostgreSQL: Database.PostgreSQL,
      Snowflake: Database.Snowflake,
      SQLite: Database.SQLite,
    });
  });

  it('resolves the concrete bit flags used by the settings state', () => {
    expect(DatabaseVendorToDatabase.MariaDB).toBe(1);
    expect(DatabaseVendorToDatabase.MSSQL).toBe(2);
    expect(DatabaseVendorToDatabase.MySQL).toBe(4);
    expect(DatabaseVendorToDatabase.Oracle).toBe(8);
    expect(DatabaseVendorToDatabase.PostgreSQL).toBe(16);
    expect(DatabaseVendorToDatabase.SQLite).toBe(32);
    expect(DatabaseVendorToDatabase.Databricks).toBe(64);
    expect(DatabaseVendorToDatabase.Snowflake).toBe(128);
  });

  it('is a bijection onto DatabaseList', () => {
    const flags = Object.values(DatabaseVendorToDatabase);

    expect(new Set(flags).size).toBe(flags.length);
    expect(flags.sort((a, b) => a - b)).toEqual(
      [...DatabaseList].sort((a, b) => a - b)
    );
    expect(Object.keys(DatabaseVendorToDatabase)).toHaveLength(
      DatabaseVendorList.length
    );
  });

  it('returns undefined for a name that is not a vendor', () => {
    const map = DatabaseVendorToDatabase as Record<string, number | undefined>;

    expect(map['mysql']).toBeUndefined();
    expect(map['']).toBeUndefined();
    expect(map['Postgres']).toBeUndefined();
  });
});
