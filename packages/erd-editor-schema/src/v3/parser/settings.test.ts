import { describe, expect, it } from 'vite-plus/test';

import { createAndMergeSettings } from '@/v3/parser/settings';
import {
  BracketType,
  CanvasType,
  ColumnType,
  Database,
  Language,
  NameCase,
  Show,
} from '@/v3/schema/settings';

const defaultShow =
  Show.tableComment |
  Show.columnComment |
  Show.columnDataType |
  Show.columnDefault |
  Show.columnPrimaryKey |
  Show.columnNotNull |
  Show.relationship;

const defaultColumnOrder = [
  ColumnType.columnName,
  ColumnType.columnDataType,
  ColumnType.columnNotNull,
  ColumnType.columnUnique,
  ColumnType.columnAutoIncrement,
  ColumnType.columnDefault,
  ColumnType.columnComment,
];

describe('createAndMergeSettings', () => {
  it('returns the default settings when no json is given', () => {
    expect(createAndMergeSettings()).toEqual({
      width: 2000,
      height: 2000,
      scrollTop: 0,
      scrollLeft: 0,
      zoomLevel: 1,
      show: defaultShow,
      database: Database.MySQL,
      databaseName: '',
      canvasType: CanvasType.ERD,
      language: Language.GraphQL,
      tableNameCase: NameCase.pascalCase,
      columnNameCase: NameCase.camelCase,
      bracketType: BracketType.none,
      relationshipDataTypeSync: true,
      relationshipOptimization: false,
      columnOrder: defaultColumnOrder,
      maxWidthComment: -1,
      ignoreSaveSettings: 0,
    });
  });

  it('computes the default show bitmask as 431', () => {
    expect(createAndMergeSettings().show).toBe(431);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string', 'nope'],
    ['array', []],
  ])('ignores a non-object source (%s)', (_label, source) => {
    expect(createAndMergeSettings(source as any).width).toBe(2000);
  });

  describe('canvas size', () => {
    it('clamps width below the minimum', () => {
      expect(createAndMergeSettings({ width: 10 }).width).toBe(2000);
    });

    it('clamps width above the maximum', () => {
      expect(createAndMergeSettings({ width: 999_999 }).width).toBe(20_000);
    });

    it('keeps a width inside the range', () => {
      expect(createAndMergeSettings({ width: 5_000 }).width).toBe(5_000);
    });

    it('clamps height below the minimum', () => {
      expect(createAndMergeSettings({ height: -1 }).height).toBe(2000);
    });

    it('clamps height above the maximum', () => {
      expect(createAndMergeSettings({ height: 20_001 }).height).toBe(20_000);
    });

    it('ignores a non-number width and height', () => {
      const settings = createAndMergeSettings({
        width: '3000' as any,
        height: null as any,
      });

      expect(settings.width).toBe(2000);
      expect(settings.height).toBe(2000);
    });
  });

  describe('zoomLevel', () => {
    it('clamps below the minimum', () => {
      expect(createAndMergeSettings({ zoomLevel: 0 }).zoomLevel).toBe(0.1);
    });

    it('clamps above the maximum', () => {
      expect(createAndMergeSettings({ zoomLevel: 10 }).zoomLevel).toBe(1);
    });

    it('keeps a value inside the range', () => {
      expect(createAndMergeSettings({ zoomLevel: 0.5 }).zoomLevel).toBe(0.5);
    });

    it('ignores a non-number', () => {
      expect(
        createAndMergeSettings({ zoomLevel: '0.5' as any }).zoomLevel
      ).toBe(1);
    });
  });

  describe('maxWidthComment', () => {
    it('keeps the -1 sentinel untouched', () => {
      expect(
        createAndMergeSettings({ maxWidthComment: -1 }).maxWidthComment
      ).toBe(-1);
    });

    it('clamps below 60', () => {
      expect(
        createAndMergeSettings({ maxWidthComment: 10 }).maxWidthComment
      ).toBe(60);
    });

    it('clamps above 200', () => {
      expect(
        createAndMergeSettings({ maxWidthComment: 1000 }).maxWidthComment
      ).toBe(200);
    });

    it('keeps a value inside the range', () => {
      expect(
        createAndMergeSettings({ maxWidthComment: 120 }).maxWidthComment
      ).toBe(120);
    });

    it('ignores a non-number', () => {
      expect(
        createAndMergeSettings({ maxWidthComment: '120' as any })
          .maxWidthComment
      ).toBe(-1);
    });
  });

  describe('plain assignments', () => {
    it('assigns numbers, strings and booleans', () => {
      const settings = createAndMergeSettings({
        scrollTop: 12,
        scrollLeft: -34,
        show: Show.relationship,
        ignoreSaveSettings: 3,
        databaseName: 'sakila',
        canvasType: CanvasType.schemaSQL,
        relationshipDataTypeSync: false,
        relationshipOptimization: true,
      });

      expect(settings.scrollTop).toBe(12);
      expect(settings.scrollLeft).toBe(-34);
      expect(settings.show).toBe(Show.relationship);
      expect(settings.ignoreSaveSettings).toBe(3);
      expect(settings.databaseName).toBe('sakila');
      expect(settings.canvasType).toBe(CanvasType.schemaSQL);
      expect(settings.relationshipDataTypeSync).toBe(false);
      expect(settings.relationshipOptimization).toBe(true);
    });

    it('ignores wrongly typed values', () => {
      const settings = createAndMergeSettings({
        scrollTop: '12' as any,
        show: null as any,
        databaseName: 10 as any,
        relationshipDataTypeSync: 'false' as any,
      });

      expect(settings.scrollTop).toBe(0);
      expect(settings.show).toBe(defaultShow);
      expect(settings.databaseName).toBe('');
      expect(settings.relationshipDataTypeSync).toBe(true);
    });

    it('accepts any string for canvasType (not validated against CanvasTypeList)', () => {
      expect(createAndMergeSettings({ canvasType: 'nope' }).canvasType).toBe(
        'nope'
      );
    });
  });

  describe('enum validated numbers', () => {
    it('assigns valid enum members', () => {
      const settings = createAndMergeSettings({
        database: Database.PostgreSQL,
        language: Language.Kotlin,
        tableNameCase: NameCase.snakeCase,
        columnNameCase: NameCase.none,
        bracketType: BracketType.backtick,
      });

      expect(settings.database).toBe(Database.PostgreSQL);
      expect(settings.language).toBe(Language.Kotlin);
      expect(settings.tableNameCase).toBe(NameCase.snakeCase);
      expect(settings.columnNameCase).toBe(NameCase.none);
      expect(settings.bracketType).toBe(BracketType.backtick);
    });

    it('keeps the Databricks database', () => {
      expect(
        createAndMergeSettings({ database: Database.Databricks }).database
      ).toBe(Database.Databricks);
    });

    it('keeps the Go language', () => {
      expect(createAndMergeSettings({ language: Language.Go }).language).toBe(
        Language.Go
      );
    });

    it('ignores numbers outside the enum lists', () => {
      const settings = createAndMergeSettings({
        database: 999,
        language: 0,
        tableNameCase: -1,
        columnNameCase: 1024,
        bracketType: 7,
      });

      expect(settings.database).toBe(Database.MySQL);
      expect(settings.language).toBe(Language.GraphQL);
      expect(settings.tableNameCase).toBe(NameCase.pascalCase);
      expect(settings.columnNameCase).toBe(NameCase.camelCase);
      expect(settings.bracketType).toBe(BracketType.none);
    });

    it('ignores non-number enum values', () => {
      expect(createAndMergeSettings({ database: '4' as any }).database).toBe(
        Database.MySQL
      );
    });
  });

  describe('columnOrder', () => {
    it('accepts a permutation of every column type', () => {
      const columnOrder = [...defaultColumnOrder].reverse();
      const settings = createAndMergeSettings({ columnOrder });

      expect(settings.columnOrder).toEqual(columnOrder);
      expect(settings.columnOrder).toBe(columnOrder);
    });

    it('rejects an array with the wrong length', () => {
      expect(
        createAndMergeSettings({ columnOrder: [ColumnType.columnName] })
          .columnOrder
      ).toEqual(defaultColumnOrder);
    });

    it('rejects an array of the right length that is missing a member', () => {
      const columnOrder = [
        ColumnType.columnName,
        ColumnType.columnName,
        ColumnType.columnDataType,
        ColumnType.columnNotNull,
        ColumnType.columnUnique,
        ColumnType.columnAutoIncrement,
        ColumnType.columnDefault,
      ];

      expect(createAndMergeSettings({ columnOrder }).columnOrder).toEqual(
        defaultColumnOrder
      );
    });

    it('rejects a non-array', () => {
      expect(
        createAndMergeSettings({ columnOrder: 'nope' as any }).columnOrder
      ).toEqual(defaultColumnOrder);
    });
  });
});
