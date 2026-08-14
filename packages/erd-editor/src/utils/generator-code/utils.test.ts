import { describe, expect, it } from 'vitest';

import { Database, NameCase, RelationshipType } from '@/constants/schema';
import { MySQLTypes } from '@/constants/sql/dataType/MySQL';
import { PostgreSQLTypes } from '@/constants/sql/dataType/PostgreSQL';
import {
  getDataTypeHints,
  getNameCase,
  getPrimitiveType,
  hasNRelationship,
  hasOneRelationship,
} from '@/utils/generator-code/utils';

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

    it('resolves to the first prefix match in list order, so DATETIME reports date and TIMESTAMP reports time', () => {
      // `DATE` precedes `DATETIME` and `TIME` precedes `TIMESTAMP` in
      // MySQLTypes, and the lookup returns the first prefix hit.
      expect(getPrimitiveType('DATETIME', Database.MySQL)).toBe('date');
      expect(getPrimitiveType('TIMESTAMP', Database.MySQL)).toBe('time');
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
});
