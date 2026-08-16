import { describe, expect, it } from 'vite-plus/test';

import { Database, DatabaseList } from '@/constants/schema';
import { DatabaseHintMap, PrimitiveType } from '@/constants/sql/dataType';
import { MariaDBTypes } from '@/constants/sql/dataType/MariaDB';
import { MSSQLTypes } from '@/constants/sql/dataType/MSSQL';
import { MySQLTypes } from '@/constants/sql/dataType/MySQL';
import { OracleTypes } from '@/constants/sql/dataType/Oracle';
import { PostgreSQLTypes } from '@/constants/sql/dataType/PostgreSQL';
import { SQLiteTypes } from '@/constants/sql/dataType/SQLite';

describe('PrimitiveType', () => {
  it('lists every generator-code primitive with the key as its own value', () => {
    expect(PrimitiveType).toEqual({
      int: 'int',
      long: 'long',
      float: 'float',
      double: 'double',
      decimal: 'decimal',
      boolean: 'boolean',
      string: 'string',
      lob: 'lob',
      date: 'date',
      dateTime: 'dateTime',
      time: 'time',
    });

    for (const [key, value] of Object.entries(PrimitiveType)) {
      expect(value).toBe(key);
    }
  });

  it('contains the fallback type returned by getPrimitiveType', () => {
    expect(Object.values(PrimitiveType)).toContain('string');
  });
});

describe('DatabaseHintMap', () => {
  it('maps each Database flag to that vendor hint list', () => {
    expect(DatabaseHintMap[Database.MariaDB]).toBe(MariaDBTypes);
    expect(DatabaseHintMap[Database.MSSQL]).toBe(MSSQLTypes);
    expect(DatabaseHintMap[Database.MySQL]).toBe(MySQLTypes);
    expect(DatabaseHintMap[Database.Oracle]).toBe(OracleTypes);
    expect(DatabaseHintMap[Database.PostgreSQL]).toBe(PostgreSQLTypes);
    expect(DatabaseHintMap[Database.SQLite]).toBe(SQLiteTypes);
  });

  it('covers every entry of DatabaseList exactly once', () => {
    expect(Object.keys(DatabaseHintMap)).toHaveLength(DatabaseList.length);

    for (const database of DatabaseList) {
      expect(Array.isArray(DatabaseHintMap[database])).toBe(true);
      expect(DatabaseHintMap[database].length).toBeGreaterThan(0);
    }

    const lists = Object.values(DatabaseHintMap);
    expect(new Set(lists).size).toBe(lists.length);
  });

  it('returns undefined for an unknown database flag', () => {
    expect(DatabaseHintMap[0]).toBeUndefined();
    expect(DatabaseHintMap[Database.MySQL | Database.SQLite]).toBeUndefined();
    expect(DatabaseHintMap[1024]).toBeUndefined();
  });

  it('only holds hints whose primitiveType is a known PrimitiveType', () => {
    const primitiveTypes = new Set<string>(Object.values(PrimitiveType));

    for (const database of DatabaseList) {
      for (const hint of DatabaseHintMap[database]) {
        expect(typeof hint.name).toBe('string');
        expect(hint.name.trim()).toBe(hint.name);
        expect(hint.name.length).toBeGreaterThan(0);
        expect(primitiveTypes.has(hint.primitiveType)).toBe(true);
        expect(Object.keys(hint).sort()).toEqual(['name', 'primitiveType']);
      }
    }
  });

  it('never repeats a data type name within one vendor', () => {
    for (const database of DatabaseList) {
      const names = DatabaseHintMap[database].map(hint =>
        hint.name.toLowerCase()
      );
      expect(new Set(names).size).toBe(names.length);
    }
  });
});
