import { SchemaV3Constants } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import {
  BracketType,
  BracketTypeList,
  BracketTypeMap,
  CANVAS_SIZE_MAX,
  CANVAS_SIZE_MIN,
  CANVAS_ZOOM_MAX,
  CANVAS_ZOOM_MIN,
  CanvasType,
  CanvasTypeList,
  ColumnOption,
  ColumnType,
  ColumnTypeList,
  ColumnTypeToName,
  ColumnUIKey,
  Database,
  DatabaseList,
  Direction,
  DirectionList,
  Language,
  LanguageList,
  NameCase,
  NameCaseList,
  OrderType,
  OrderTypeList,
  RelationshipType,
  RelationshipTypeList,
  SaveSettingType,
  Show,
  StartRelationshipType,
  StartRelationshipTypeList,
} from '@/constants/schema';

describe('schema constant re-exports', () => {
  it('re-exports the identical objects from @dineug/erd-editor-schema', () => {
    expect(CanvasType).toBe(SchemaV3Constants.CanvasType);
    expect(CanvasTypeList).toBe(SchemaV3Constants.CanvasTypeList);
    expect(Show).toBe(SchemaV3Constants.Show);
    expect(ColumnType).toBe(SchemaV3Constants.ColumnType);
    expect(ColumnTypeList).toBe(SchemaV3Constants.ColumnTypeList);
    expect(Database).toBe(SchemaV3Constants.Database);
    expect(DatabaseList).toBe(SchemaV3Constants.DatabaseList);
    expect(Language).toBe(SchemaV3Constants.Language);
    expect(LanguageList).toBe(SchemaV3Constants.LanguageList);
    expect(NameCase).toBe(SchemaV3Constants.NameCase);
    expect(NameCaseList).toBe(SchemaV3Constants.NameCaseList);
    expect(BracketType).toBe(SchemaV3Constants.BracketType);
    expect(BracketTypeList).toBe(SchemaV3Constants.BracketTypeList);
    expect(RelationshipType).toBe(SchemaV3Constants.RelationshipType);
    expect(RelationshipTypeList).toBe(SchemaV3Constants.RelationshipTypeList);
    expect(StartRelationshipType).toBe(SchemaV3Constants.StartRelationshipType);
    expect(StartRelationshipTypeList).toBe(
      SchemaV3Constants.StartRelationshipTypeList
    );
    expect(Direction).toBe(SchemaV3Constants.Direction);
    expect(DirectionList).toBe(SchemaV3Constants.DirectionList);
    expect(ColumnOption).toBe(SchemaV3Constants.ColumnOption);
    expect(ColumnUIKey).toBe(SchemaV3Constants.ColumnUIKey);
    expect(OrderType).toBe(SchemaV3Constants.OrderType);
    expect(OrderTypeList).toBe(SchemaV3Constants.OrderTypeList);
    expect(SaveSettingType).toBe(SchemaV3Constants.SaveSettingType);
  });

  it('re-exports the canvas bounds as plain numbers', () => {
    expect(CANVAS_SIZE_MIN).toBe(2_000);
    expect(CANVAS_SIZE_MAX).toBe(20_000);
    expect(CANVAS_ZOOM_MIN).toBe(0.1);
    expect(CANVAS_ZOOM_MAX).toBe(1.5);
    expect(CANVAS_SIZE_MIN).toBeLessThan(CANVAS_SIZE_MAX);
    expect(CANVAS_ZOOM_MIN).toBeLessThan(CANVAS_ZOOM_MAX);
  });

  it('carries the magnifying half of the zoom range, not only the shrinking one', () => {
    expect(CANVAS_ZOOM_MAX).toBeGreaterThan(1);
    expect(CANVAS_ZOOM_MAX).toBe(SchemaV3Constants.CANVAS_ZOOM_MAX);
  });

  it('exposes the built-in canvas type ids', () => {
    expect(CanvasType.ERD).toBe('ERD');
    expect(CanvasType.visualization).toBe(
      '@dineug/erd-editor/builtin-visualization'
    );
    expect(CanvasType.schemaSQL).toBe('@dineug/erd-editor/builtin-schema-sql');
    expect(CanvasType.generatorCode).toBe(
      '@dineug/erd-editor/builtin-generator-code'
    );
    expect(CanvasType.settings).toBe('settings');
    expect(CanvasTypeList).toEqual(Object.values(CanvasType));
  });

  it('models the flag enums as unique single bits', () => {
    const flagGroups = [
      Show,
      ColumnType,
      Database,
      Language,
      NameCase,
      BracketType,
      RelationshipType,
      StartRelationshipType,
      Direction,
      ColumnOption,
      ColumnUIKey,
      OrderType,
      SaveSettingType,
    ];

    for (const group of flagGroups) {
      const values = Object.values(group) as number[];
      expect(new Set(values).size).toBe(values.length);

      for (const value of values) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
        expect(value & (value - 1)).toBe(0);
      }
    }
  });
});

describe('BracketTypeMap', () => {
  it('maps each bracket type to the character wrapped around identifiers', () => {
    expect(BracketTypeMap).toEqual({
      [BracketType.none]: '',
      [BracketType.doubleQuote]: '"',
      [BracketType.singleQuote]: "'",
      [BracketType.backtick]: '`',
    });
  });

  it('covers every entry of BracketTypeList', () => {
    for (const bracketType of BracketTypeList) {
      expect(typeof BracketTypeMap[bracketType]).toBe('string');
    }

    expect(Object.keys(BracketTypeMap)).toHaveLength(BracketTypeList.length);
  });

  it('emits an empty string for BracketType.none only', () => {
    expect(BracketTypeMap[BracketType.none]).toBe('');

    const nonEmpty = Object.entries(BracketTypeMap)
      .filter(([, value]) => value !== '')
      .map(([key]) => Number(key));

    expect(nonEmpty.sort((a, b) => a - b)).toEqual(
      [
        BracketType.doubleQuote,
        BracketType.singleQuote,
        BracketType.backtick,
      ].sort((a, b) => a - b)
    );
  });

  it('returns undefined for an unknown bracket type', () => {
    expect(BracketTypeMap[0]).toBeUndefined();
    expect(BracketTypeMap[999]).toBeUndefined();
  });
});

describe('ColumnTypeToName', () => {
  it('maps every column type flag to its settings label', () => {
    expect(ColumnTypeToName).toEqual({
      [ColumnType.columnName]: 'Name',
      [ColumnType.columnDataType]: 'DataType',
      [ColumnType.columnNotNull]: 'Not Null',
      [ColumnType.columnUnique]: 'Unique',
      [ColumnType.columnAutoIncrement]: 'Auto Increment',
      [ColumnType.columnDefault]: 'Default',
      [ColumnType.columnComment]: 'Comment',
    });
  });

  it('covers every entry of ColumnTypeList with a unique label', () => {
    const labels = ColumnTypeList.map(columnType => {
      const name = ColumnTypeToName[columnType];
      expect(typeof name).toBe('string');
      expect(name.length).toBeGreaterThan(0);
      return name;
    });

    expect(new Set(labels).size).toBe(ColumnTypeList.length);
    expect(Object.keys(ColumnTypeToName)).toHaveLength(ColumnTypeList.length);
  });

  it('returns undefined for a flag that is not a column type', () => {
    expect(ColumnTypeToName[0]).toBeUndefined();
    expect(
      ColumnTypeToName[ColumnType.columnName | ColumnType.columnUnique]
    ).toBeUndefined();
  });
});
