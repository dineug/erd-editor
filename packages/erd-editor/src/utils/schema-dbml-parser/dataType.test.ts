import { describe, expect, it } from 'vite-plus/test';

import { Database, DatabaseList } from '@/constants/schema';
import {
  enumCommentSuffix,
  resolveDataType,
} from '@/utils/schema-dbml-parser/dataType';
import { DBMLModel } from '@/utils/schema-dbml-parser/types';

const EMPTY: DBMLModel = { tables: [], refs: [], enums: {}, skipped: [] };

const withEnums = (enums: Record<string, string[]>): DBMLModel => ({
  ...EMPTY,
  enums,
});

const STATUS = withEnums({ status: ['created', 'shipped'] });

describe('schema-dbml-parser/dataType', () => {
  describe('resolveDataType', () => {
    it.each([
      'int',
      'varchar(255)',
      'decimal(10,2)',
      'character varying(255)',
      'timestamptz',
      'jsonb',
      'varchar(255)[]',
    ])('passes %s through, because a DBML type is a SQL type', typeName => {
      expect(resolveDataType(typeName, '', Database.PostgreSQL, EMPTY)).toBe(
        typeName
      );
    });

    it('passes an unknown name through rather than guessing', () => {
      expect(resolveDataType('citext', '', Database.PostgreSQL, EMPTY)).toBe(
        'citext'
      );
    });

    it.each([
      [Database.MySQL, "ENUM('created','shipped')"],
      [Database.MariaDB, "ENUM('created','shipped')"],
    ])(
      'spells an enum out on the dialect that has one',
      (database, expected) => {
        expect(resolveDataType('status', '', database, STATUS)).toBe(expected);
      }
    );

    it('doubles a quote inside an enum member', () => {
      expect(
        resolveDataType(
          'status',
          '',
          Database.MySQL,
          withEnums({
            status: ["it's"],
          })
        )
      ).toBe("ENUM('it''s')");
    });

    it.each([
      [Database.MSSQL, 'varchar(255)'],
      [Database.Oracle, 'VARCHAR2(255)'],
      [Database.PostgreSQL, 'varchar(255)'],
      [Database.SQLite, 'TEXT'],
      [Database.Databricks, 'STRING'],
      [Database.Snowflake, 'VARCHAR(255)'],
    ])(
      'falls back to the string column on a dialect with no enum',
      (database, expected) => {
        expect(resolveDataType('status', '', database, STATUS)).toBe(expected);
      }
    );

    it('resolves a schema-qualified enum', () => {
      expect(
        resolveDataType(
          'status',
          'app',
          Database.MySQL,
          withEnums({ 'app.status': ['a'] })
        )
      ).toBe("ENUM('a')");
    });

    it('falls back to the bare name when the schema does not match', () => {
      expect(resolveDataType('status', 'other', Database.MySQL, STATUS)).toBe(
        "ENUM('created','shipped')"
      );
    });

    it('resolves to a name every dialect hint list holds', () => {
      DatabaseList.forEach(database => {
        expect(
          resolveDataType('status', '', database, STATUS).length
        ).toBeGreaterThan(0);
      });
    });
  });

  describe('enumCommentSuffix', () => {
    it('keeps the members where the column type cannot hold them', () => {
      expect(enumCommentSuffix('status', '', STATUS, Database.PostgreSQL)).toBe(
        ' status: created | shipped'
      );
    });

    it('says nothing where the column already spells them out', () => {
      expect(enumCommentSuffix('status', '', STATUS, Database.MySQL)).toBe('');
    });

    it('says nothing for a type that is not an enum', () => {
      expect(
        enumCommentSuffix('varchar', '', STATUS, Database.PostgreSQL)
      ).toBe('');
    });

    it('resolves a schema-qualified enum', () => {
      expect(
        enumCommentSuffix(
          'status',
          'app',
          withEnums({ 'app.status': ['a', 'b'] }),
          Database.PostgreSQL
        )
      ).toBe(' status: a | b');
    });

    it('says nothing for an enum with no member', () => {
      expect(
        enumCommentSuffix('empty', '', withEnums({ empty: [] }), Database.MySQL)
      ).toBe('');
    });
  });
});
