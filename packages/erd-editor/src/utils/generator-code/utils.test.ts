import { describe, expect, it } from 'vite-plus/test';

import { underTurkishLocale } from '@/__test-utils__/locale';
import {
  Database,
  NameCase,
  ReferentialAction,
  RelationshipType,
} from '@/constants/schema';
import { MySQLTypes } from '@/constants/sql/dataType/MySQL';
import { PostgreSQLTypes } from '@/constants/sql/dataType/PostgreSQL';
import {
  baseTypeName,
  escapeTypeScriptDirective,
  findDataTypeHint,
  fractionalNumber,
  getDataTypeHints,
  getNameCase,
  getPrimitiveType,
  hasNRelationship,
  hasOneRelationship,
  LINE_TERMINATOR,
  referentialActionEntries,
  splitLines,
} from '@/utils/generator-code/utils';
import { referentialActionSupport } from '@/utils/schema-sql/utils';

describe('generator-code/utils', () => {
  describe('hasOneRelationship', () => {
    it('is true only for ZeroOne and OneOnly', () => {
      expect(hasOneRelationship(RelationshipType.ZeroOne)).toBe(true);
      expect(hasOneRelationship(RelationshipType.OneOnly)).toBe(true);
      expect(hasOneRelationship(RelationshipType.ZeroN)).toBe(false);
      expect(hasOneRelationship(RelationshipType.OneN)).toBe(false);
      expect(hasOneRelationship(0)).toBe(false);
    });
  });

  describe('hasNRelationship', () => {
    it('is true only for ZeroN and OneN', () => {
      expect(hasNRelationship(RelationshipType.ZeroN)).toBe(true);
      expect(hasNRelationship(RelationshipType.OneN)).toBe(true);
      expect(hasNRelationship(RelationshipType.ZeroOne)).toBe(false);
      expect(hasNRelationship(RelationshipType.OneOnly)).toBe(false);
      expect(hasNRelationship(0)).toBe(false);
    });
  });

  describe('getDataTypeHints', () => {
    it('returns the hint list registered for the database', () => {
      expect(getDataTypeHints(Database.MySQL)).toBe(MySQLTypes);
      expect(getDataTypeHints(Database.PostgreSQL)).toBe(PostgreSQLTypes);
    });

    it('returns an empty list for an unknown database', () => {
      expect(getDataTypeHints(0)).toEqual([]);
      expect(getDataTypeHints(-1)).toEqual([]);
    });
  });

  describe('getPrimitiveType', () => {
    it('maps a data type by prefix, case-insensitively', () => {
      expect(getPrimitiveType('INT', Database.MySQL)).toBe('int');
      expect(getPrimitiveType('int', Database.MySQL)).toBe('int');
      expect(getPrimitiveType('BIGINT', Database.MySQL)).toBe('long');
      expect(getPrimitiveType('VARCHAR(100)', Database.MySQL)).toBe('string');
      expect(getPrimitiveType('decimal(10, 2)', Database.MySQL)).toBe(
        'decimal'
      );
      expect(getPrimitiveType('DOUBLE', Database.MySQL)).toBe('double');
      expect(getPrimitiveType('FLOAT', Database.MySQL)).toBe('float');
      expect(getPrimitiveType('BOOLEAN', Database.MySQL)).toBe('boolean');
      expect(getPrimitiveType('TEXT', Database.MySQL)).toBe('lob');
      expect(getPrimitiveType('DATE', Database.MySQL)).toBe('date');
      expect(getPrimitiveType('TIME', Database.MySQL)).toBe('time');
    });

    it('falls back to string for an unknown data type', () => {
      expect(getPrimitiveType('NOT_A_TYPE', Database.MySQL)).toBe('string');
      expect(getPrimitiveType('', Database.MySQL)).toBe('string');
    });

    it('falls back to string when the database has no hints', () => {
      expect(getPrimitiveType('INT', 0)).toBe('string');
    });

    it('matches a name in another letter case under a Turkish default locale', () => {
      underTurkishLocale(() => {
        expect(getPrimitiveType('INTEGER', Database.PostgreSQL)).toBe('int');
        expect(getPrimitiveType('int', Database.MySQL)).toBe('int');
        expect(getPrimitiveType('datetime', Database.MySQL)).toBe('dateTime');
      });
    });

    it('resolves to the longest prefix match, so DATETIME and TIMESTAMP report dateTime', () => {
      // DATE precedes DATETIME and TIME precedes TIMESTAMP in
      // MySQLTypes, but the longer hint has to win over the shorter prefix.
      expect(getPrimitiveType('DATETIME', Database.MySQL)).toBe('dateTime');
      expect(getPrimitiveType('TIMESTAMP', Database.MySQL)).toBe('dateTime');
      expect(getPrimitiveType('datetime(6)', Database.MariaDB)).toBe(
        'dateTime'
      );
      expect(getPrimitiveType('TIMESTAMP', Database.MariaDB)).toBe('dateTime');
      expect(getPrimitiveType('datetime2(7)', Database.MSSQL)).toBe('dateTime');
      expect(getPrimitiveType('datetimeoffset', Database.MSSQL)).toBe(
        'dateTime'
      );
      expect(getPrimitiveType('TIMESTAMP', Database.Oracle)).toBe('dateTime');
      expect(getPrimitiveType('int8', Database.PostgreSQL)).toBe('long');
      expect(getPrimitiveType('serial8', Database.PostgreSQL)).toBe('long');
      expect(getPrimitiveType('interval', Database.PostgreSQL)).toBe('time');
      expect(getPrimitiveType('timestamptz', Database.PostgreSQL)).toBe(
        'dateTime'
      );
      expect(
        getPrimitiveType('timestamp with time zone', Database.PostgreSQL)
      ).toBe('dateTime');
    });

    it('keeps resolving the shorter hint when no longer hint matches', () => {
      expect(getPrimitiveType('DATE', Database.MySQL)).toBe('date');
      expect(getPrimitiveType('TIME', Database.MySQL)).toBe('time');
      expect(getPrimitiveType('INT(11)', Database.PostgreSQL)).toBe('int');
      expect(getPrimitiveType('timetz', Database.PostgreSQL)).toBe('time');
      expect(getPrimitiveType('smalldatetime', Database.MSSQL)).toBe(
        'dateTime'
      );
      expect(getPrimitiveType('LONG RAW', Database.Oracle)).toBe('lob');
    });

    it('stops a hint at a word boundary instead of mid-word', () => {
      // Oracle's INT must not claim INTERVAL, PostgreSQL's INT4 must not claim
      // INT4RANGE, and MySQL's INT must not claim a bare INTX.
      expect(getPrimitiveType('interval day to second', Database.Oracle)).toBe(
        'time'
      );
      expect(getPrimitiveType('int4range', Database.PostgreSQL)).toBe('string');
      expect(getPrimitiveType('int8range', Database.PostgreSQL)).toBe('string');
      expect(getPrimitiveType('INTX', Database.MySQL)).toBe('string');
    });

    it('looks past an argument list sitting inside a multi word name', () => {
      expect(
        getPrimitiveType('timestamp(3) with time zone', Database.PostgreSQL)
      ).toBe('dateTime');
      expect(
        getPrimitiveType('interval day(2) to second(6)', Database.Oracle)
      ).toBe('time');
      expect(
        getPrimitiveType('national character varying(20)', Database.MSSQL)
      ).toBe('string');
      expect(getPrimitiveType('bigint(20) unsigned', Database.MySQL)).toBe(
        'long'
      );
    });

    it('resolves the names the vendor lists gained', () => {
      expect(getPrimitiveType('numrange', Database.PostgreSQL)).toBe('string');
      expect(
        getPrimitiveType('timestamp without time zone', Database.PostgreSQL)
      ).toBe('dateTime');
      expect(getPrimitiveType('SERIAL', Database.MySQL)).toBe('long');
      expect(getPrimitiveType('UNSIGNED BIG INT', Database.SQLite)).toBe(
        'long'
      );
      expect(getPrimitiveType('rowversion', Database.MSSQL)).toBe('string');
      expect(getPrimitiveType('INTEGER', Database.Oracle)).toBe('int');
      expect(getPrimitiveType('INET6', Database.MariaDB)).toBe('string');
    });
  });

  describe('getPrimitiveType past the vendor lists', () => {
    it('reads an Oracle or Snowflake NUMBER with a scale as a decimal', () => {
      expect(getPrimitiveType('NUMBER(10,2)', Database.Oracle)).toBe('decimal');
      expect(getPrimitiveType('NUMBER(*,2)', Database.Oracle)).toBe('decimal');
      expect(getPrimitiveType('NUMBER(38,2)', Database.Snowflake)).toBe(
        'decimal'
      );
      expect(getPrimitiveType('NUMBER(10)', Database.Oracle)).toBe('long');
      expect(getPrimitiveType('NUMBER(10,0)', Database.Oracle)).toBe('long');
      expect(getPrimitiveType('NUMBER', Database.Snowflake)).toBe('long');
      expect(getPrimitiveType('NUMBER(10,2)', Database.MariaDB)).toBe(
        'decimal'
      );
    });

    it('reads a FLOAT(p) by its precision where p sets the width', () => {
      expect(getPrimitiveType('FLOAT(24)', Database.MySQL)).toBe('float');
      expect(getPrimitiveType('FLOAT(25)', Database.MySQL)).toBe('double');
      expect(getPrimitiveType('FLOAT(53) UNSIGNED', Database.MariaDB)).toBe(
        'double'
      );
      expect(getPrimitiveType('float(1)', Database.PostgreSQL)).toBe('float');
      expect(getPrimitiveType('float(24)[]', Database.PostgreSQL)).toBe(
        'float'
      );
      expect(getPrimitiveType('float(53)', Database.MSSQL)).toBe('double');
      expect(getPrimitiveType('float(24)', Database.MSSQL)).toBe('float');
    });

    it('leaves a precision outside 1 to 53, two arguments or another name to the list', () => {
      expect(getPrimitiveType('float(0)', Database.MSSQL)).toBe('double');
      expect(getPrimitiveType('FLOAT(0)', Database.MySQL)).toBe('float');
      expect(getPrimitiveType('float(54)', Database.PostgreSQL)).toBe('double');
      expect(getPrimitiveType('FLOAT(10,2)', Database.MySQL)).toBe('float');
      expect(getPrimitiveType('FLOAT4(30)', Database.MySQL)).toBe('float');
      expect(getPrimitiveType('FLOAT(126)', Database.Oracle)).toBe('double');
      expect(getPrimitiveType('FLOAT(10)', Database.Oracle)).toBe('double');
      expect(getPrimitiveType('FLOAT(10)', Database.Snowflake)).toBe('double');
    });

    it('reads the names the vendor lists refiled by what their drivers return', () => {
      expect(getPrimitiveType('bit', Database.MSSQL)).toBe('boolean');
      expect(getPrimitiveType('numeric(10,2)', Database.MSSQL)).toBe('decimal');
      expect(getPrimitiveType('money', Database.MSSQL)).toBe('decimal');
      expect(getPrimitiveType('binary(16)', Database.MSSQL)).toBe('string');
      expect(getPrimitiveType('bit(8)', Database.PostgreSQL)).toBe('string');
      expect(getPrimitiveType('pg_lsn', Database.PostgreSQL)).toBe('string');
      expect(getPrimitiveType('money', Database.PostgreSQL)).toBe('string');
      expect(getPrimitiveType('DATE', Database.Oracle)).toBe('dateTime');
      expect(getPrimitiveType('REAL', Database.Oracle)).toBe('double');
      expect(getPrimitiveType('RAW(16)', Database.Oracle)).toBe('string');
      expect(getPrimitiveType('BOOL', Database.SQLite)).toBe('boolean');
      expect(getPrimitiveType('TIME', Database.SQLite)).toBe('time');
      expect(getPrimitiveType('TIMESTAMP', Database.SQLite)).toBe('dateTime');
    });
  });

  describe('findDataTypeHint', () => {
    it('returns the longest list entry that prefixes the type', () => {
      expect(findDataTypeHint('datetime2(7)', Database.MSSQL)).toEqual({
        name: 'datetime2',
        primitiveType: 'dateTime',
      });
      expect(findDataTypeHint('INT UNSIGNED', Database.MySQL)?.name).toBe(
        'INT'
      );
      expect(findDataTypeHint('int4range', Database.PostgreSQL)?.name).toBe(
        'int4range'
      );
    });

    it('returns nothing for a name the list does not hold', () => {
      expect(findDataTypeHint('mood', Database.PostgreSQL)).toBeUndefined();
      expect(findDataTypeHint('', Database.MySQL)).toBeUndefined();
      expect(findDataTypeHint('INT', 0)).toBeUndefined();
    });
  });

  describe('fractionalNumber', () => {
    it('reads the precision and scale of a NUMBER with a scale on Oracle and Snowflake', () => {
      expect(fractionalNumber('NUMBER(10,2)', Database.Oracle)).toEqual([
        10, 2,
      ]);
      expect(fractionalNumber(' number( * , 4 ) ', Database.Oracle)).toEqual([
        38, 4,
      ]);
      expect(fractionalNumber('NUMBER(38,2)', Database.Snowflake)).toEqual([
        38, 2,
      ]);
    });

    it('returns null for a whole number, another type or another database', () => {
      expect(fractionalNumber('NUMBER(10,0)', Database.Oracle)).toBeNull();
      expect(fractionalNumber('NUMBER(10)', Database.Oracle)).toBeNull();
      expect(fractionalNumber('NUMBER', Database.Oracle)).toBeNull();
      expect(fractionalNumber('DECIMAL(10,2)', Database.Oracle)).toBeNull();
      expect(fractionalNumber('NUMBER(10,2)', Database.MariaDB)).toBeNull();
    });
  });

  describe('baseTypeName', () => {
    it('lowers the name and drops its argument lists and extra spaces', () => {
      expect(baseTypeName('  NUMERIC( 10, 2 ) ')).toBe('numeric');
      expect(baseTypeName('interval day(2) to   second(6)')).toBe(
        'interval day to second'
      );
    });

    it('lowers an I to i under a Turkish default locale too', () => {
      underTurkishLocale(() => {
        expect(baseTypeName('TINYINT UNSIGNED')).toBe('tinyint unsigned');
        expect(baseTypeName('BIT(8)')).toBe('bit');
      });
    });
  });

  describe('splitLines', () => {
    it('splits at CR LF, CR, LF, U+2028 and U+2029, and nowhere else', () => {
      expect(splitLines('a\r\nb\rc\nd\u2028e\u2029f\u0085g')).toEqual([
        'a',
        'b',
        'c',
        'd',
        'e',
        'f\u0085g',
      ]);
      expect(splitLines('one line')).toEqual(['one line']);
      expect(LINE_TERMINATOR.test('\u2028')).toBe(true);
    });
  });

  describe('escapeTypeScriptDirective', () => {
    it.each([
      ['@ts-ignore', '\\@ts-ignore'],
      ['@ts-expect-error no error here', '\\@ts-expect-error no error here'],
      ['@ts-nocheck', '\\@ts-nocheck'],
      ['@ts-check', '\\@ts-check'],
      ['@TS-NOCHECK', '\\@TS-NOCHECK'],
      ['@Ts-Check: on', '\\@Ts-Check: on'],
      ['@ts-nocheck1', '\\@ts-nocheck1'],
      ['@ts-ignored', '\\@ts-ignored'],
      ['  @ts-ignore', '  \\@ts-ignore'],
      ['\t@ts-expect-error', '\t\\@ts-expect-error'],
      ['\u00a0@ts-ignore', '\u00a0\\@ts-ignore'],
      ['\ufeff@ts-nocheck', '\ufeff\\@ts-nocheck'],
    ])(
      'puts a backslash before the at sign of %j, which TypeScript reads as a directive',
      (line, escaped) => {
        expect(escapeTypeScriptDirective(line)).toBe(escaped);
      }
    );

    it.each([
      'see @ts-ignore',
      '/@ts-ignore',
      '\\@ts-ignore',
      '@tsignore',
      '@ts',
      '',
      'plain',
    ])('keeps %j, no directive, as it is', line => {
      expect(escapeTypeScriptDirective(line)).toBe(line);
    });
  });

  describe('getNameCase', () => {
    it('converts to camelCase', () => {
      expect(getNameCase('user_name', NameCase.camelCase)).toBe('userName');
      expect(getNameCase('UserName', NameCase.camelCase)).toBe('userName');
    });

    it('converts to pascalCase', () => {
      expect(getNameCase('user_name', NameCase.pascalCase)).toBe('UserName');
      expect(getNameCase('userName', NameCase.pascalCase)).toBe('UserName');
    });

    it('converts to snakeCase', () => {
      expect(getNameCase('userName', NameCase.snakeCase)).toBe('user_name');
      expect(getNameCase('UserName', NameCase.snakeCase)).toBe('user_name');
    });

    it('leaves the name untouched for none and unknown cases', () => {
      expect(getNameCase('user_Name', NameCase.none)).toBe('user_Name');
      expect(getNameCase('user_Name', 0)).toBe('user_Name');
    });
  });

  describe('referentialActionEntries', () => {
    it('lists ON DELETE before ON UPDATE with their SQL spelling', () => {
      expect(
        referentialActionEntries({
          onDelete: ReferentialAction.setNull,
          onUpdate: ReferentialAction.cascade,
        })
      ).toEqual([
        {
          key: 'onDelete',
          action: ReferentialAction.setNull,
          sql: 'SET NULL',
        },
        {
          key: 'onUpdate',
          action: ReferentialAction.cascade,
          sql: 'CASCADE',
        },
      ]);
    });

    it('leaves out an unset action', () => {
      expect(
        referentialActionEntries({
          onDelete: ReferentialAction.none,
          onUpdate: ReferentialAction.restrict,
        }).map(entry => entry.key)
      ).toEqual(['onUpdate']);
      expect(
        referentialActionEntries({
          onDelete: ReferentialAction.none,
          onUpdate: ReferentialAction.none,
        })
      ).toEqual([]);
    });

    it('keeps only what the DDL of a given database would write', () => {
      const relationship = {
        onDelete: ReferentialAction.setDefault,
        onUpdate: ReferentialAction.cascade,
      };

      expect(
        referentialActionEntries(
          relationship,
          referentialActionSupport(Database.MySQL)
        ).map(entry => entry.key)
      ).toEqual(['onUpdate']);
      expect(
        referentialActionEntries(
          relationship,
          referentialActionSupport(Database.Oracle)
        )
      ).toEqual([]);
      expect(
        referentialActionEntries(
          relationship,
          referentialActionSupport(Database.PostgreSQL)
        )
      ).toHaveLength(2);
    });
  });
});
