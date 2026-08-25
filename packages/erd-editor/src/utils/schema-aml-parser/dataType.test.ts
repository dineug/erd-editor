import { describe, expect, it } from 'vite-plus/test';

import { Database, DatabaseList } from '@/constants/schema';
import {
  enumCommentSuffix,
  resolveDataType,
} from '@/utils/schema-aml-parser/dataType';
import { AMLModel, AMLType } from '@/utils/schema-aml-parser/types';

const EMPTY: AMLModel = { entities: [], relations: [], types: {}, skipped: [] };

const withTypes = (types: Record<string, AMLType>): AMLModel => ({
  ...EMPTY,
  types,
});

const enumType = (values: string[]): AMLType => ({ values, alias: '' });
const aliasType = (alias: string): AMLType => ({ values: [], alias });
/** A struct and a custom type carry neither field. */
const opaqueType = (): AMLType => ({ values: [], alias: '' });

const STATUS = withTypes({ post_status: enumType(['draft', 'published']) });

describe('schema-aml-parser/dataType', () => {
  describe('resolveDataType', () => {
    it.each([
      'int',
      'varchar(255)',
      'decimal(10,2)',
      'timestamptz',
      'jsonb',
      'varchar(255)[]',
    ])('passes %s through, because an AML type is a SQL type', typeName => {
      expect(resolveDataType(typeName, Database.PostgreSQL, EMPTY)).toBe(
        typeName
      );
    });

    it('passes an unknown name through rather than guessing', () => {
      expect(resolveDataType('citext', Database.PostgreSQL, EMPTY)).toBe(
        'citext'
      );
    });

    it.each([
      [Database.MySQL, "ENUM('draft','published')"],
      [Database.MariaDB, "ENUM('draft','published')"],
    ])(
      'spells an enum out on the dialect that has one',
      (database, expected) => {
        expect(resolveDataType('post_status', database, STATUS)).toBe(expected);
      }
    );

    it('doubles a quote inside an enum member', () => {
      expect(
        resolveDataType(
          'post_status',
          Database.MySQL,
          withTypes({ post_status: enumType(["it's"]) })
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
        expect(resolveDataType('post_status', database, STATUS)).toBe(expected);
      }
    );

    it('resolves to a name every dialect hint list holds', () => {
      DatabaseList.forEach(database => {
        expect(
          resolveDataType('post_status', database, STATUS).length
        ).toBeGreaterThan(0);
      });
    });

    it('finds a qualified type by its last segment', () => {
      expect(
        resolveDataType(
          'post_status',
          Database.MySQL,
          withTypes({ 'cms.post_status': enumType(['a']) })
        )
      ).toBe("ENUM('a')");
    });

    it('prefers the bare key over a qualified one', () => {
      expect(
        resolveDataType(
          'post_status',
          Database.MySQL,
          withTypes({
            'cms.post_status': enumType(['a']),
            post_status: enumType(['b']),
          })
        )
      ).toBe("ENUM('b')");
    });

    it('resolves an alias to its target', () => {
      expect(
        resolveDataType(
          'uid',
          Database.PostgreSQL,
          withTypes({ uid: aliasType('int') })
        )
      ).toBe('int');
    });

    it('follows an alias chain', () => {
      expect(
        resolveDataType(
          'id',
          Database.PostgreSQL,
          withTypes({
            id: aliasType('uid'),
            uid: aliasType('key'),
            key: aliasType('bigint'),
          })
        )
      ).toBe('bigint');
    });

    it('resolves an alias whose target is an enum', () => {
      expect(
        resolveDataType(
          'state',
          Database.MySQL,
          withTypes({
            state: aliasType('post_status'),
            post_status: enumType(['draft', 'published']),
          })
        )
      ).toBe("ENUM('draft','published')");
    });

    it('takes the string fallback for an aliased enum on a dialect with none', () => {
      expect(
        resolveDataType(
          'state',
          Database.PostgreSQL,
          withTypes({
            state: aliasType('post_status'),
            post_status: enumType(['draft', 'published']),
          })
        )
      ).toBe('varchar(255)');
    });

    it('stops on an alias cycle', () => {
      expect(
        resolveDataType(
          'a',
          Database.PostgreSQL,
          withTypes({ a: aliasType('b'), b: aliasType('a') })
        )
      ).toBe('a');
    });

    it('stops on an alias pointing at itself', () => {
      expect(
        resolveDataType(
          'a',
          Database.PostgreSQL,
          withTypes({ a: aliasType('a') })
        )
      ).toBe('a');
    });

    it('passes a struct through, because it has nothing to resolve to', () => {
      expect(
        resolveDataType(
          'point',
          Database.PostgreSQL,
          withTypes({ point: opaqueType() })
        )
      ).toBe('point');
    });

    it('passes a custom type through', () => {
      expect(
        resolveDataType('box', Database.MySQL, withTypes({ box: opaqueType() }))
      ).toBe('box');
    });

    it.each([
      [Database.MySQL, "ENUM('draft','published')"],
      [Database.PostgreSQL, 'varchar(255)'],
    ])('spells inline enum members out the same way', (database, expected) => {
      expect(
        resolveDataType('post_status', database, EMPTY, ['draft', 'published'])
      ).toBe(expected);
    });

    it('lets inline members win over the declared type of the same name', () => {
      expect(
        resolveDataType('post_status', Database.MySQL, STATUS, ['archived'])
      ).toBe("ENUM('archived')");
    });
  });

  describe('enumCommentSuffix', () => {
    it('keeps the members where the column type cannot hold them', () => {
      expect(
        enumCommentSuffix('post_status', STATUS, Database.PostgreSQL)
      ).toBe(' post_status: draft | published');
    });

    it('says nothing where the column already spells them out', () => {
      expect(enumCommentSuffix('post_status', STATUS, Database.MySQL)).toBe('');
    });

    it('says nothing for a type that is not an enum', () => {
      expect(enumCommentSuffix('varchar', STATUS, Database.PostgreSQL)).toBe(
        ''
      );
    });

    it('says nothing for a struct', () => {
      expect(
        enumCommentSuffix(
          'point',
          withTypes({ point: opaqueType() }),
          Database.PostgreSQL
        )
      ).toBe('');
    });

    it('says nothing for an enum with no member', () => {
      expect(
        enumCommentSuffix(
          'empty',
          withTypes({ empty: enumType([]) }),
          Database.PostgreSQL
        )
      ).toBe('');
    });

    it('names the written type, not the alias target', () => {
      expect(
        enumCommentSuffix(
          'state',
          withTypes({
            state: aliasType('post_status'),
            post_status: enumType(['draft', 'published']),
          }),
          Database.PostgreSQL
        )
      ).toBe(' state: draft | published');
    });

    it('keeps inline members too', () => {
      expect(
        enumCommentSuffix('post_status', EMPTY, Database.PostgreSQL, [
          'draft',
          'published',
        ])
      ).toBe(' post_status: draft | published');
    });

    it('says nothing for inline members the column spells out', () => {
      expect(
        enumCommentSuffix('post_status', EMPTY, Database.MySQL, ['draft'])
      ).toBe('');
    });
  });
});
